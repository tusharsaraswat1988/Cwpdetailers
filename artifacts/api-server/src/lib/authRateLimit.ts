import type { Request, Response, NextFunction } from "express";
import { logAuthEvent } from "./authObservability";

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory rate limiter for auth endpoints.
 * Keys combine scope + client IP + phone suffix (when present).
 * Protects against credential stuffing and OTP SMS bombardment.
 */
export function authRateLimit(scope: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const raw = req.id ?? req.headers["x-request-id"] ?? req.headers["x-correlation-id"];
    const requestId = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
    if (requestId) {
      res.setHeader("X-Correlation-Id", requestId);
    }

    const phone = typeof req.body?.phone === "string" ? req.body.phone.replace(/\D/g, "").slice(-4) : "";
    const key = `${scope}:${req.ip ?? "unknown"}:${phone}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));

      logAuthEvent(req, "auth.rate_limited", {
        scope,
        authErrorCode: "OTP_RATE_LIMITED",
        retryAfterSec,
      });

      return res.status(429).json({
        error: "Too many attempts. Please wait and try again.",
        code: "OTP_RATE_LIMITED",
        retryAfterSec,
        ...(requestId ? { requestId } : {}),
      });
    }

    bucket.count++;
    return next();
  };
}

/** Clears all rate limiter state (used in testing and maintenance). */
export function clearRateLimitBuckets(): void {
  buckets.clear();
}
