import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "cwp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** All candidate session tokens on the request (cookie first, then bearer). */
export function listSessionTokens(req: Request): string[] {
  const tokens: string[] = [];

  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === "string") {
    const trimmed = cookieToken.trim();
    if (trimmed) tokens.push(trimmed);
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer && !tokens.includes(bearer)) tokens.push(bearer);
  }

  return tokens;
}

/** @deprecated Prefer listSessionTokens + DB lookup with fallback. */
export function readSessionToken(req: Request): string | null {
  return listSessionTokens(req)[0] ?? null;
}
