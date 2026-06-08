import { db } from "@workspace/db";
import { subscriptionsTable, bookingsTable, systemJobsTable, notificationsTable, customersTable } from "@workspace/db";
import { eq, and, sql, lte, gte, isNull, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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
 * Recompute servicesRemaining from totalServices and servicesUsed.
 * Prevents invariant drift by always deriving the remaining count.
 */
export async function recomputeServicesRemaining(subscriptionId: number) {
  const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub || sub.totalServices == null) return;
  const remaining = Math.max(0, sub.totalServices - (sub.servicesUsed ?? 0));
  await db.update(subscriptionsTable)
    .set({ servicesRemaining: remaining, updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscriptionId));
}

/**
 * Resolve the userId linked to a customer. Returns undefined if not found.
 */
async function resolveCustomerUserId(customerId: number): Promise<number | undefined> {
  const [customer] = await db.select({ userId: customersTable.userId })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);
  return customer?.userId ?? undefined;
}

/**
 * Mark missed bookings. Bookings with status=scheduled and scheduled_date
 * past the grace period are marked missed, and notifications are created.
 * Also updates subscription status to missed if all active bookings are missed.
 */
export async function markMissed() {
  const now = new Date();
  const todayStrYMD = now.toISOString().split("T")[0];

  // Find scheduled bookings whose scheduled_date has passed.
  // Per-booking grace is applied via actual timestamp comparison below.
  const missedBookings = await db.select({
    id: bookingsTable.id,
    subscriptionId: bookingsTable.subscriptionId,
    customerId: bookingsTable.customerId,
    scheduledDate: bookingsTable.scheduledDate,
    scheduledTime: bookingsTable.scheduledTime,
    branchId: bookingsTable.branchId,
    companyId: bookingsTable.companyId,
    franchiseeId: bookingsTable.franchiseeId,
    graceMinutes: subscriptionsTable.graceMinutes,
  }).from(bookingsTable)
    .leftJoin(subscriptionsTable, eq(bookingsTable.subscriptionId, subscriptionsTable.id))
    .where(and(
      eq(bookingsTable.status, "scheduled"),
      lte(bookingsTable.scheduledDate, todayStrYMD),
    ));

  let updated = 0;
  const notifiedSubIds = new Set<number>();

  for (const b of missedBookings) {
    const graceMins = b.graceMinutes ?? 60;
    // Combine scheduledDate + scheduledTime (or 00:00 if no time) to get actual scheduled datetime
    const scheduledAt = new Date(`${b.scheduledDate}T${b.scheduledTime ?? "00:00"}:00`);
    const graceDeadline = new Date(scheduledAt.getTime() + graceMins * 60 * 1000);

    if (now > graceDeadline) {
      await db.update(bookingsTable)
        .set({ status: "missed", updatedAt: new Date() })
        .where(eq(bookingsTable.id, b.id));
      updated++;

      // Resolve customer userId for notification targeting
      const customerUserId = await resolveCustomerUserId(b.customerId);

      // Create notification for customer (if linked to a user)
      if (customerUserId != null) {
        await db.insert(notificationsTable).values({
          title: "Missed service",
          message: `Your booking #${b.id} was missed (scheduled ${b.scheduledDate} ${b.scheduledTime ?? ""}, grace ${graceMins}m).`,
          type: "subscription_expiry",
          channel: "in_app",
          userId: customerUserId,
          companyId: b.companyId,
          branchId: b.branchId ?? null,
          franchiseeId: b.franchiseeId ?? null,
        });
      }

      // Create notification for branch admin (company/branch scoped)
      if (b.companyId != null) {
        await db.insert(notificationsTable).values({
          title: "Missed service",
          message: `Booking #${b.id} was missed (scheduled ${b.scheduledDate} ${b.scheduledTime ?? ""}, grace ${graceMins}m).`,
          type: "subscription_expiry",
          channel: "in_app",
          companyId: b.companyId,
          branchId: b.branchId ?? null,
          franchiseeId: b.franchiseeId ?? null,
        });
      }

      if (b.subscriptionId) notifiedSubIds.add(b.subscriptionId);
    }
  }

  // Update subscription status to missed if any booking was missed
  for (const subId of notifiedSubIds) {
    const [activeBooking] = await db.select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.subscriptionId, subId),
        eq(bookingsTable.status, "scheduled"),
      ))
      .limit(1);

    if (!activeBooking) {
      await db.update(subscriptionsTable)
        .set({ status: "missed", updatedAt: new Date() })
        .where(eq(subscriptionsTable.id, subId));
    }
  }

  logger.info({ today: todayStrYMD, markedMissed: updated }, "Missed-service check complete");
  return updated;
}

/**
 * Send renewal reminders for subscriptions expiring within reminderDays.
 * Creates notification records for customer + admin.
 */
export async function sendRenewalReminders(reminderDays = 7) {
  const today = new Date();
  const reminderEnd = new Date(today);
  reminderEnd.setDate(reminderEnd.getDate() + reminderDays);
  const endStr = reminderEnd.toISOString().split("T")[0];
  const todayStrYMD = today.toISOString().split("T")[0];

  const targets = await db.select({
    id: subscriptionsTable.id,
    customerId: subscriptionsTable.customerId,
    endDate: subscriptionsTable.endDate,
    companyId: subscriptionsTable.companyId,
    branchId: subscriptionsTable.branchId,
    franchiseeId: subscriptionsTable.franchiseeId,
  }).from(subscriptionsTable)
    .where(and(
      eq(subscriptionsTable.status, "active"),
      lte(subscriptionsTable.endDate, endStr),
      gte(subscriptionsTable.endDate, todayStrYMD),
      isNull(subscriptionsTable.renewalReminderSentAt),
    ));

  let sent = 0;
  for (const sub of targets) {
    await db.update(subscriptionsTable)
      .set({ renewalReminderSentAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, sub.id));
    sent++;

    // Resolve customer userId for proper notification targeting
    const customerUserId = await resolveCustomerUserId(sub.customerId);

    // Create notification for customer (if linked to a user)
    if (customerUserId != null) {
      await db.insert(notificationsTable).values({
        title: "Subscription renewal reminder",
        message: `Your subscription #${sub.id} expires on ${sub.endDate}. Please renew to continue service.`,
        type: "subscription_expiry",
        channel: "in_app",
        userId: customerUserId,
        companyId: sub.companyId,
        branchId: sub.branchId ?? null,
        franchiseeId: sub.franchiseeId ?? null,
      });
    }

    // Create notification for admin (company/branch scoped)
    if (sub.companyId != null) {
      await db.insert(notificationsTable).values({
        title: "Subscription expiring soon",
        message: `Subscription #${sub.id} for customer #${sub.customerId} expires on ${sub.endDate}.`,
        type: "subscription_expiry",
        channel: "in_app",
        companyId: sub.companyId,
        branchId: sub.branchId ?? null,
        franchiseeId: sub.franchiseeId ?? null,
      });
    }
  }

  logger.info({ sent, periodEnd: endStr }, "Renewal reminders dispatched");
  return sent;
}

/**
 * Pause an active subscription. Returns the updated subscription.
 */
export async function pauseSubscription(subscriptionId: number) {
  const [sub] = await db.update(subscriptionsTable)
    .set({ status: "paused", pausedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscriptionId))
    .returning();
  return sub;
}

/**
 * Resume a paused subscription. Returns the updated subscription.
 */
export async function resumeSubscription(subscriptionId: number) {
  const [sub] = await db.update(subscriptionsTable)
    .set({ status: "active", resumedAt: new Date(), updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscriptionId))
    .returning();
  return sub;
}

/**
 * Cancel a subscription with optional remark. Returns the updated subscription.
 */
export async function cancelSubscription(subscriptionId: number, remark?: string) {
  const [sub] = await db.update(subscriptionsTable)
    .set({ status: "cancelled", cancelledAt: new Date(), cancellationRemark: remark ?? null, updatedAt: new Date() })
    .where(eq(subscriptionsTable.id, subscriptionId))
    .returning();
  return sub;
}

/**
 * Daily scheduler tick. Runs missed-service check, renewal reminders, and
 * marks expired subscriptions. Uses system_jobs table for idempotency.
 */
export async function runDailyTick(todayStr?: string) {
  const today = todayStr ?? new Date().toISOString().split("T")[0];

  // Idempotency check: last successful run within 6 hours
  const [existing] = await db.select().from(systemJobsTable)
    .where(and(
      eq(systemJobsTable.jobType, "daily_tick"),
      eq(systemJobsTable.status, "success"),
      sql`${systemJobsTable.lastRunAt} >= ${new Date(Date.now() - SIX_HOURS_MS)}`,
    ))
    .limit(1);

  if (existing) {
    logger.info({ today }, "Daily tick already ran within 6 hours");
    return { skipped: true };
  }

  const [job] = await db.insert(systemJobsTable).values({
    jobType: "daily_tick",
    status: "running",
    runAt: new Date(),
    lastRunAt: new Date(),
    payload: { date: today },
  }).returning();

  try {
    const missedCount = await markMissed();
    const reminderCount = await sendRenewalReminders();

    // Also mark expired subscriptions (past endDate)
    const expired = await db.update(subscriptionsTable)
      .set({ status: "expired", updatedAt: new Date() })
      .where(and(
        eq(subscriptionsTable.status, "active"),
        lte(subscriptionsTable.endDate, today),
      ))
      .returning();

    await db.update(systemJobsTable)
      .set({ status: "success", completedAt: new Date(), lastRunAt: new Date(), payload: { date: today, missedCount, reminderCount, expiredCount: expired.length } })
      .where(eq(systemJobsTable.id, job.id));

    logger.info({ today, missedCount, reminderCount, expiredCount: expired.length }, "Daily tick completed");
    return { missedCount, reminderCount, expiredCount: expired.length };
  } catch (err) {
    await db.update(systemJobsTable)
      .set({ status: "failed", error: String(err), completedAt: new Date(), lastRunAt: new Date() })
      .where(eq(systemJobsTable.id, job.id));
    logger.error({ err, today }, "Daily tick failed");
    throw err;
  }
}
