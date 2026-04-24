import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { stripe } from "../stripe";
import * as db from "../db";
import { requireAuth } from "../middleware/auth";
import { logger } from "../utils/logger";

const router = Router();

// All payment routes require authentication
router.use(requireAuth);

// ─── POST /api/payment/checkout ───
router.post("/checkout", async (req: Request, res: Response) => {
  const schema = z.object({
    credits: z.number().min(100), // Min 100 credits
    amount: z.number().min(100), // Min 1.00 EUR (in cents)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Ungültige Eingabe", details: parsed.error.flatten() });
    return;
  }

  const { credits, amount } = parsed.data;
  const user = req.user!;

  const origin =
    req.headers.origin || process.env.APP_URL || "http://localhost:8497";

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `${credits} Credits`,
              description: "Credits für Video-Analyse und Verarbeitung",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
      client_reference_id: user.id.toString(),
      metadata: {
        userId: user.id.toString(),
        credits: credits.toString(),
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    logger.error({ err: error }, "Stripe Checkout error");
    res.status(500).json({
      error:
        "Fehler beim Erstellen der Checkout-Session: " +
        (error as Error).message,
    });
  }
});

// ─── GET /api/payment/transactions ───
router.get("/transactions", async (req: Request, res: Response) => {
  try {
    const history = await db.getTransactionsByUser(req.user!.id);
    res.json(history);
  } catch (err) {
    logger.error({ err }, "[Payment] getTransactions error");
    res.status(500).json({ error: "Interner Serverfehler" });
  }
});

export default router;
