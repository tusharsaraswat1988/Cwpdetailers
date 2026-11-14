/**
 * Automated GPS Telemetry Retention Purge Worker (PRIVACY-003 / Phase 18)
 *
 * Automatically purges raw location logs older than configurable retention window (default: 7 days)
 * in compliance with DPDP data minimization principles.
 * Uses PostgreSQL advisory locks for multi-instance deployment safety, batched deletion to prevent
 * table locks, and timezone-safe UTC timestamps.
 */

import { db, serviceExecutionLocationLogsTable } from "@workspace/db";
import { sql, lt } from "drizzle-orm";
import { logger } from "../logger";

const GPS_PURGE_ADVISORY_LOCK_ID = 73829104;
const DEFAULT_RETENTION_DAYS = 7;
const DEFAULT_BATCH_SIZE = 1000;
const SCHEDULER_INTERVAL_MS = 6 * 60 * 60 * 1000; // Run every 6 hours

export type PurgeOptions = {
  retentionDays?: number;
  dryRun?: boolean;
  batchSize?: number;
};

export type PurgeStats = {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastRecordsDeleted: number;
  totalRecordsDeleted: number;
  lastDurationMs: number;
  lastError: string | null;
  retentionDaysConfigured: number;
  schedulerActive: boolean;
};

const stats: PurgeStats = {
  lastRunAt: null,
  lastSuccessAt: null,
  lastRecordsDeleted: 0,
  totalRecordsDeleted: 0,
  lastDurationMs: 0,
  lastError: null,
  retentionDaysConfigured: DEFAULT_RETENTION_DAYS,
  schedulerActive: false,
};

let schedulerTimer: NodeJS.Timeout | null = null;

export function getEffectiveRetentionDays(): number {
  const envVal = process.env.GPS_RETENTION_DAYS;
  if (envVal && !isNaN(Number(envVal)) && Number(envVal) > 0) {
    return Math.floor(Number(envVal));
  }
  return DEFAULT_RETENTION_DAYS;
}

export function getGpsRetentionStats(): PurgeStats {
  return {
    ...stats,
    retentionDaysConfigured: getEffectiveRetentionDays(),
    schedulerActive: schedulerTimer !== null,
  };
}

/**
 * Executes an idempotent, batched purge of raw GPS location telemetry older than cutoff.
 */
export async function purgeOldGpsLocationLogs(opts?: PurgeOptions): Promise<{
  success: boolean;
  recordsDeleted: number;
  cutoffDate: string;
  dryRun: boolean;
  durationMs: number;
  skippedDueToLock?: boolean;
  error?: string;
}> {
  const startTime = Date.now();
  const retentionDays = opts?.retentionDays ?? getEffectiveRetentionDays();
  const dryRun = Boolean(opts?.dryRun);
  const batchSize = opts?.batchSize ?? DEFAULT_BATCH_SIZE;

  // Timezone-safe UTC cutoff calculation
  const cutoffTimeMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffTimeMs);
  const cutoffIso = cutoffDate.toISOString();

  stats.lastRunAt = new Date().toISOString();
  stats.retentionDaysConfigured = retentionDays;

  // In dryRun mode, simply count qualifying records without acquiring locks
  if (dryRun) {
    try {
      const [countRes] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(serviceExecutionLocationLogsTable)
        .where(lt(serviceExecutionLocationLogsTable.recordedAt, cutoffDate));

      const count = Number(countRes?.count ?? 0);
      return {
        success: true,
        recordsDeleted: count,
        cutoffDate: cutoffIso,
        dryRun: true,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        recordsDeleted: 0,
        cutoffDate: cutoffIso,
        dryRun: true,
        durationMs: Date.now() - startTime,
        error: err?.message ?? String(err),
      };
    }
  }

  // Acquire PostgreSQL advisory lock to ensure only one instance executes purge
  let lockAcquired = false;
  try {
    const lockExecRes = await db.execute<{ acquired: boolean }>(
      sql`SELECT pg_try_advisory_lock(${GPS_PURGE_ADVISORY_LOCK_ID}) AS acquired`,
    );
    const lockRes = Array.isArray(lockExecRes) ? lockExecRes[0] : (lockExecRes as any)?.rows?.[0];

    lockAcquired = Boolean((lockRes as any)?.acquired ?? (lockRes as any)?.rows?.[0]?.acquired);
    if (!lockAcquired) {
      logger.info({ lockId: GPS_PURGE_ADVISORY_LOCK_ID }, "GPS retention purge skipped: lock currently held by another worker");
      return {
        success: true,
        recordsDeleted: 0,
        cutoffDate: cutoffIso,
        dryRun: false,
        durationMs: Date.now() - startTime,
        skippedDueToLock: true,
      };
    }

    let totalDeleted = 0;
    let hasMore = true;

    // Batched deletion loop: deletes in bounded chunks to prevent database transaction deadlocks
    while (hasMore) {
      const deleteResult = await db.execute<{ deleted_count: number }>(
        sql`
          WITH to_delete AS (
            SELECT id FROM service_execution_location_logs
            WHERE recorded_at < ${cutoffDate}
            LIMIT ${batchSize}
          )
          DELETE FROM service_execution_location_logs
          WHERE id IN (SELECT id FROM to_delete)
          RETURNING id;
        `,
      );

      const deletedCount = Number(
        (deleteResult as any)?.rowCount ??
        (deleteResult as any)?.rows?.length ??
        0,
      );

      totalDeleted += deletedCount;

      if (deletedCount < batchSize) {
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;
    stats.lastSuccessAt = new Date().toISOString();
    stats.lastRecordsDeleted = totalDeleted;
    stats.totalRecordsDeleted += totalDeleted;
    stats.lastDurationMs = durationMs;
    stats.lastError = null;

    logger.info(
      { totalDeleted, cutoffIso, retentionDays, durationMs },
      "GPS retention purge worker completed successfully",
    );

    return {
      success: true,
      recordsDeleted: totalDeleted,
      cutoffDate: cutoffIso,
      dryRun: false,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    stats.lastDurationMs = durationMs;
    stats.lastError = err?.message ?? String(err);

    logger.error(
      { err, cutoffIso, retentionDays, durationMs },
      "GPS retention purge worker encountered an error",
    );

    return {
      success: false,
      recordsDeleted: 0,
      cutoffDate: cutoffIso,
      dryRun: false,
      durationMs,
      error: stats.lastError,
    };
  } finally {
    if (lockAcquired) {
      try {
        await db.execute(sql`SELECT pg_advisory_unlock(${GPS_PURGE_ADVISORY_LOCK_ID})`);
      } catch (unlockErr) {
        logger.error({ err: unlockErr }, "Failed to release GPS retention purge advisory lock");
      }
    }
  }
}

/**
 * Starts the background timer in the API server process.
 */
export function startGpsRetentionScheduler(intervalMs = SCHEDULER_INTERVAL_MS): void {
  if (schedulerTimer) return;

  stats.schedulerActive = true;
  logger.info({ intervalMs, retentionDays: getEffectiveRetentionDays() }, "Starting GPS retention scheduler");

  // Initial non-blocking run 30 seconds after server boot
  setTimeout(() => {
    purgeOldGpsLocationLogs().catch((err) =>
      logger.error({ err }, "Initial scheduled GPS retention purge failed"),
    );
  }, 30_000);

  schedulerTimer = setInterval(() => {
    purgeOldGpsLocationLogs().catch((err) =>
      logger.error({ err }, "Periodic scheduled GPS retention purge failed"),
    );
  }, intervalMs);
}

export function stopGpsRetentionScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    stats.schedulerActive = false;
    logger.info("GPS retention scheduler stopped");
  }
}
