import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { authService } from "../../../../server/_core/auth";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  token: z.string(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const invitation = await db.getInvitationByToken(input.token);

    if (!invitation || invitation.status !== "pending" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Einladung ungültig oder abgelaufen" }, { status: 400 });
    }

    const existingUser = await db.getUserByEmail(invitation.email);
    if (existingUser) {
      return NextResponse.json({ error: "Nutzer existiert bereits" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await db.createUser({
      email: invitation.email,
      passwordHash,
      name: input.name,
      role: invitation.role,
      tenantId: invitation.tenantId,
      language: "de",
      emailVerified: new Date(),
    });

    await db.acceptInvitation(invitation.id);

    const sessionToken = await authService.createSessionToken(user.id, user.email, user.tenantId);
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: ONE_YEAR_MS / 1000,
    });
    return response;
  } catch (err) {
    logger.error({ err }, "[Auth] join error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
