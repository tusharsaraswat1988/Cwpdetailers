import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { optionalAuth } from "./middlewares/auth";

const app: Express = express();

/**
 * Trust reverse proxy hops (Railway, Render, Cloudflare, AWS ALB).
 * Enables req.secure and req.protocol to accurately reflect HTTPS termination at the edge.
 */
app.set("trust proxy", 1);
app.disable("x-powered-by");

/**
 * Enforce canonical domain (www -> apex) and 301 HTTPS redirection in production.
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const isProd =
    (process.env.NODE_ENV ?? "").toLowerCase() === "production" ||
    process.env.ENFORCE_HTTPS === "true";
  if (isProd) {
    const rawHost =
      (req.headers["x-forwarded-host"] as string)?.split(",")[0]?.trim() ||
      req.get("host") ||
      "";
    const host = rawHost.split(":")[0];
    const proto =
      (req.headers["x-forwarded-proto"] as string)?.split(",")[0]?.trim() ||
      req.protocol;

    // 1. Canonical domain redirect: normalize www.cwpdetailers.in to cwpdetailers.in
    if (host.toLowerCase().startsWith("www.cwpdetailers.in")) {
      const canonicalHost = host.replace(/^www\./i, "");
      return res.redirect(301, `https://${canonicalHost}${req.originalUrl}`);
    }

    // 2. Enforce HTTPS: permanently redirect any HTTP request to HTTPS (skip localhost/127.0.0.1)
    const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
    if (proto === "http" && !isLocalhost) {
      return res.redirect(301, `https://${rawHost}${req.originalUrl}`);
    }
  }
  next();
});

/**
 * Enforce strict security headers, HSTS, and CSP upgrade-insecure-requests.
 */
app.use((_req: Request, res: Response, next: NextFunction) => {
  const isProd = (process.env.NODE_ENV ?? "").toLowerCase() === "production";

  // Strict-Transport-Security (HSTS): Enforce HTTPS for 1 year, include subdomains, preload
  if (isProd) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  // Content-Security-Policy: upgrade all insecure HTTP requests to HTTPS, allow trusted CDNs & Cashfree SDK
  res.setHeader(
    "Content-Security-Policy",
    "upgrade-insecure-requests; default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src 'self' https: wss:; font-src 'self' https: data:; img-src 'self' https: data: blob:; script-src 'self' https: 'unsafe-inline' 'unsafe-eval'; style-src 'self' https: 'unsafe-inline'; frame-src 'self' https:;",
  );

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");

  next();
});


app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
/** Camera visit uploads send multi-MB base64 JSON; default 100kb rejects before route handler. */
app.use(
  express.json({
    limit: "15mb",
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const tooLarge =
    typeof err === "object"
    && err !== null
    && "type" in err
    && (err as { type?: string }).type === "entity.too.large";
  if (tooLarge) {
    req.log?.warn({ url: req.url, contentLength: req.headers["content-length"] }, "request body too large");
    return res.status(413).json({
      error: "Photo upload too large (max 15MB). Try lower camera resolution.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  return next(err);
});

app.use("/api", optionalAuth, router);

/**
 * Robustly resolve the frontend static assets directory in production.
 * Handles running from repo root, running from artifacts/api-server, or custom STATIC_ROOT env.
 */
function resolveStaticDirectory(): string | null {
  const envPath = process.env.STATIC_ROOT;
  const candidates: string[] = [];

  if (envPath) {
    if (path.isAbsolute(envPath)) {
      candidates.push(envPath);
    } else {
      candidates.push(path.resolve(process.cwd(), envPath));
      candidates.push(path.resolve(process.cwd(), "..", envPath));
      candidates.push(path.resolve(process.cwd(), "../..", envPath));
    }
  }

  // Common locations for cwp-platform dist/public
  candidates.push(
    path.resolve(process.cwd(), "artifacts/cwp-platform/dist/public"),
    path.resolve(process.cwd(), "../cwp-platform/dist/public"),
    path.resolve(process.cwd(), "../../artifacts/cwp-platform/dist/public"),
  );

  for (const candidate of candidates) {
    const indexPath = path.join(candidate, "index.html");
    if (fs.existsSync(indexPath)) {
      return candidate;
    }
  }

  return null;
}

const resolvedStaticRoot = resolveStaticDirectory();
if (resolvedStaticRoot && process.env.NODE_ENV === "production") {
  logger.info({ staticRoot: resolvedStaticRoot }, "Serving static frontend bundle");
  app.use(express.static(resolvedStaticRoot));
  app.get("{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(resolvedStaticRoot, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else if (process.env.NODE_ENV === "production") {
  logger.warn(
    { cwd: process.cwd(), staticRootEnv: process.env.STATIC_ROOT },
    "Static frontend bundle (index.html) not found in any candidate path. Please check build logs.",
  );
  app.get("{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.status(503).type("html").send(`
      <!DOCTYPE html>
      <html>
        <head><title>CWP Detailers - Building Assets</title><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family:system-ui,-apple-system,sans-serif;padding:3rem 1.5rem;max-width:640px;margin:auto;text-align:center;color:#1e293b;">
          <h2 style="color:#0284c7;margin-bottom:0.75rem;">Backend is Online, Frontend Not Found</h2>
          <p style="color:#475569;line-height:1.6;">The API server is running successfully, but the frontend static build was not found at <code>artifacts/cwp-platform/dist/public</code>.</p>
          <p style="color:#64748b;font-size:0.875rem;">Please ensure <code>@workspace/cwp-platform</code> was built during the deployment build step.</p>
        </body>
      </html>
    `);
  });
}

export default app;
