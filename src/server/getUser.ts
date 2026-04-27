// Auth helper for Next.js Route Handlers — replaces Express req.user pattern.
//
// Usage in a Route Handler:
//   const user = await getUser(request);
//   if (!user) return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
//
//   // or use the throwing helpers:
//   const user = await requireUser(request);     // throws 401 Response
//   const admin = await requireAdmin(request);   // throws 403 Response

import { COOKIE_NAME } from "@shared/const";
import { authService } from "../../server/_core/auth";
import * as db from "../../server/db";
import { logger } from "../../server/utils/logger";

export type AuthUser = Awaited<ReturnType<typeof db.getUserById>> & {};

export async function getUser(request: Request): Promise<NonNullable<AuthUser> | null> {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const sessionCookie = parseCookieValue(cookieHeader, COOKIE_NAME);
    if (!sessionCookie) return null;

    const session = await authService.verifySession(sessionCookie);
    if (!session) return null;

    const user = await db.getUserById(session.userId);
    if (!user) return null;

    if (user.tenantId !== session.tenantId) {
      logger.warn({ userId: user.id }, "[getUser] Tenant mismatch");
      return null;
    }

    db.updateUserLastSignedIn(user.id).catch((err) =>
      logger.error({ err }, "Failed to update last login")
    );

    return user;
  } catch (err) {
    logger.error({ err }, "[getUser] Error authenticating request");
    return null;
  }
}

export async function requireUser(request: Request): Promise<NonNullable<AuthUser>> {
  const user = await getUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Nicht authentifiziert" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireAdmin(request: Request): Promise<NonNullable<AuthUser>> {
  const user = await requireUser(request);
  if (user.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Nur Administratoren haben Zugriff" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

function parseCookieValue(cookieHeader: string, name: string): string | undefined {
  for (const pair of cookieHeader.split(";")) {
    const [k, ...rest] = pair.split("=");
    if (k.trim() === name) return rest.join("=").trim();
  }
  return undefined;
}
