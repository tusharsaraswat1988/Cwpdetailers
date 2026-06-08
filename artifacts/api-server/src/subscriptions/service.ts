import { db } from "@workspace/db";
import { subscriptionsTable, bookingsTable, systemJobsTable } from "@workspace/db";
import { eq, and, sql, lte, gte, isNull, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * Decrement subscription counters when a booking completes.
 * Called from the booking transition handler (status -> completed).
 */
export async function decrementOnCompletion(subscriptionId: number) {
  if (!subscriptionId) return;
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub) return;

  const used = (sub.servicesUsed ?? 0) + 1;
  const remaining = sub.totalServices != null ? Math.max(0, sub.totalServices - used) : null;

  const updateData: Record<string, unknown> = {
    servicesUsed: used,
    updatedAt: new Date(),
  };
  if (remaining !== null) {
    updateData.servicesRemaining = remaining;
    if (remaining === 0) {
      updateData.status = "expired";
    }
  }

  await db.update(subscriptionsTable).set(updateData).where(eq(subscriptionsTable.id, subscriptionId));
  logger.info({ subscriptionId, used, remaining }, "Subscription counters decremented");
}

/**
 * Recompute nextDueDate based on frequencyDays and the most recent completed booking.
 */
export async function recomputeNextDueDate(subscriptionId: number) {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub || !sub.frequencyDays) return;

  const [lastBooking] = await db.select({ completedAt: bookingsTable.completedAt })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.subscriptionId, subscriptionId),
      eq(bookingsTable.status, "completed"),
      isNotNull(bookingsTable.completedAt),
    ))
    .orderBy(sql`${bookingsTable.completedAt} desc`)
    .limit(1);

  const baseDate = lastBooking?.completedAt ? new Date(lastBooking.completedAt) : new Date(sub.startDate);
  const nextDue = new Date(baseDate);
  nextDue.setDate(nextDue.getDate() + sub.frequencyDays);

  await db.update(subscriptionsTable)
    .set({ nextDueDate: nextDue.toISOString().split("T")[0], updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscriptionId));

  logger.info({ subscriptionId, nextDueDate: nextDue.toISOString().split("T")[0] }, "Next due date recomputed");
}

/**
 * Mark subscriptions as missed if a scheduled booking was due and not completed
 * within the grace period. This is the core of the missed-service alert.
 */
export async function markMissed(todayStr?: string) {
  const today = todayStr ? new Date(todayStr) : new Date();
  const todayStrYMD = today.toISOString().split("T")[0];

  // Find active subscriptions whose nextDueDate has passed and no completed booking
  // within grace period. We check bookings that are either completed after due+grace
  // or still pending/scheduled.
  const missedSubs = await db.select({
    id: subscriptionsTable.id,
    nextDueDate: subscriptionsTable.nextDueDate,
    graceMinutes: subscriptionsTable.graceMinutes,
  }).from(subscriptionsTable)
    .where(and(
      eq(subscriptionsTable.status, "active"),
      isNotNull(subscriptionsTable.nextDueDate),
      lte(subscriptionsTable.nextDueDate, todayStrYMD),
    ));

  let updated = 0;
  for (const sub of missedSubs) {
    const graceDays = Math.ceil((sub.graceMinutes ?? 60) / 1440);
    const graceDeadline = new Date(sub.nextDueDate!);
    graceDeadline.setDate(graceDeadline.getDate() + graceDays);

    if (today > graceDeadline) {
      // Check if any completed booking exists after nextDueDate
      const [completedAfter] = await db.select({ id: bookingsTable.id })
        .from(bookingsTable)
        .where(and(
          eq(bookingsTable.subscriptionId, sub.id),
          eq(bookingsTable.status, "completed"),
          gte(bookingsTable.scheduledDate, sub.nextDueDate!),
        ))
        .limit(1);

      if (!completedAfter) {
        await db.update(subscriptionsTable)
          .set({ status: "missed", updatedAt: new Date() })
          .where(eq(subscriptionsTable.id, sub.id));
        updated++;
      }
    }
  }

  logger.info({ today: todayStrYMD, markedMissed: updated }, "Missed-service check complete");
  return updated;
}

/**
 * Send renewal reminders for subscriptions expiring within 7 days that haven't
 * had a reminder sent yet. This logs a notification; integrate WhatsApp API for live dispatch.
 */
export async function sendRenewalReminders(todayStr?: string) {
  const today = todayStr ? new Date(todayStr) : new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  const sevenStr = sevenDaysLater.toISOString().split("T")[0];

  const targets = await db.select({
    id: subscriptionsTable.id,
    customerId: subscriptionsTable.customerId,
    endDate: subscriptionsTable.endDate,
  }).from(subscriptionsTable)
    .where(and(
      eq(subscriptionsTable.status, "active"),
      lte(subscriptionsTable.endDate, sevenStr),
      gte(subscriptionsTable.endDate, today.toISOString().split("T")[0]),
      isNull(subscriptionsTable.renewalReminderSentAt),
    ));

  let sent = 0;
  for (const sub of targets) {
    await db.update(subscriptionsTable)
      .set({ renewalReminderSentAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id));
    sent++;
  }

  logger.info({ sent, periodEnd: sevenStr }, "Renewal reminders dispatched");
  return sent;
}

/**
 * Daily scheduler tick. Runs missed-service check, renewal reminders, and
 * marks expired subscriptions. Uses system_jobs table for idempotency.
 */
export async function runDailyTick(todayStr?: string) {
  const today = todayStr ?? new Date().toISOString().split("T")[0];

  // Idempotency check
  const [existing] = await db.select().from(systemJobsTable)
    .where(and(
      eq(systemJobsTable.jobType, "daily_tick"),
      sql`${systemJobsTable.createdAt}::date = ${today}::date`,
      eq(systemJobsTable.status, "success"),
    ))
    .limit(1);

  if (existing) {
    logger.info({ today }, "Daily tick already ran today");
    return { skipped: true };
  }

  const [job] = await db.insert(systemJobsTable).values({
    jobType: "daily_tick",
    status: "running",
    runAt: new Date(),
    payload: { date: today },
  }).returning();

  try {
    const missedCount = await markMissed(today);
    const reminderCount = await sendRenewalReminders(today);

    // Also mark expired subscriptions (past endDate)
    const expired = await db.update(subscriptionsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(
        eq(subscriptionsTable.status, "active"),
        lte(subscriptionsTable.endDate, today),
      ))
      .returning();

    await db.update(systemJobsTable)
      .set({ status: "success", completedAt: new Date(), payload: { date: today, missedCount, reminderCount, expiredCount: expired.length } })
      .where(eq(systemJobsTable.id, job.id));

    logger.info({ today, missedCount, reminderCount, expiredCount: expired.length }, "Daily tick completed");
    return { missedCount, reminderCount, expiredCount: expired.length };
  } catch (err) {
    await db.update(systemJobsTable)
      .set({ status: "failed", error: String(err), completedAt: new Date() })
      .where(eq(systemJobsTable.id, job.id));
    logger.error({ err, today }, "Daily tick failed");
    throw err;
  }
}
