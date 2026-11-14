import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  scheduledJobsTable,
  jobExecutionHistoryTable,
  workerHeartbeatsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  getScheduledJobs,
  getScheduledJobById,
  createScheduledJob,
  pauseScheduledJob,
  resumeScheduledJob,
  deleteScheduledJob,
  getExecutionHistory,
  getSchedulerKPIs,
} from "../lib/scheduler/jobSchedulerService";
import { getBackgroundWorker } from "../lib/scheduler/backgroundWorker";
import { listRegisteredJobTypes } from "../lib/scheduler/jobRegistry";
import { sanitizePayload } from "../lib/scheduler/payloadSanitizer";
import { logger } from "../lib/logger";

export const automationRouter = Router();

// Middleware: Admin role check
function requireAutomationAdmin(req: Request, res: Response, next: any) {
  const user = req.user;
  if (!user || !["superadmin", "central_admin", "admin", "city_admin", "branch_manager", "manager"].includes(user.role)) {
    return res.status(403).json({ error: "Access denied: Automation Operations Center requires administrator privileges." });
  }
  next();
}

// Scope resolution helper
function resolveUserScope(req: Request): { isPlatformAdmin: boolean; cityId?: number; branchId?: number } {
  const user = req.user!;
  const isPlatformAdmin = ["superadmin", "central_admin", "admin"].includes(user.role);
  const cityId = !isPlatformAdmin && req.scope?.cityId ? req.scope.cityId : undefined;
  const branchId = !isPlatformAdmin && req.scope?.branchId ? req.scope.branchId : undefined;

  return { isPlatformAdmin, cityId, branchId };
}

// ============================================================================
// 1. Dashboard KPIs & Overview
// ============================================================================
automationRouter.get("/automation/dashboard", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = resolveUserScope(req);
    const kpis = await getSchedulerKPIs(cityId);
    return res.json(kpis);
  } catch (err: any) {
    logger.error({ err }, "Error fetching automation KPIs");
    return res.status(500).json({ error: err.message || "Failed to fetch automation KPIs" });
  }
});

// ============================================================================
// 2. Scheduled Jobs Directory
// ============================================================================
automationRouter.get("/automation/jobs", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = resolveUserScope(req);
    const queryCityId = req.query.cityId ? Number(req.query.cityId) : cityId;

    // Reject non-platform admins querying another city
    if (cityId && queryCityId && cityId !== queryCityId) {
      return res.status(403).json({ error: "Access denied: Cannot query jobs for another city." });
    }

    const status = req.query.status as string | undefined;
    const jobType = req.query.jobType as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await getScheduledJobs({
      cityId: queryCityId,
      status,
      jobType,
      search,
      limit,
      offset,
    });

    const sanitizedJobs = result.jobs.map((j) => ({
      ...j,
      payload: sanitizePayload(j.payload),
    }));

    return res.json({
      jobs: sanitizedJobs,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    logger.error({ err }, "Error listing scheduled jobs");
    return res.status(500).json({ error: err.message || "Failed to list scheduled jobs" });
  }
});

// ============================================================================
// 3. Registered Job Types & Manifest
// ============================================================================
automationRouter.get("/automation/job-types", requireAuth, requireAutomationAdmin, async (_req: Request, res: Response) => {
  const types = listRegisteredJobTypes();
  const manifest = types.map((t) => {
    switch (t) {
      case "retention_automation":
        return { type: t, label: "Customer Retention & Lifecycle Automations", description: "Evaluates registered no-booking, inactive customer, subscription expiring, and follow-up triggers." };
      case "loyalty_points_expiry":
        return { type: t, label: "Loyalty Points FIFO Expiry", description: "Audits expired earning credits and creates immutable ledger debit expiries." };
      case "loyalty_expiry_warning":
        return { type: t, label: "Points Expiry Warning Notifications", description: "Dispatches proactive warning messages to customers nearing points validity expiry." };
      case "campaign_lifecycle":
        return { type: t, label: "Marketing CMS Campaign & Coupon Lifecycle", description: "Manages scheduled campaign activation, completion, and coupon deactivation." };
      case "subscription_daily_tick":
        return { type: t, label: "Subscription Daily Maintenance", description: "DCMS subscription state changes, daily wash triggers, and pause auto-resume." };
      case "dcms_missed_visit":
        return { type: t, label: "DCMS Missed Visit Sweeper", description: "Scans unserviced daily cleaning visits at end of day (23:59 IST)." };
      case "morning_route_notify":
        return { type: t, label: "Morning Route Push Notifications", description: "Dispatches morning route readiness push alerts to field cleaners (06:00 IST)." };
      case "gps_retention_purge":
        return { type: t, label: "GPS Telemetry DPDP Retention Purge", description: "Purges location tracking logs older than configured retention window." };
      default:
        return { type: t, label: t, description: "Custom background worker job." };
    }
  });

  return res.json(manifest);
});

// ============================================================================
// 4. Job Details
// ============================================================================
automationRouter.get("/automation/jobs/:id", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const job = await getScheduledJobById(jobId, cityId);
    if (!job) {
      return res.status(404).json({ error: "Scheduled job not found." });
    }

    // Fetch recent 10 execution history logs
    const history = await getExecutionHistory({ jobId, limit: 10 });

    return res.json({
      job: {
        ...job,
        payload: sanitizePayload(job.payload),
      },
      recentExecutions: history.logs.map((h) => ({
        ...h,
        sanitizedPayload: sanitizePayload(h.sanitizedPayload),
      })),
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error retrieving scheduled job");
    return res.status(500).json({ error: err.message || "Failed to retrieve scheduled job" });
  }
});

// ============================================================================
// 5. Create Scheduled Job
// ============================================================================
automationRouter.post("/automation/jobs", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const { isPlatformAdmin, cityId } = resolveUserScope(req);
    const body = req.body;

    if (!body.name || !body.jobType || !body.scheduleType) {
      return res.status(400).json({ error: "Missing required fields: name, jobType, and scheduleType are required." });
    }

    // City scoping
    const targetCityId = isPlatformAdmin ? (body.cityId ? Number(body.cityId) : null) : cityId;

    const job = await createScheduledJob({
      jobKey: body.jobKey,
      name: body.name,
      description: body.description,
      jobType: body.jobType,
      scheduleType: body.scheduleType,
      cronExpression: body.cronExpression,
      intervalSeconds: body.intervalSeconds ? Number(body.intervalSeconds) : undefined,
      timezone: body.timezone || "Asia/Kolkata",
      payload: body.payload || {},
      cityId: targetCityId,
      branchId: body.branchId ? Number(body.branchId) : null,
      runAt: body.runAt ? new Date(body.runAt) : undefined,
      maxRetries: body.maxRetries ? Number(body.maxRetries) : 3,
      createdBy: req.user?.id,
    });

    return res.status(201).json({
      job: {
        ...job,
        payload: sanitizePayload(job.payload),
      },
    });
  } catch (err: any) {
    logger.error({ err }, "Error creating scheduled job");
    return res.status(400).json({ error: err.message || "Failed to create scheduled job" });
  }
});

// ============================================================================
// 6. Update Scheduled Job
// ============================================================================
automationRouter.put("/automation/jobs/:id", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const existing = await getScheduledJobById(jobId, cityId);
    if (!existing) {
      return res.status(404).json({ error: "Scheduled job not found." });
    }

    const body = req.body;
    const now = new Date();

    const [updated] = await db
      .update(scheduledJobsTable)
      .set({
        name: body.name ?? existing.name,
        description: body.description !== undefined ? body.description : existing.description,
        payload: body.payload !== undefined ? body.payload : existing.payload,
        cronExpression: body.cronExpression !== undefined ? body.cronExpression : existing.cronExpression,
        intervalSeconds: body.intervalSeconds !== undefined ? Number(body.intervalSeconds) : existing.intervalSeconds,
        timezone: body.timezone ?? existing.timezone,
        maxRetries: body.maxRetries !== undefined ? Number(body.maxRetries) : existing.maxRetries,
        updatedBy: req.user?.id,
        updatedAt: now,
      })
      .where(eq(scheduledJobsTable.id, jobId))
      .returning();

    return res.json({
      job: {
        ...updated,
        payload: sanitizePayload(updated.payload),
      },
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error updating scheduled job");
    return res.status(400).json({ error: err.message || "Failed to update scheduled job" });
  }
});

// ============================================================================
// 7. Manual Execution ("Run Now")
// ============================================================================
automationRouter.post("/automation/jobs/:id/run-now", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const job = await getScheduledJobById(jobId, cityId);
    if (!job) {
      return res.status(404).json({ error: "Scheduled job not found." });
    }

    const worker = getBackgroundWorker();
    const result = await worker.executeJob(job, { triggerType: "manual", dryRun: false });

    return res.json({
      jobId,
      jobKey: job.jobKey,
      success: result.success,
      result,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error executing job manually");
    return res.status(500).json({ error: err.message || "Failed to execute job" });
  }
});

// ============================================================================
// 8. Dry-Run Simulation Preview
// ============================================================================
automationRouter.post("/automation/jobs/:id/dry-run", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const job = await getScheduledJobById(jobId, cityId);
    if (!job) {
      return res.status(404).json({ error: "Scheduled job not found." });
    }

    const worker = getBackgroundWorker();
    const result = await worker.executeJob(job, { triggerType: "manual", dryRun: true });

    return res.json({
      jobId,
      jobKey: job.jobKey,
      dryRun: true,
      result,
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error running dry-run simulation");
    return res.status(500).json({ error: err.message || "Failed to run dry-run simulation" });
  }
});

// ============================================================================
// 9. Pause Scheduled Job
// ============================================================================
automationRouter.post("/automation/jobs/:id/pause", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const paused = await pauseScheduledJob(jobId, cityId);
    return res.json({
      job: {
        ...paused,
        payload: sanitizePayload(paused.payload),
      },
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error pausing job");
    return res.status(400).json({ error: err.message || "Failed to pause job" });
  }
});

// ============================================================================
// 10. Resume Scheduled Job
// ============================================================================
automationRouter.post("/automation/jobs/:id/resume", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const resumed = await resumeScheduledJob(jobId, cityId);
    return res.json({
      job: {
        ...resumed,
        payload: sanitizePayload(resumed.payload),
      },
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error resuming job");
    return res.status(400).json({ error: err.message || "Failed to resume job" });
  }
});

// ============================================================================
// 11. Retry Failed Job
// ============================================================================
automationRouter.post("/automation/jobs/:id/retry", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    const job = await getScheduledJobById(jobId, cityId);
    if (!job) {
      return res.status(404).json({ error: "Scheduled job not found." });
    }

    const now = new Date();
    const [retried] = await db
      .update(scheduledJobsTable)
      .set({
        status: "active",
        isActive: true,
        nextRunAt: now,
        attemptCount: 0,
        consecutiveFailures: 0,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(scheduledJobsTable.id, jobId))
      .returning();

    return res.json({
      message: "Job retry scheduled immediately.",
      job: {
        ...retried,
        payload: sanitizePayload(retried.payload),
      },
    });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error triggering retry");
    return res.status(400).json({ error: err.message || "Failed to trigger retry" });
  }
});

// ============================================================================
// 12. Delete / Cancel Scheduled Job
// ============================================================================
automationRouter.delete("/automation/jobs/:id", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
    const { cityId } = resolveUserScope(req);

    await deleteScheduledJob(jobId, cityId);
    return res.json({ message: "Job cancelled and removed successfully." });
  } catch (err: any) {
    if (err.message && err.message.includes("UNAUTHORIZED_TENANT_ACCESS")) {
      return res.status(403).json({ error: err.message });
    }
    logger.error({ err }, "Error deleting job");
    return res.status(400).json({ error: err.message || "Failed to delete job" });
  }
});

// ============================================================================
// 13. Execution History Logs
// ============================================================================
automationRouter.get("/automation/executions", requireAuth, requireAutomationAdmin, async (req: Request, res: Response) => {
  try {
    const { cityId } = resolveUserScope(req);
    const queryCityId = req.query.cityId ? Number(req.query.cityId) : cityId;

    if (cityId && queryCityId && cityId !== queryCityId) {
      return res.status(403).json({ error: "Access denied: Cannot view logs for another city." });
    }

    const jobId = req.query.jobId ? Number(req.query.jobId) : undefined;
    const jobType = req.query.jobType as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const result = await getExecutionHistory({
      jobId,
      jobType,
      status,
      cityId: queryCityId,
      limit,
      offset,
    });

    const sanitizedLogs = result.logs.map((log) => ({
      ...log,
      sanitizedPayload: sanitizePayload(log.sanitizedPayload),
    }));

    return res.json({
      logs: sanitizedLogs,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    logger.error({ err }, "Error retrieving execution history");
    return res.status(500).json({ error: err.message || "Failed to retrieve execution history" });
  }
});

// ============================================================================
// 14. Active Workers & Heartbeat Health
// ============================================================================
automationRouter.get("/automation/workers", requireAuth, requireAutomationAdmin, async (_req: Request, res: Response) => {
  try {
    const workers = await db
      .select()
      .from(workerHeartbeatsTable)
      .orderBy(desc(workerHeartbeatsTable.lastHeartbeatAt))
      .limit(20);

    const now = Date.now();
    const enrichedWorkers = workers.map((w) => {
      const msSinceHeartbeat = now - w.lastHeartbeatAt.getTime();
      let healthStatus: "healthy" | "lagging" | "dead" = "healthy";

      if (msSinceHeartbeat > 60000) healthStatus = "dead";
      else if (msSinceHeartbeat > 25000) healthStatus = "lagging";

      return {
        ...w,
        healthStatus,
        msSinceHeartbeat,
      };
    });

    return res.json(enrichedWorkers);
  } catch (err: any) {
    logger.error({ err }, "Error fetching worker statuses");
    return res.status(500).json({ error: err.message || "Failed to fetch worker statuses" });
  }
});
