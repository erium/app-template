import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { authService } from "../../../../server/_core/auth";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const user = await db.getUserByEmail(email);
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ error: "Bitte bestätige deine E-Mail-Adresse." }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    const token = await authService.createSessionToken(user.id, user.email, user.tenantId);
    const response = NextResponse.json({ user });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: ONE_YEAR_MS / 1000,
    });
    return response;
  } catch (err) {
    logger.error({ err }, "[Auth] login error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
