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
  pauseExecution,
  resumeExecution,
  addExecutionPhotos,
  saveExecutionNotes,
  saveExecutionChecklist,
  saveCustomerSignature,
} from "../lib/executions/executionService";
import { getExecutionTimeline } from "../lib/executions/executionTimeline";

const router = Router();

function disabled(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  return res.status(503).json({ error: "Service executions are disabled" });
}

function errorStatus(msg: string): number {
  if (msg.includes("not found")) return 404;
  if (msg.includes("Wrong technician") || msg.includes("already")) return 409;
  return 400;
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

router.get("/service-executions/:id/timeline", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const detail = await getExecutionDetail(req, id);
    if (!detail) return res.status(404).json({ error: "Execution not found" });
    const timeline = await getExecutionTimeline(id);
    return res.json(timeline.map(t => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      actorId: t.actorId,
      actorName: t.actorName,
      createdAt: t.createdAt.toISOString(),
    })));
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
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/pause", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const result = await pauseExecution(req, id, req.body?.reason);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/resume", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const result = await resumeExecution(req, id);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/photos", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const { photos } = req.body ?? {};
    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: "photos array is required" });
    }
    const result = await addExecutionPhotos(req, id, photos);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/notes", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const notes = Array.isArray(req.body?.notes)
      ? req.body.notes
      : req.body?.body
        ? [{ body: String(req.body.body), kind: req.body.kind }]
        : [];
    if (!notes.length) return res.status(400).json({ error: "notes or body is required" });
    const result = await saveExecutionNotes(req, id, notes);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/checklist", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const items = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }
    const result = await saveExecutionChecklist(req, id, items);
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/signature", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const signatureUrl = req.body?.signatureUrl ?? req.body?.customerSignatureUrl;
    if (!signatureUrl) return res.status(400).json({ error: "signatureUrl is required" });
    const result = await saveCustomerSignature(req, id, String(signatureUrl));
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/service-executions/:id/complete", async (req, res) => {
  if (!isServiceExecutionsEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid execution id" });
    const { photos, notes, checklist, latitude, longitude, accuracy, customerSignatureUrl } = req.body ?? {};
    const result = await completeExecution(req, id, {
      photos,
      notes,
      checklist,
      customerSignatureUrl,
      gps: { latitude, longitude, accuracy },
    });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
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
    return res.status(errorStatus(msg)).json({ error: msg });
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
    return res.status(errorStatus(msg)).json({ error: msg });
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
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

export default router;
