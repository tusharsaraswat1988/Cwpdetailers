import { Router } from "express";
import { isServiceAssignmentsEnabled } from "../lib/assignments/featureFlag";
import {
  assignPendingService,
  assignPendingServiceTasks,
  getAssignmentDetail,
  listAssignedServices,
  listPendingAssignments,
  recordSubstituteExecution,
  reassignAssignment,
  removeAssignment,
  type ServiceTaskType,
} from "../lib/assignments/assignmentService";
import { getAssignmentTimeline } from "../lib/assignments/assignmentTimeline";

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

function errorStatus(msg: string): number {
  if (msg.includes("not found")) return 404;
  if (msg.includes("already") || msg.includes("Duplicate")) return 409;
  if (msg.includes("different branch") || msg.includes("does not allow")) return 400;
  return 400;
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

router.get("/assignments/:id/timeline", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid assignment id" });
    const detail = await getAssignmentDetail(req, id);
    if (!detail) return res.status(404).json({ error: "Assignment not found" });
    const timeline = await getAssignmentTimeline(id);
    return res.json(timeline.map(t => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      fromStaffId: t.fromStaffId,
      toStaffId: t.toStaffId,
      actorId: t.actorId,
      actorName: t.actorName,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    })));
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

    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const rawTasks = req.body?.tasks;
    if (Array.isArray(rawTasks) && rawTasks.length > 0) {
      const tasks = rawTasks.map((t: { taskType?: string; staffId?: number }) => {
        const taskType = t.taskType as ServiceTaskType;
        const staffId = Number(t.staffId);
        if (!taskType || !Number.isFinite(staffId) || staffId <= 0) {
          throw new Error("Each task requires taskType and staffId");
        }
        return { taskType, staffId };
      });
      const result = await assignPendingServiceTasks(req, pendingId, tasks, { notes });
      return res.status(201).json(result);
    }

    const staffId = Number(req.body?.staffId);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return res.status(400).json({ error: "staffId or tasks[] is required" });
    }

    const result = await assignPendingService(req, pendingId, staffId);
    return res.status(201).json(result);
  } catch (e) {
    const msg = (e as Error).message;
    if (/service_assignments_pending_unique|duplicate key.*pending_assignment/i.test(msg)) {
      return res.status(409).json({
        error:
          "This job already has a staff assignment row. For Daily Clean + Wash plans, both task types need separate staff — retry after refreshing the page.",
      });
    }
    if (/duplicate key/i.test(msg)) {
      return res.status(409).json({ error: "This task is already assigned for this job" });
    }
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/assignments/:id/reassign", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid assignment id" });
    const staffId = Number(req.body?.staffId);
    if (!Number.isFinite(staffId) || staffId <= 0) {
      return res.status(400).json({ error: "staffId is required" });
    }
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const result = await reassignAssignment(req, id, staffId, { notes });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/assignments/:id/remove", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid assignment id" });
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const result = await removeAssignment(req, id, { notes });
    return res.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/assignments/substitute", async (req, res) => {
  if (!isServiceAssignmentsEnabled()) {
    return res.status(503).json({ error: "Service assignments are disabled" });
  }
  try {
    const contractId = Number(req.body?.contractId);
    const taskType = req.body?.taskType as ServiceTaskType;
    const substituteStaffId = Number(req.body?.substituteStaffId);
    if (!Number.isFinite(contractId) || !taskType || !Number.isFinite(substituteStaffId)) {
      return res.status(400).json({ error: "contractId, taskType, and substituteStaffId are required" });
    }
    const result = await recordSubstituteExecution(req, {
      contractId,
      taskType,
      substituteStaffId,
      scheduledDate: req.body?.scheduledDate,
      reason: req.body?.reason,
    });
    return res.status(201).json(result);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

export default router;
