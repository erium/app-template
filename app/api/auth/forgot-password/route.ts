import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "crypto";
import * as db from "../../../../server/db";
import { sendPasswordResetEmail } from "../../../../server/email";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await db.getUserByEmail(parsed.data.email);
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const token = randomUUID();
    const expires = new Date();
    expires.setHours(expires.getHours() + 1);

    await db.setPasswordResetToken(user.id, token, expires);
    await sendPasswordResetEmail(user.email, token, (user.language ?? "de") as "de" | "en");

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] forgotPassword error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
