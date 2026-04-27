import { NextResponse } from "next/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { authService } from "../../../../server/_core/auth";
import * as db from "../../../../server/db";
import { logger } from "../../../../server/utils/logger";

const schema = z.object({ token: z.string() });

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe", details: parsed.error.flatten() }, { status: 400 });
    }

    const user = await db.getUserByVerificationToken(parsed.data.token);
    if (!user) {
      return NextResponse.json({ error: "Ungültiges Token" }, { status: 400 });
    }

    await db.verifyUserEmail(user.id);

    const token = await authService.createSessionToken(user.id, user.email, user.tenantId);
    const response = NextResponse.json({ success: true });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
      maxAge: ONE_YEAR_MS / 1000,
    });
    return response;
  } catch (err) {
    logger.error({ err }, "[Auth] verifyEmail error:");
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 });
  }
}
