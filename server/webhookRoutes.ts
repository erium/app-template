import express from "express";
import { stripe } from "./stripe";
import * as db from "./db";
import getRawBody from "raw-body";
import { logger } from "./utils/logger";

const router = express.Router();

router.post("/api/webhook/stripe", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !signature) {
    res.status(400).send("Missing secret or signature");
    return;
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Webhook signature verification failed");
    res.status(400).send(`Webhook Error: ${errMessage}`);
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = parseInt(session.client_reference_id || "0");
    const amount = session.amount_total || 0; // in cents

    // Logic: 1 cent = 1 credit (can be adjusted via metadata)
    const creditsToAdd = session.metadata?.credits ? parseInt(session.metadata.credits) : amount;

    if (userId > 0) {
      try {
        // Check for duplicate transaction (idempotency)
        const existing = await db.getTransactionByStripeSessionId(session.id);
        if (existing) {
          logger.info({ sessionId: session.id }, "[Webhook] Transaction already processed, skipping");
          res.json({ received: true });
          return;
        }

        await db.createTransaction({
          userId,
          amount,
          credits: creditsToAdd,
          stripeSessionId: session.id,
          status: "completed",
        });

        const user = await db.getUserById(userId);
        if (user) {
          await db.addTenantCredits(user.tenantId, creditsToAdd);
          logger.info({ tenantId: user.tenantId, userId, creditsToAdd }, "[Webhook] Updated credits for tenant");
        } else {
          logger.error({ userId }, "[Webhook] User not found, could not credit tenant");
        }
      } catch (error) {
        logger.error({ err: error }, "[Webhook] Failed to update credits");
        res.status(500).send("Internal Server Error");
        return;
      }
    }
  }

  res.json({ received: true });
});

export const webhookRouter = router;
