import { NextResponse } from "next/server";
import { stripe } from "../../../../server/stripe";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !signature) {
    return new Response("Missing secret or signature", { status: 400 });
  }

  let event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Webhook signature verification failed");
    return new Response(`Webhook Error: ${errMessage}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = parseInt(session.client_reference_id || "0");
    const amount = session.amount_total || 0;
    const creditsToAdd = session.metadata?.credits ? parseInt(session.metadata.credits) : amount;

    if (userId > 0) {
      try {
        const existing = await db.getTransactionByStripeSessionId(session.id);
        if (existing) {
          logger.info({ sessionId: session.id }, "[Webhook] Transaction already processed, skipping");
          return NextResponse.json({ received: true });
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
        return new Response("Internal Server Error", { status: 500 });
      }
    }
  }

  return NextResponse.json({ received: true });
}
