import { db } from "@workspace/db";
import {
  scheduledJobsTable,
  jobExecutionHistoryTable,
  workerHeartbeatsTable,
  type ScheduledJob,
  type JobExecutionHistory,
  type WorkerHeartbeat,
} from "@workspace/db";
import { eq, and, sql, desc, asc, gte, lte, isNull, or, ilike } from "drizzle-orm";
import { computeNextRun } from "./cronParser";
import type { SchedulerKPIs } from "./schedulerTypes";
import { logger } from "../logger";

export interface CreateJobInput {
  jobKey?: string;
  name: string;
  description?: string;
  jobType: string;
  scheduleType: "one_time" | "recurring_interval" | "recurring_cron";
  cronExpression?: string;
  intervalSeconds?: number;
  timezone?: string;
  payload?: Record<string, any>;
  cityId?: number | null;
  branchId?: number | null;
  runAt?: Date;
  maxRetries?: number;
  createdBy?: number | null;
}

/**
 * Seeds canonical system recurring background jobs if not already present.
 */
export async function seedDefaultScheduledJobs(): Promise<void> {
  const now = new Date();

  const defaultJobs: Array<{
    jobKey: string;
    name: string;
    description: string;
    jobType: string;
    scheduleType: "recurring_cron" | "recurring_interval";
    cronExpression?: string;
    intervalSeconds?: number;
    timezone: string;
    payload: Record<string, any>;
  }> = [
    {
      jobKey: "retention_automations_daily",
      name: "Daily Customer Retention & Re-engagement Automations",
      description: "Evaluates registered no-booking, inactive customer, expiring subscription, and booking follow-up lifecycle automations.",
      jobType: "retention_automation",
      scheduleType: "recurring_cron",
      cronExpression: "0 10 * * *", // 10:00 AM IST daily
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "loyalty_points_expiry_nightly",
      name: "Nightly Loyalty Points Expiry (FIFO Lifecycle)",
      description: "Automated FIFO points expiry against immutable ledger for past-validity earning transactions.",
      jobType: "loyalty_points_expiry",
      scheduleType: "recurring_cron",
      cronExpression: "0 2 * * *", // 02:00 AM IST daily
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "loyalty_expiry_warning_weekly",
      name: "Weekly Customer Points Expiry Warning Alerts",
      description: "Notifies customers whose loyalty points expire within 7 days to encourage booking redemption.",
      jobType: "loyalty_expiry_warning",
      scheduleType: "recurring_cron",
      cronExpression: "0 11 * * 1", // Every Monday at 11:00 AM IST
      timezone: "Asia/Kolkata",
      payload: { daysNotice: 7 },
    },
    {
      jobKey: "campaign_lifecycle_hourly",
      name: "Hourly Marketing CMS Campaign & Coupon Lifecycle",
      description: "Automatically transitions scheduled campaigns to active, completes expired campaigns, and deactivates expired coupons.",
      jobType: "campaign_lifecycle",
      scheduleType: "recurring_interval",
      intervalSeconds: 3600, // Every 1 hour
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "subscription_daily_tick",
      name: "Midnight Subscription Maintenance Tick",
      description: "Runs daily DCMS subscription state transitions, reminders, and daily wash schedule triggers.",
      jobType: "subscription_daily_tick",
      scheduleType: "recurring_cron",
      cronExpression: "0 0 * * *", // 00:00 Midnight IST
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "dcms_missed_visit_eod",
      name: "DCMS End-of-Day Missed Visit Scheduler",
      description: "Scans for unserviced car wash visits at 23:59 IST, records missed visits, and triggers SLA recovery.",
      jobType: "dcms_missed_visit",
      scheduleType: "recurring_cron",
      cronExpression: "59 23 * * *", // 23:59 IST
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "morning_route_notify_daily",
      name: "Morning Route Push Notifications for Technicians",
      description: "Dispatches morning route readiness push notifications to staff cleaners at 06:00 IST.",
      jobType: "morning_route_notify",
      scheduleType: "recurring_cron",
      cronExpression: "0 6 * * *", // 06:00 AM IST
      timezone: "Asia/Kolkata",
      payload: {},
    },
    {
      jobKey: "gps_retention_purge_6h",
      name: "GPS Location Telemetry DPDP Retention Purge",
      description: "Purges raw GPS tracking telemetry older than configured retention period (default: 7 days) in compliance with DPDP.",
      jobType: "gps_retention_purge",
      scheduleType: "recurring_interval",
      intervalSeconds: 21600, // Every 6 hours
      timezone: "Asia/Kolkata",
      payload: {},
    },
  ];

  for (const item of defaultJobs) {
    try {
      const [existing] = await db
        .select({ id: scheduledJobsTable.id })
        .from(scheduledJobsTable)
        .where(eq(scheduledJobsTable.jobKey, item.jobKey))
        .limit(1);

      if (!existing) {
        const nextRunAt = computeNextRun(item, now);
        await db.insert(scheduledJobsTable).values({
          jobKey: item.jobKey,
          name: item.name,
          description: item.description,
          jobType: item.jobType,
          scheduleType: item.scheduleType,
          cronExpression: item.cronExpression ?? null,
          intervalSeconds: item.intervalSeconds ?? null,
          timezone: item.timezone,
          payload: item.payload,
          status: "active",
          isActive: true,
          nextRunAt,
          maxRetries: 3,
        });
        logger.info({ jobKey: item.jobKey, nextRunAt }, "Seeded default scheduled job");
      }
    } catch (err) {
      logger.warn({ err, jobKey: item.jobKey }, "Error seeding default scheduled job (continuing)");
    }
  }
}

/**
 * Retrieve list of scheduled jobs with optional multi-city scoping and status filters.
 */
export async function getScheduledJobs(filter: {
  cityId?: number | null;
  branchId?: number | null;
  status?: string;
  jobType?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  // Tenant scoping: If cityId provided, show jobs for this city OR global jobs (cityId IS NULL)
  if (filter.cityId !== undefined && filter.cityId !== null) {
    conditions.push(or(eq(scheduledJobsTable.cityId, filter.cityId), isNull(scheduledJobsTable.cityId)));
  }

  if (filter.branchId !== undefined && filter.branchId !== null) {
    conditions.push(or(eq(scheduledJobsTable.branchId, filter.branchId), isNull(scheduledJobsTable.branchId)));
  }

  if (filter.status && filter.status !== "all") {
    conditions.push(eq(scheduledJobsTable.status, filter.status));
  }

  if (filter.jobType && filter.jobType !== "all") {
    conditions.push(eq(scheduledJobsTable.jobType, filter.jobType));
  }

  if (filter.search) {
    const s = `%${filter.search.trim()}%`;
    conditions.push(or(ilike(scheduledJobsTable.name, s), ilike(scheduledJobsTable.jobKey, s)));
  }

  const query = db
    .select()
    .from(scheduledJobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(scheduledJobsTable.isActive), asc(scheduledJobsTable.nextRunAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  const jobs = await query;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scheduledJobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    jobs,
    totalCount: countResult?.count ?? 0,
  };
}

/**
 * Retrieve single scheduled job by ID with authorization check.
 */
export async function getScheduledJobById(
  jobId: number,
  cityId?: number | null,
): Promise<ScheduledJob | null> {
  const [job] = await db
    .select()
    .from(scheduledJobsTable)
    .where(eq(scheduledJobsTable.id, jobId))
    .limit(1);

  if (!job) return null;

  // Tenant validation
  if (cityId && job.cityId && job.cityId !== cityId) {
    throw new Error("UNAUTHORIZED_TENANT_ACCESS: You do not have permission to view jobs for another city.");
  }

  return job;
}

/**
 * Create a new scheduled job.
 */
export async function createScheduledJob(input: CreateJobInput): Promise<ScheduledJob> {
  const now = new Date();
  const timezone = input.timezone || "Asia/Kolkata";
  const jobKey = input.jobKey || `custom_${input.jobType}_${Date.now()}`;

  const nextRunAt = computeNextRun(
    {
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression,
      intervalSeconds: input.intervalSeconds,
      timezone,
      runAt: input.runAt,
    },
    now,
  );

  const [job] = await db
    .insert(scheduledJobsTable)
    .values({
      jobKey,
      name: input.name,
      description: input.description ?? null,
      jobType: input.jobType,
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression ?? null,
      intervalSeconds: input.intervalSeconds ?? null,
      timezone,
      payload: input.payload ?? {},
      cityId: input.cityId ?? null,
      branchId: input.branchId ?? null,
      status: "active",
      isActive: true,
      runAt: input.runAt ?? null,
      nextRunAt,
      maxRetries: input.maxRetries ?? 3,
      createdBy: input.createdBy ?? null,
    })
    .returning();

  logger.info({ jobId: job.id, jobKey: job.jobKey, nextRunAt }, "Created scheduled job");
  return job;
}

/**
 * Pause a recurring scheduled job.
 */
export async function pauseScheduledJob(jobId: number, cityId?: number | null): Promise<ScheduledJob> {
  const job = await getScheduledJobById(jobId, cityId);
  if (!job) throw new Error("Job not found");

  const [updated] = await db
    .update(scheduledJobsTable)
    .set({
      status: "paused",
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(scheduledJobsTable.id, jobId))
    .returning();

  logger.info({ jobId, jobKey: job.jobKey }, "Paused scheduled job");
  return updated;
}

/**
 * Resume a paused scheduled job.
 */
export async function resumeScheduledJob(jobId: number, cityId?: number | null): Promise<ScheduledJob> {
  const job = await getScheduledJobById(jobId, cityId);
  if (!job) throw new Error("Job not found");

  const now = new Date();
  const nextRunAt = computeNextRun(job, now);

  const [updated] = await db
    .update(scheduledJobsTable)
    .set({
      status: "active",
      isActive: true,
      nextRunAt,
      consecutiveFailures: 0,
      attemptCount: 0,
      updatedAt: now,
    })
    .where(eq(scheduledJobsTable.id, jobId))
    .returning();

  logger.info({ jobId, jobKey: job.jobKey, nextRunAt }, "Resumed scheduled job");
  return updated;
}

/**
 * Delete / Cancel a scheduled job.
 */
export async function deleteScheduledJob(jobId: number, cityId?: number | null): Promise<void> {
  const job = await getScheduledJobById(jobId, cityId);
  if (!job) throw new Error("Job not found");

  await db.delete(scheduledJobsTable).where(eq(scheduledJobsTable.id, jobId));
  logger.info({ jobId, jobKey: job.jobKey }, "Deleted scheduled job");
}

/**
 * Retrieve execution history logs with pagination and filters.
 */
export async function getExecutionHistory(filter: {
  jobId?: number;
  jobType?: string;
  status?: string;
  cityId?: number | null;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (filter.jobId) {
    conditions.push(eq(jobExecutionHistoryTable.jobId, filter.jobId));
  }

  if (filter.jobType && filter.jobType !== "all") {
    conditions.push(eq(jobExecutionHistoryTable.jobType, filter.jobType));
  }

  if (filter.status && filter.status !== "all") {
    conditions.push(eq(jobExecutionHistoryTable.status, filter.status));
  }

  if (filter.cityId !== undefined && filter.cityId !== null) {
    conditions.push(or(eq(jobExecutionHistoryTable.cityId, filter.cityId), isNull(jobExecutionHistoryTable.cityId)));
  }

  const logs = await db
    .select()
    .from(jobExecutionHistoryTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobExecutionHistoryTable.startedAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobExecutionHistoryTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    logs,
    totalCount: countResult?.count ?? 0,
  };
}

/**
 * Calculate system-wide or city-scoped Scheduler KPIs for admin dashboard.
 */
export async function getSchedulerKPIs(cityId?: number | null): Promise<SchedulerKPIs> {
  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const jobConditions = [];
  const historyConditions = [gte(jobExecutionHistoryTable.startedAt, past24h)];

  if (cityId !== undefined && cityId !== null) {
    jobConditions.push(or(eq(scheduledJobsTable.cityId, cityId), isNull(scheduledJobsTable.cityId)));
    historyConditions.push(or(eq(jobExecutionHistoryTable.cityId, cityId), isNull(jobExecutionHistoryTable.cityId)));
  }

  const jobs = await db
    .select()
    .from(scheduledJobsTable)
    .where(jobConditions.length > 0 ? and(...jobConditions) : undefined);

  const totalJobs = jobs.length;
  const activeJobs = jobs.filter((j) => j.isActive && j.status === "active").length;
  const pausedJobs = jobs.filter((j) => j.status === "paused").length;
  const runningJobs = jobs.filter((j) => j.lastRunStatus === "running").length;

  const overdueJobs = jobs.filter(
    (j) => j.isActive && j.nextRunAt && j.nextRunAt.getTime() < now.getTime() - 5 * 60 * 1000,
  ).length;

  const retryQueueCount = jobs.filter((j) => j.attemptCount > 0 && j.status !== "failed").length;

  // 24h execution metrics
  const [execStats] = await db
    .select({
      successCount: sql<number>`count(case when ${jobExecutionHistoryTable.status} = 'success' then 1 end)::int`,
      failedCount: sql<number>`count(case when ${jobExecutionHistoryTable.status} = 'failed' then 1 end)::int`,
      avgDuration: sql<number>`coalesce(avg(${jobExecutionHistoryTable.durationMs}), 0)::int`,
    })
    .from(jobExecutionHistoryTable)
    .where(and(...historyConditions));

  // Active workers count and last heartbeat
  const workers = await db.select().from(workerHeartbeatsTable);
  const activeWorkers = workers.filter(
    (w) => w.status === "active" && now.getTime() - w.lastHeartbeatAt.getTime() < 3 * 60 * 1000,
  );

  const lastHeartbeat = workers.length > 0
    ? workers.reduce((latest, w) => (w.lastHeartbeatAt > latest ? w.lastHeartbeatAt : latest), workers[0].lastHeartbeatAt).toISOString()
    : null;

  return {
    totalJobs,
    activeJobs,
    pausedJobs,
    runningJobs,
    successJobs24h: execStats?.successCount ?? 0,
    failedJobs24h: execStats?.failedCount ?? 0,
    pendingJobs: jobs.filter((j) => j.isActive && j.nextRunAt && j.nextRunAt <= now).length,
    retryQueueCount,
    overdueJobs,
    avgExecutionDurationMs: execStats?.avgDuration ?? 0,
    activeWorkersCount: activeWorkers.length,
    lastWorkerHeartbeat: lastHeartbeat,
  };
}
