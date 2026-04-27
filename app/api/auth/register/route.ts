import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import * as db from "../../../../server/db";
import { sendVerificationEmail } from "../../../../server/email";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  companyName: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const existing = await db.getUserByEmail(input.email);
    if (existing) {
      return NextResponse.json({ error: "E-Mail bereits vergeben" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const verificationToken = randomUUID();

    await db.createTenantWithAdmin(input.companyName, {
      email: input.email,
      passwordHash,
      name: input.name,
      language: "de",
      verificationToken,
      emailVerified: null,
    });

    sendVerificationEmail(input.email, verificationToken, input.name).catch(
      (err) => logger.error({ err }, "Failed to send verification email"),
    );

    return NextResponse.json({ success: true, message: "Bitte E-Mail bestätigen" });
  } catch (err) {
    logger.error({ err }, "[Auth] register error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
