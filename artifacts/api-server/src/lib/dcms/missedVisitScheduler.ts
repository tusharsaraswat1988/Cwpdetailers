import {
  db,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsVisitsTable,
  dcmsMissedVisitLogsTable,
  dcmsStaffAssignmentsTable,
  systemJobsTable,
  vehiclesTable,
} from "@workspace/db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { emitNotificationEvent } from "./notificationEvents";
import { todayStrInIST, dayBoundsIST, isWeeklyOffDay, isDateInPauseRange } from "./dateUtils";

const JOB_TYPE = "dcms_missed_visit_sync";
const IDEMPOTENCY_HOURS = 20;

async function tryAcquireJob(dateStr: string): Promise<{ acquired: boolean; jobId?: number }> {
  const windowStart = new Date(Date.now() - IDEMPOTENCY_HOURS * 60 * 60 * 1000);
  const [existing] = await db.select().from(systemJobsTable)
    .where(and(
      eq(systemJobsTable.jobType, JOB_TYPE),
      eq(systemJobsTable.status, "success"),
      sql`${systemJobsTable.payload}->>'date' = ${dateStr}`,
      sql`${systemJobsTable.lastRunAt} >= ${windowStart}`,
    ))
    .limit(1);

  if (existing) return { acquired: false };

  const [job] = await db.insert(systemJobsTable).values({
    jobType: JOB_TYPE,
    status: "running",
    payload: { date: dateStr },
    startedAt: new Date(),
  }).returning();

  return { acquired: true, jobId: job!.id };
}

async function completeJob(jobId: number, result: Record<string, unknown>) {
  await db.update(systemJobsTable).set({
    status: "success",
    completedAt: new Date(),
    lastRunAt: new Date(),
    payload: result,
  }).where(eq(systemJobsTable.id, jobId));
}

async function failJob(jobId: number, error: string) {
  await db.update(systemJobsTable).set({
    status: "failed",
    completedAt: new Date(),
    lastRunAt: new Date(),
    error,
  }).where(eq(systemJobsTable.id, jobId));
}

export async function isCleaningExpectedToday(
  sub: typeof dcmsSubscriptionsTable.$inferSelect,
  planWeeklyOffs: number,
  dateStr: string,
): Promise<boolean> {
  if (sub.status !== "active") return false;
  if (isDateInPauseRange(dateStr, sub)) return false;
  if (sub.remainingCleanings <= 0) return false;
  if (sub.startDate > dateStr) return false;
  if (isWeeklyOffDay(dateStr, planWeeklyOffs)) return false;
  return true;
}

async function hasCompletedCleaningToday(subscriptionId: number, dateStr: string): Promise<boolean> {
  const { start, end } = dayBoundsIST(dateStr);
  const [visit] = await db.select({ id: dcmsVisitsTable.id }).from(dcmsVisitsTable)
    .where(and(
      eq(dcmsVisitsTable.subscriptionId, subscriptionId),
      eq(dcmsVisitsTable.visitType, "cleaning"),
      eq(dcmsVisitsTable.status, "completed"),
      gte(dcmsVisitsTable.visitTime, start),
      lte(dcmsVisitsTable.visitTime, end),
    ))
    .limit(1);
  return Boolean(visit);
}

/** Idempotent end-of-day missed visit processing for all active subscriptions. */
export async function runMissedVisitScheduler(dateStr?: string) {
  const date = dateStr ?? todayStrInIST();
  const { acquired, jobId } = await tryAcquireJob(date);
  if (!acquired) {
    return { skipped: true, reason: "already_processed", date, marked: 0 };
  }

  try {
    const rows = await db
      .select({
        subscription: dcmsSubscriptionsTable,
        weeklyOffs: dcmsPlansTable.weeklyOffs,
      })
      .from(dcmsSubscriptionsTable)
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .where(eq(dcmsSubscriptionsTable.status, "active"));

    let marked = 0;
    let skipped = 0;

    for (const { subscription, weeklyOffs } of rows) {
      const expected = await isCleaningExpectedToday(subscription, weeklyOffs, date);
      if (!expected) {
        skipped++;
        continue;
      }

      if (await hasCompletedCleaningToday(subscription.id, date)) {
        skipped++;
        continue;
      }

      const inserted = await db.insert(dcmsMissedVisitLogsTable).values({
        subscriptionId: subscription.id,
        visitDate: date,
        reason: "no_cleaning_completed",
      }).onConflictDoNothing().returning();

      if (inserted.length === 0) {
        skipped++;
        continue;
      }

      await db.update(dcmsSubscriptionsTable)
        .set({
          missedCleanings: sql`${dcmsSubscriptionsTable.missedCleanings} + 1`,
          updatedAt: new Date(),
          version: sql`${dcmsSubscriptionsTable.version} + 1`,
        })
        .where(eq(dcmsSubscriptionsTable.id, subscription.id));

      await logDcmsActivity({
        subscriptionId: subscription.id,
        action: "missed_visit_recorded",
        entityType: "missed_visit_log",
        entityId: inserted[0]!.id,
        metadata: { visitDate: date },
      });

      await emitNotificationEvent({
        eventType: "missed_visit",
        entityType: "subscription",
        entityId: subscription.id,
        payload: {
          subscriptionId: subscription.id,
          visitDate: date,
          customerId: subscription.customerId,
          vehicleNumber: (await db.select({ registrationNumber: vehiclesTable.registrationNumber })
            .from(vehiclesTable).where(eq(vehiclesTable.id, subscription.vehicleId)).limit(1))[0]?.registrationNumber,
        },
      });

      marked++;
    }

    if (marked >= 5) {
      await emitNotificationEvent({
        eventType: "high_missed_visits",
        entityType: "system",
        entityId: 0,
        payload: { count: marked, date },
      });
    }

    const result = { date, marked, skipped, processed: rows.length };
    if (jobId) await completeJob(jobId, result);
    return result;
  } catch (err) {
    if (jobId) await failJob(jobId, err instanceof Error ? err.message : "unknown");
    throw err;
  }
}

/** Legacy manual sync — delegates to idempotent scheduler. */
export async function syncMissedVisitsForDate(dateStr: string) {
  return runMissedVisitScheduler(dateStr);
}
