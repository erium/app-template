import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  token: z.string(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const user = await db.getUserByResetToken(input.token);

    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return NextResponse.json({ error: "Token ungültig oder abgelaufen" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await db.resetUserPassword(user.id, passwordHash);

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error({ err }, "[Auth] resetPassword error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
