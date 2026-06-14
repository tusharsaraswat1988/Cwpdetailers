import { Router } from "express";
import { isServiceAssignmentsEnabled } from "../lib/assignments/featureFlag";
import {
  assignPendingService,
  getAssignmentDetail,
  listAssignedServices,
  listPendingAssignments,
} from "../lib/assignments/assignmentService";

const router = Router();

function parseFilters(query: Record<string, string | undefined>) {
  return {
    serviceType: query.serviceType,
    serviceLocationId: query.serviceLocationId ? parseInt(query.serviceLocationId, 10) : undefined,
    staffId: query.staffId ? parseInt(query.staffId, 10) : undefined,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  };
}

router.get("/assignments/pending", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const data = await listPendingAssignments(req, parseFilters(req.query as Record<string, string>));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/assignments/assigned", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const data = await listAssignedServices(req, parseFilters(req.query as Record<string, string>));
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/assignments/:id", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid assignment id" });
    const detail = await getAssignmentDetail(req, id);
    if (!detail) return res.status(404).json({ error: "Assignment not found" });
    return res.json(detail);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/assignments/:pendingId/assign", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const pendingId = parseInt(req.params.pendingId, 10);
    if (!Number.isFinite(pendingId)) return res.status(400).json({ error: "Invalid pending assignment id" });

    const staffId = Number(req.body?.staffId);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return res.status(400).json({ error: "staffId is required" });
    }

    const result = await assignPendingService(req, pendingId, staffId);
    return res.status(201).json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const status = msg.includes("not found") ? 404 : msg.includes("already") ? 409 : 400;
    return res.status(status).json({ error: msg });
  }
});

export default router;
