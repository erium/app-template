import type { Request, Response, NextFunction } from "express";
import { authService } from "../_core/auth";

// Extend Express Request to carry the authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        tenantId: number;
        role: string;
        name: string | null;
        language: string | null;
        [key: string]: unknown;
      };
    }
  }
}

/**
 * Populates req.user from the JWT session cookie.
 * Does NOT reject unauthenticated requests — downstream handlers decide.
 */
export async function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await authService.authenticateRequest(req);
    if (user) {
      req.user = user as Express.Request["user"];
    }
  } catch (err) {
    console.error("[Auth Middleware] Error authenticating request:", err);
  }
  next();
}

/**
 * Rejects with 401 if no authenticated user on the request.
 * Must run after `authenticateUser`.
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Nicht authentifiziert" });
    return;
  }
  next();
}

/**
 * Rejects with 403 if the authenticated user is not an admin.
 * Must run after `requireAuth`.
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Nur Administratoren haben Zugriff" });
    return;
  }
  next();
}
