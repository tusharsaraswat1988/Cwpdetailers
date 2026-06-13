import type { Request, Response, NextFunction } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Simple in-memory rate limiter for sensitive DCMS endpoints. */
export function dcmsRateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.user?.id ?? req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests — try again shortly" });
    }

    bucket.count++;
    return next();
  };
}
