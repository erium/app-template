import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import * as db from "../db";
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
    
    console.log(`[Auth] Creating token for user ${userId} (${email}) Tenant: ${tenantId}`);

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
      // console.warn("[Auth] Verify: Missing session cookie value");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });

      const { userId, email, tenantId } = payload as Record<string, unknown>;

      if (typeof userId !== "number" || typeof email !== "string" || typeof tenantId !== "number") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      
      // console.log(`[Auth] Verified session for user ${userId}`);
      return { userId, email, tenantId };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
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
    // console.log(`[Auth] Authenticating request to ${req.url}`);
    
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    
    if (!sessionCookie) {
        // console.log(`[Auth] No '${COOKIE_NAME}' cookie found.`);
        return null;
    }

    const session = await this.verifySession(sessionCookie);

    if (!session) {
      return null;
    }

    // We fetch the user to ensure they still exist and have access
    const user = await db.getUserById(session.userId);
    if (!user) {
      console.warn(`[Auth] User ${session.userId} from valid token not found in DB`);
      return null;
    }

    // Security check: Ensure token tenant matches user tenant
    if (user.tenantId !== session.tenantId) {
        console.warn(`[Auth] Tenant mismatch for user ${user.id}. Token: ${session.tenantId}, DB: ${user.tenantId}`);
        return null;
    }

    // Update last signed in (async, don't await to block)
    db.updateUserLastSignedIn(user.id).catch(err => console.error("Failed to update last login", err));

    return user;
  }
}

export const authService = new LocalAuthService();
