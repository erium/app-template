import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/server/getUser";
import { stripe } from "../../../../server/stripe";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  credits: z.number().min(100),
  amount: z.number().min(100),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const { credits, amount } = parsed.data;
    const origin = request.headers.get("origin") || process.env.APP_URL || "http://localhost:8497";

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

    return NextResponse.json({ url: session.url });
  } catch (err) {
    if (err instanceof Response) return err;
    logger.error({ err }, "Stripe Checkout error");
    return NextResponse.json({ error: "Fehler beim Erstellen der Checkout-Session: " + (err as Error).message }, { status: 500 });
  }
}
