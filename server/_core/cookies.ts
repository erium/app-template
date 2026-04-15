import type { CookieOptions, Request } from "express";
import { logger } from "../utils/logger";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // DEBUG: Force secure=false and SameSite=Lax to ensure browser accepts cookie
  logger.debug("[Cookies] Generating cookie options. Secure forced to FALSE.");
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false, // FORCED FALSE FOR DEBUGGING
  };
}
