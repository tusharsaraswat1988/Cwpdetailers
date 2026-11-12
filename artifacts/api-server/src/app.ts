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
