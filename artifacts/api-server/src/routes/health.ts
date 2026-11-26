import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (req, res) => {
  // Shallow liveness check if explicitly requested
  if (req.query.shallow === "true") {
    const data = HealthCheckResponse.parse({ status: "ok" });
    return res.status(200).json(data);
  }

  try {
    if (!pool || typeof pool.query !== "function") {
      throw new Error("Database pool is not initialized");
    }

    const timeoutMs = req.query.timeoutMs ? parseInt(String(req.query.timeoutMs), 10) : 2000;
    const dbPing = pool.query("SELECT 1");
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database ping timed out")), timeoutMs)
    );

    await Promise.race([dbPing, timeoutPromise]);

    const data = HealthCheckResponse.parse({ status: "ok" });
    return res.status(200).json({
      ...data,
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const message = err?.message || "Health check failed";
    return res.status(503).json({
      status: "degraded",
      database: "disconnected",
      error: message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
