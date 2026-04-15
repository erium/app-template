import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";
import { logger } from "../utils/logger";
import { ENV } from "./env";

export type SessionPayload = {
  userId: number;
  email: string;
  tenantId: number;
};

class LocalAuthService {
  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("JWT_SECRET environment variable is required");
    return new TextEncoder().encode(secret);
  }

  async createSessionToken(userId: number, email: string, tenantId: number): Promise<string> {
    const issuedAt = Date.now();
    const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
    const secretKey = this.getSessionSecret();
    
    logger.debug({ userId, email, tenantId }, "[Auth] Creating session token");

    return new SignJWT({
      userId,
      email,
      tenantId
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });

      const { userId, email, tenantId } = payload as Record<string, unknown>;

      if (typeof userId !== "number" || typeof email !== "string" || typeof tenantId !== "number") {
        logger.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return { userId, email, tenantId };
    } catch (error) {
      logger.warn({ err: error }, "[Auth] Session verification failed");
      return null;
    }
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  async authenticateRequest(req: Request) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);

    if (!sessionCookie) {
        return null;
    }

    const session = await this.verifySession(sessionCookie);

    if (!session) {
      return null;
    }

    // We fetch the user to ensure they still exist and have access
    const user = await db.getUserById(session.userId);
    if (!user) {
      logger.warn({ userId: session.userId }, "[Auth] User from valid token not found in DB");
      return null;
    }

    // Security check: Ensure token tenant matches user tenant
    if (user.tenantId !== session.tenantId) {
        logger.warn({ userId: user.id, tokenTenantId: session.tenantId, dbTenantId: user.tenantId }, "[Auth] Tenant mismatch");
        return null;
    }

    // Update last signed in (async, don't await to block)
    db.updateUserLastSignedIn(user.id).catch((err) => logger.error({ err }, "Failed to update last login"));

    return user;
  }
}

export const authService = new LocalAuthService();
