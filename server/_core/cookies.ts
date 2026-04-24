import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  _req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // DEBUG: Force secure=false and SameSite=Lax to ensure browser accepts cookie
  console.log("[Cookies] Generating cookie options. Secure forced to FALSE.");
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false, // FORCED FALSE FOR DEBUGGING
  };
}
