import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
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
app.use(express.json({ limit: "15mb" }));
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

const staticRoot = process.env.STATIC_ROOT;
if (staticRoot && process.env.NODE_ENV === "production") {
  const resolvedRoot = path.resolve(staticRoot);
  app.use(express.static(resolvedRoot));
  app.get("{*path}", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(resolvedRoot, "index.html"), (err) => {
      if (err) next(err);
    });
  });
}

export default app;
