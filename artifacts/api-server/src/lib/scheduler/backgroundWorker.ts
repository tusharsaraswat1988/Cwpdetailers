import { db } from "@workspace/db";
import {
  scheduledJobsTable,
  jobExecutionHistoryTable,
  workerHeartbeatsTable,
  notificationsTable,
  type ScheduledJob,
} from "@workspace/db";
import { eq, and, sql, asc, lte, isNull, or } from "drizzle-orm";
import { getJobHandler } from "./jobRegistry";
import { computeNextRun } from "./cronParser";
import { sanitizePayload, sanitizeErrorMessage } from "./payloadSanitizer";
import type { JobContext, JobResult, WorkerOptions } from "./schedulerTypes";
import { logger } from "../logger";

const DEFAULT_CONCURRENCY = 5;
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1000; // 5 minutes lease
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15000; // 15 seconds

export class BackgroundWorker {
  public readonly workerId: string;
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly leaseDurationMs: number;
  private readonly heartbeatIntervalMs: number;

  private isRunning = false;
  private isShuttingDown = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private staleRecoveryTimer: NodeJS.Timeout | null = null;
  private activeJobsCount = 0;

  constructor(options?: WorkerOptions) {
    this.workerId = options?.workerId || `worker_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    this.concurrency = options?.concurrency || DEFAULT_CONCURRENCY;
    this.pollIntervalMs = options?.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
    this.leaseDurationMs = options?.leaseDurationMs || DEFAULT_LEASE_DURATION_MS;
    this.heartbeatIntervalMs = options?.heartbeatIntervalMs || DEFAULT_HEARTBEAT_INTERVAL_MS;
  }

  /**
   * Start worker loop and heartbeat timers.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isShuttingDown = false;

    logger.info({ workerId: this.workerId, concurrency: this.concurrency }, "Starting background worker");

    await this.recordHeartbeat("active");

    // Start heartbeat timer
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.recordHeartbeat("active");
      } catch (err) {
        logger.warn({ err, workerId: this.workerId }, "Failed to record worker heartbeat");
      }
    }, this.heartbeatIntervalMs);

    // Start stale job lease recovery timer (runs every 60s)
    this.staleRecoveryTimer = setInterval(async () => {
      try {
        await this.recoverStaleJobs();
      } catch (err) {
        logger.error({ err, workerId: this.workerId }, "Stale job recovery failed");
      }
    }, 60000);

    // Initial stale recovery on startup
    this.recoverStaleJobs().catch((err) => {
      logger.warn({ err }, "Initial startup stale job recovery non-fatal error");
    });

    // Start poll loop
    this.scheduleNextPoll(100);
  }

  /**
   * Graceful shutdown of worker.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) return;
    this.isShuttingDown = true;
    logger.info({ workerId: this.workerId, activeJobs: this.activeJobsCount }, "Stopping background worker gracefully...");

    if (this.pollTimer) clearTimeout(this.pollTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.staleRecoveryTimer) clearInterval(this.staleRecoveryTimer);

    // Wait for in-flight jobs to finish (up to 10 seconds)
    const shutdownTimeout = Date.now() + 10000;
    while (this.activeJobsCount > 0 && Date.now() < shutdownTimeout) {
      await new Promise((r) => setTimeout(r, 200));
    }

    try {
      await this.recordHeartbeat("dead");
    } catch {
      // ignore on shutdown
    }

    this.isRunning = false;
    logger.info({ workerId: this.workerId }, "Background worker stopped");
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning || this.isShuttingDown) return;
    this.pollTimer = setTimeout(async () => {
      try {
        await this.pollAndExecute();
      } catch (err) {
        logger.error({ err, workerId: this.workerId }, "Error in worker poll cycle");
      } finally {
        this.scheduleNextPoll(this.pollIntervalMs);
      }
    }, delayMs);
  }

  /**
   * Poll for ready jobs and dispatch up to available concurrency.
   */
  public async pollAndExecute(): Promise<number> {
    if (!this.isRunning || this.isShuttingDown) return 0;

    const availableSlots = this.concurrency - this.activeJobsCount;
    if (availableSlots <= 0) return 0;

    const claimedJobs = await this.claimReadyJobs(availableSlots);
    if (claimedJobs.length === 0) return 0;

    for (const job of claimedJobs) {
      this.activeJobsCount++;
      // Execute asynchronously in background without blocking the poll loop
      this.executeJob(job)
        .catch((err) => {
          logger.error({ err, jobId: job.id, jobKey: job.jobKey }, "Unhandled error executing job");
        })
        .finally(() => {
          this.activeJobsCount = Math.max(0, this.activeJobsCount - 1);
        });
    }

    return claimedJobs.length;
  }

  /**
   * Atomically claim jobs ready to execute using PostgreSQL FOR UPDATE SKIP LOCKED.
   */
  public async claimReadyJobs(limit: number): Promise<ScheduledJob[]> {
    const now = new Date();
    const leaseExpires = new Date(now.getTime() + this.leaseDurationMs);

    return await db.transaction(async (tx) => {
      // 1. Find jobs ready to run that are not currently leased
      const readyJobs = await tx
        .select()
        .from(scheduledJobsTable)
        .where(
          and(
            eq(scheduledJobsTable.isActive, true),
            eq(scheduledJobsTable.status, "active"),
            lte(scheduledJobsTable.nextRunAt, now),
            or(
              isNull(scheduledJobsTable.leaseExpiresAt),
              lte(scheduledJobsTable.leaseExpiresAt, now),
            ),
          ),
        )
        .orderBy(asc(scheduledJobsTable.nextRunAt))
        .limit(limit)
        .for("update", { skipLocked: true });

      if (readyJobs.length === 0) return [];

      const claimedIds = readyJobs.map((j) => j.id);

      // 2. Mark claimed jobs with worker lease
      await tx
        .update(scheduledJobsTable)
        .set({
          lockedBy: this.workerId,
          lockedAt: now,
          leaseExpiresAt: leaseExpires,
          lastRunStatus: "running",
          updatedAt: now,
        })
        .where(sql`${scheduledJobsTable.id} IN (${sql.join(claimedIds, sql`, `)})`);

      return readyJobs;
    });
  }

  /**
   * Execute a single claimed job.
   */
  public async executeJob(
    job: ScheduledJob,
    options?: { triggerType?: "scheduled" | "manual" | "retry"; dryRun?: boolean },
  ): Promise<JobResult> {
    const startTime = Date.now();
    const triggerType = options?.triggerType || "scheduled";
    const dryRun = Boolean(options?.dryRun);
    const handler = getJobHandler(job.jobType);

    logger.info(
      { jobId: job.id, jobKey: job.jobKey, jobType: job.jobType, triggerType, dryRun },
      "Executing scheduled job",
    );

    // 1. Record execution history entry (running)
    const [historyEntry] = await db
      .insert(jobExecutionHistoryTable)
      .values({
        jobId: job.id,
        jobKey: job.jobKey,
        jobType: job.jobType,
        cityId: job.cityId,
        branchId: job.branchId,
        status: "running",
        attempt: job.attemptCount + 1,
        triggerType,
        startedAt: new Date(startTime),
        workerId: this.workerId,
        sanitizedPayload: sanitizePayload(job.payload),
      })
      .returning();

    const context: JobContext = {
      jobId: job.id,
      jobKey: job.jobKey,
      jobType: job.jobType,
      payload: (job.payload as Record<string, any>) || {},
      cityId: job.cityId,
      branchId: job.branchId,
      triggerType,
      attempt: job.attemptCount + 1,
      workerId: this.workerId,
      dryRun,
      logger,
    };

    let result: JobResult;
    let executionSuccess = false;
    let errorMessage: string | null = null;
    let errorStack: string | undefined;

    try {
      if (!handler) {
        throw new Error(`NO_HANDLER_REGISTERED: No background worker handler registered for jobType '${job.jobType}'`);
      }

      result = await handler(context);
      executionSuccess = result.success !== false;
      if (!executionSuccess && result.error) {
        errorMessage = result.error;
      }
    } catch (err: any) {
      const sanitized = sanitizeErrorMessage(err);
      errorMessage = sanitized.message;
      errorStack = sanitized.stack;
      executionSuccess = false;
      result = {
        success: false,
        error: errorMessage,
      };
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date();

    // 2. Update execution history log
    if (historyEntry) {
      await db
        .update(jobExecutionHistoryTable)
        .set({
          status: executionSuccess ? "success" : "failed",
          completedAt,
          durationMs,
          resultSummary: result.metrics || { message: result.message },
          errorMessage,
          errorStack,
        })
        .where(eq(jobExecutionHistoryTable.id, historyEntry.id));
    }

    // 3. Update scheduled job status and schedule next run
    if (!dryRun) {
      await this.handleJobCompletion(job, executionSuccess, errorMessage, durationMs, completedAt);
    }

    return result;
  }

  /**
   * Updates job record after execution, handles next-run calculation or retry backoff.
   */
  private async handleJobCompletion(
    job: ScheduledJob,
    success: boolean,
    errorMessage: string | null,
    durationMs: number,
    completedAt: Date,
  ): Promise<void> {
    if (success) {
      // Calculate next run time
      let nextRunAt: Date | null = null;
      let newStatus: string = "active";
      let isActive: boolean = true;

      if (job.scheduleType === "one_time") {
        newStatus = "completed";
        isActive = false;
      } else {
        nextRunAt = computeNextRun(job, completedAt);
        if (!nextRunAt) {
          newStatus = "completed";
          isActive = false;
        }
      }

      await db
        .update(scheduledJobsTable)
        .set({
          status: newStatus,
          isActive,
          nextRunAt,
          lastRunAt: completedAt,
          lastRunStatus: "success",
          lastRunDurationMs: durationMs,
          attemptCount: 0,
          consecutiveFailures: 0,
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
          lastError: null,
          errorDetails: null,
          updatedAt: completedAt,
        })
        .where(eq(scheduledJobsTable.id, job.id));

      logger.info(
        { jobId: job.id, jobKey: job.jobKey, nextRunAt, durationMs },
        "Job completed successfully",
      );
    } else {
      // Failure Handling & Exponential Backoff
      const newAttempt = job.attemptCount + 1;
      const newConsecutiveFailures = job.consecutiveFailures + 1;

      if (newAttempt < job.maxRetries) {
        // Calculate exponential backoff with jitter
        // delay = min(maxBackoff, base * 2^attempt + jitter)
        const baseMs = job.backoffBaseSeconds * 1000;
        const maxMs = job.backoffMaxSeconds * 1000;
        const backoffMultiplier = Math.pow(2, newAttempt);
        const jitter = Math.random() * 2000;
        const retryDelayMs = Math.min(maxMs, baseMs * backoffMultiplier + jitter);
        const nextRetryAt = new Date(completedAt.getTime() + retryDelayMs);

        await db
          .update(scheduledJobsTable)
          .set({
            attemptCount: newAttempt,
            consecutiveFailures: newConsecutiveFailures,
            nextRunAt: nextRetryAt,
            lastRunAt: completedAt,
            lastRunStatus: "failed",
            lastRunDurationMs: durationMs,
            lockedBy: null,
            lockedAt: null,
            leaseExpiresAt: null,
            lastError: errorMessage,
            errorDetails: { message: errorMessage, attempt: newAttempt },
            updatedAt: completedAt,
          })
          .where(eq(scheduledJobsTable.id, job.id));

        logger.warn(
          { jobId: job.id, jobKey: job.jobKey, attempt: newAttempt, maxRetries: job.maxRetries, nextRetryAt },
          "Job failed; scheduled retry with exponential backoff",
        );
      } else {
        // Exceeded max retries -> Terminal failure / Dead letter
        let nextRunAt: Date | null = null;
        let newStatus = "failed";

        // If it's a recurring job, keep it in failed or reschedule for the next normal interval
        if (job.scheduleType !== "one_time") {
          nextRunAt = computeNextRun(job, completedAt);
        }

        await db
          .update(scheduledJobsTable)
          .set({
            status: newStatus,
            nextRunAt,
            lastRunAt: completedAt,
            lastRunStatus: "failed",
            lastRunDurationMs: durationMs,
            attemptCount: newAttempt,
            consecutiveFailures: newConsecutiveFailures,
            lockedBy: null,
            lockedAt: null,
            leaseExpiresAt: null,
            lastError: errorMessage,
            errorDetails: { message: errorMessage, terminal: true, attempt: newAttempt },
            updatedAt: completedAt,
          })
          .where(eq(scheduledJobsTable.id, job.id));

        logger.error(
          { jobId: job.id, jobKey: job.jobKey, consecutiveFailures: newConsecutiveFailures },
          "Job reached terminal failure after maximum retries",
        );

        // Alert threshold check: Notify admins when failure threshold is reached
        if (newConsecutiveFailures >= job.alertThresholdFailures) {
          await this.triggerFailureAlert(job, errorMessage, newConsecutiveFailures);
        }
      }
    }
  }

  /**
   * Alerting hook: Dispatches admin notification when a job fails repeatedly.
   */
  private async triggerFailureAlert(
    job: ScheduledJob,
    errorMessage: string | null,
    failuresCount: number,
  ): Promise<void> {
    try {
      await db.insert(notificationsTable).values({
        cityId: job.cityId ?? null,
        branchId: job.branchId ?? null,
        type: "repeated_execution_failure",
        title: `Automation Alert: Job '${job.name}' Failed Repeatedly`,
        message: `Scheduled job '${job.jobKey}' (${job.jobType}) has failed ${failuresCount} consecutive times. Last error: ${errorMessage || "Unknown error"}`,
        channel: "in_app",
        deliveryStatus: "sent",
        actionUrl: `/admin/automation?job=${job.id}`,
        dedupeKey: `alert_job_fail_${job.id}_${Date.now()}`,
      });
      logger.info({ jobId: job.id, jobKey: job.jobKey }, "Dispatched admin failure alert notification");
    } catch (err) {
      logger.warn({ err, jobId: job.id }, "Failed to dispatch admin failure alert");
    }
  }

  /**
   * Stale Job Lease Recovery.
   * Scans for jobs stuck in 'running' with expired leases and releases them.
   */
  public async recoverStaleJobs(): Promise<number> {
    const now = new Date();

    const staleJobs = await db
      .select({
        id: scheduledJobsTable.id,
        jobKey: scheduledJobsTable.jobKey,
        attemptCount: scheduledJobsTable.attemptCount,
        maxRetries: scheduledJobsTable.maxRetries,
      })
      .from(scheduledJobsTable)
      .where(
        and(
          eq(scheduledJobsTable.lastRunStatus, "running"),
          lte(scheduledJobsTable.leaseExpiresAt, now),
        ),
      );

    if (staleJobs.length === 0) return 0;

    logger.warn({ count: staleJobs.length }, "Found stale job leases to recover");

    for (const j of staleJobs) {
      await db
        .update(scheduledJobsTable)
        .set({
          lockedBy: null,
          lockedAt: null,
          leaseExpiresAt: null,
          lastRunStatus: "failed",
          lastError: "STALE_LEASE_RECOVERED: Worker heartbeat expired during execution",
          nextRunAt: now, // eligible for immediate re-pickup
          attemptCount: j.attemptCount + 1,
          updatedAt: now,
        })
        .where(eq(scheduledJobsTable.id, j.id));
    }

    return staleJobs.length;
  }

  /**
   * Heartbeat recorder for worker observability.
   */
  private async recordHeartbeat(status: "active" | "stopping" | "dead"): Promise<void> {
    const now = new Date();
    await db
      .insert(workerHeartbeatsTable)
      .values({
        workerId: this.workerId,
        hostname: process.env.HOSTNAME || "localhost",
        pid: process.pid,
        status,
        concurrency: this.concurrency,
        activeJobsCount: this.activeJobsCount,
        lastHeartbeatAt: now,
        startedAt: now,
        metadata: {
          nodeVersion: process.version,
          platform: process.platform,
        },
      })
      .onConflictDoUpdate({
        target: workerHeartbeatsTable.workerId,
        set: {
          status,
          activeJobsCount: this.activeJobsCount,
          lastHeartbeatAt: now,
        },
      });
  }
}

// Global worker singleton instance
let globalWorker: BackgroundWorker | null = null;

export function getBackgroundWorker(): BackgroundWorker {
  if (!globalWorker) {
    globalWorker = new BackgroundWorker();
  }
  return globalWorker;
}
