import { Router } from "express";
import { isJobOrchestrationEnabled } from "../lib/job-orchestration/featureFlag";
import {
  listJobs,
  getJobDetail,
  getJobTimeline,
  reopenJob,
  escalateJob,
  changeJobPriority,
  approveJob,
  markJobReadyForBilling,
  cancelJob,
  changeJobOwnership,
  setJobDependency,
  type JobListFilter,
} from "../lib/job-orchestration/jobOrchestrationService";
import type { JobOpsStatus, JobPriority } from "@workspace/db";

const router = Router();

function disabled(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => unknown } }) {
  return res.status(503).json({ error: "Job orchestration is disabled" });
}

function errorStatus(msg: string): number {
  if (msg.includes("not found")) return 404;
  if (msg.includes("already") || msg.includes("cannot") || msg.includes("must be") || msg.includes("require")) {
    return 409;
  }
  return 400;
}

router.get("/jobs", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const filter: JobListFilter = {
      queue: typeof req.query.queue === "string"
        ? req.query.queue as JobListFilter["queue"]
        : "all",
      priority: typeof req.query.priority === "string"
        ? req.query.priority as JobPriority
        : undefined,
      opsStatus: typeof req.query.opsStatus === "string"
        ? req.query.opsStatus as JobOpsStatus
        : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : undefined,
    };
    const data = await listJobs(req, filter);
    return res.json({ data, total: data.length });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.get("/jobs/:id/timeline", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const timeline = await getJobTimeline(req, id);
    return res.json(timeline);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.get("/jobs/:id", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const job = await getJobDetail(req, id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json(job);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

router.post("/jobs/:id/reopen", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const job = await reopenJob(req, id, reason);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/escalate", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const job = await escalateJob(req, id, reason);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/priority", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const priority = typeof req.body?.priority === "string" ? req.body.priority : "";
    const job = await changeJobPriority(req, id, priority);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/approve", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
    const job = await approveJob(req, id, notes);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/ready-for-billing", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const job = await markJobReadyForBilling(req, id);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/cancel", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const job = await cancelJob(req, id, reason);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/ownership", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const raw = req.body?.opsOwnerUserId;
    const opsOwnerUserId = raw === null || raw === undefined || raw === ""
      ? null
      : Number(raw);
    if (opsOwnerUserId != null && !Number.isFinite(opsOwnerUserId)) {
      return res.status(400).json({ error: "Invalid opsOwnerUserId" });
    }
    const job = await changeJobOwnership(req, id, opsOwnerUserId);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

router.post("/jobs/:id/dependency", async (req, res) => {
  if (!isJobOrchestrationEnabled()) return disabled(req, res);
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid job id" });
    const raw = req.body?.dependsOnExecutionId;
    const dependsOnExecutionId = raw === null || raw === undefined || raw === ""
      ? null
      : Number(raw);
    if (dependsOnExecutionId != null && !Number.isFinite(dependsOnExecutionId)) {
      return res.status(400).json({ error: "Invalid dependsOnExecutionId" });
    }
    const job = await setJobDependency(req, id, dependsOnExecutionId);
    return res.json(job);
  } catch (e) {
    const msg = (e as Error).message;
    return res.status(errorStatus(msg)).json({ error: msg });
  }
});

export default router;
