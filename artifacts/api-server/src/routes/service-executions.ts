import { Router } from "express";
import { isServiceExecutionsEnabled } from "../lib/executions/featureFlag";
import {
  cancelExecution,
  completeExecution,
  getExecutionDetail,
  listStaffExecutions,
  listTodayWork,
  missExecution,
  rescheduleExecution,
  startExecution,
} from "../lib/executions/executionService";

const router = Router();

function disabled(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  return res.status(503).json({ error: "Service executions are disabled" });
}

router.get("/service-executions/today", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const data = await listTodayWork(req, date);
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/service-executions", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
    const staffId = req.query.staffId != null ? Number(req.query.staffId) : undefined;
    const data = await listStaffExecutions(req, { limit, staffId });
    return res.json({ data, total: data.length });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/service-executions/:id", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const detail = await getExecutionDetail(req, id);
    if (!detail) return res.status(404).json({ error: "Execution not found" });
    return res.json(detail);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/service-executions/:id/start", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const { latitude, longitude, accuracy } = req.body ?? {};
    const result = await startExecution(req, id, { latitude, longitude, accuracy });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
});

router.post("/service-executions/:id/complete", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const { photos, notes, checklist, latitude, longitude, accuracy } = req.body ?? {};
    const result = await completeExecution(req, id, {
      photos,
      notes,
      checklist,
      gps: { latitude, longitude, accuracy },
    });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
});

router.post("/service-executions/:id/miss", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const result = await missExecution(req, id, req.body?.reason);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
});

router.post("/service-executions/:id/cancel", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const result = await cancelExecution(req, id, req.body?.reason);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
});

router.post("/service-executions/:id/reschedule", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const { scheduledDate, scheduledTime, reason } = req.body ?? {};
    if (!scheduledDate) return res.status(400).json({ error: "scheduledDate is required" });
    const result = await rescheduleExecution(req, id, { scheduledDate, scheduledTime, reason });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(msg.includes("not found") ? 404 : 400).json({ error: msg });
  }
});

export default router;
