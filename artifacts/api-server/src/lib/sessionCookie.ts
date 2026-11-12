import type { Request, Response } from "express";
import {
  AUTH_PORTAL_HEADER,
  AUTH_PORTALS,
  type AuthPortal,
  isAuthPortal,
} from "./authPortals";

export const SESSION_COOKIE_PREFIX = "cwp_session_";
export const LEGACY_SESSION_COOKIE_NAME = "cwp_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function sessionCookieName(portal: AuthPortal): string {
  return `${SESSION_COOKIE_PREFIX}${portal}`;
}

export function parseAuthPortalHeader(req: Request): AuthPortal | null {
  const queryPortal = typeof req.query?.portal === "string" ? req.query.portal : undefined;
  const raw = req.headers[AUTH_PORTAL_HEADER] ?? queryPortal;
  if (typeof raw === "string" && isAuthPortal(raw)) return raw;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (isAuthPortal(item)) return item;
    }
  }
  return null;
}

export function setSessionCookie(res: Response, token: string, portal: AuthPortal): void {
  res.cookie(sessionCookieName(portal), token, {
    ...cookieOptions,
    maxAge: SESSION_TTL_MS,
  });
  // Drop legacy single cookie so it cannot overwrite portal sessions.
  res.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);
}

export function clearSessionCookie(res: Response, portal: AuthPortal): void {
  res.clearCookie(sessionCookieName(portal), cookieOptions);
}

export function clearAllSessionCookies(res: Response): void {
  for (const portal of AUTH_PORTALS) {
    clearSessionCookie(res, portal);
  }
  res.clearCookie(LEGACY_SESSION_COOKIE_NAME, cookieOptions);
}

/** Session tokens for the requested portal only (cookie scoped by X-Auth-Portal/query portal, then bearer). Fallback to all portal cookies when unauthenticated direct navigation occurs. */
export function listSessionTokens(req: Request): string[] {
  const tokens: string[] = [];
  const portal = parseAuthPortalHeader(req);

  if (portal) {
    const cookieToken = req.cookies?.[sessionCookieName(portal)];
    if (typeof cookieToken === "string") {
      const trimmed = cookieToken.trim();
      if (trimmed) tokens.push(trimmed);
    }
  } else {
    // When no portal header/param is present (e.g. direct browser navigation
    // to view/download PDF invoices, exports, or media files), inspect all
    // portal session cookies.
    for (const p of AUTH_PORTALS) {
      const cookieToken = req.cookies?.[sessionCookieName(p)];
      if (typeof cookieToken === "string") {
        const trimmed = cookieToken.trim();
        if (trimmed && !tokens.includes(trimmed)) tokens.push(trimmed);
      }
    }
    const legacy = req.cookies?.[LEGACY_SESSION_COOKIE_NAME];
    if (typeof legacy === "string") {
      const trimmed = legacy.trim();
      if (trimmed && !tokens.includes(trimmed)) tokens.push(trimmed);
    }
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const bearer = header.slice(7).trim();
    if (bearer && !tokens.includes(bearer)) tokens.push(bearer);
  }

  const queryToken = typeof req.query?.token === "string" ? req.query.token.trim() : null;
  if (queryToken && !tokens.includes(queryToken)) {
    tokens.push(queryToken);
  }

  return tokens;
}

/** @deprecated Prefer listSessionTokens + DB lookup with fallback. */
export function readSessionToken(req: Request): string | null {
  return listSessionTokens(req)[0] ?? null;
}
