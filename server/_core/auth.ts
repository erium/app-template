import { SignJWT, jwtVerify } from "jose";
import { ONE_YEAR_MS } from "@shared/const";
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

}

export const authService = new LocalAuthService();
