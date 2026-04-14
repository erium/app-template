import express from "express";
import { stripe } from "./stripe";
import * as db from "./db";
import getRawBody from "raw-body";

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
    console.error("Webhook signature verification failed:", errMessage);
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
          console.log(`[Webhook] Transaction ${session.id} already processed, skipping.`);
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
          console.log(`[Webhook] Updated credits for tenant ${user.tenantId} (user ${userId}): +${creditsToAdd}`);
        } else {
          console.error(`[Webhook] User ${userId} not found, could not credit tenant.`);
        }
      } catch (error) {
        console.error("[Webhook] Failed to update credits:", error);
        res.status(500).send("Internal Server Error");
        return;
      }
    }
  }

  res.json({ received: true });
});

export const webhookRouter = router;
