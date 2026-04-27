export type SessionCookieOptions = {
  httpOnly: boolean;
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
};

export function getSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: false, // FORCED FALSE FOR DEBUGGING
  };
}
