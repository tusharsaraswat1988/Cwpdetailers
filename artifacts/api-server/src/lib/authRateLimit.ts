import type { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

/**
 * In-memory rate limiter for auth endpoints.
 * Keys combine scope + client IP + phone suffix (when present).
 * Replace with Redis-backed limiter for multi-instance production.
 */
export function authRateLimit(scope: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone.replace(/\D/g, "").slice(-4) : "";
    const key = `${scope}:${req.ip ?? "unknown"}:${phone}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: "Too many attempts. Please wait and try again." });
    }

    bucket.count++;
    return next();
  };
}
