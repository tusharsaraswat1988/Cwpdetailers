import {
  db,
  dcmsSubscriptionsTable,
  dcmsPauseHistoryTable,
  dcmsStaffAssignmentsTable,
  vehiclesTable,
  type DcmsSubscription,
} from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { emitNotificationEvent } from "./notificationEvents";
import { isDateInPauseRange } from "./dateUtils";

async function subscriptionNotifyContext(subscriptionId: number) {
  const [row] = await db.select({
    customerId: dcmsSubscriptionsTable.customerId,
    vehicleNumber: vehiclesTable.registrationNumber,
    staffId: dcmsStaffAssignmentsTable.staffId,
  })
    .from(dcmsSubscriptionsTable)
    .innerJoin(vehiclesTable, eq(vehiclesTable.id, dcmsSubscriptionsTable.vehicleId))
    .leftJoin(dcmsStaffAssignmentsTable, and(
      eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    ))
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);
  return row ?? null;
}

export function isSubscriptionPausedOnDate(sub: Pick<DcmsSubscription, "status" | "pauseStartDate" | "pauseEndDate">, dateStr: string): boolean {
  return isDateInPauseRange(dateStr, sub);
}

async function updateWithVersion(
  subscriptionId: number,
  expectedVersion: number,
  patch: Partial<DcmsSubscription>,
): Promise<DcmsSubscription | null> {
  const [updated] = await db.update(dcmsSubscriptionsTable)
    .set({ ...patch, updatedAt: new Date(), version: expectedVersion + 1 })
    .where(and(
      eq(dcmsSubscriptionsTable.id, subscriptionId),
      eq(dcmsSubscriptionsTable.version, expectedVersion),
    ))
    .returning();
  return updated ?? null;
}

export async function adminPauseSubscription(
  subscriptionId: number,
  pauseStartDate: string,
  pauseEndDate: string,
  pauseReason: string,
  performedBy: number,
) {
  const [sub] = await db.select().from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "completed" || sub.status === "cancelled") {
    throw new Error("Cannot pause inactive subscription");
  }

  const updated = await updateWithVersion(subscriptionId, sub.version, {
    status: "paused",
    pauseStartDate,
    pauseEndDate,
    pauseReason,
  });
  if (!updated) throw new Error("Concurrent update — retry pause");

  const [history] = await db.insert(dcmsPauseHistoryTable).values({
    subscriptionId,
    action: "pause",
    pauseStartDate,
    pauseEndDate,
    pauseReason,
    approvalStatus: "approved",
    performedBy,
  }).returning();

  await logDcmsActivity({
    subscriptionId,
    action: "subscription_paused",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
    metadata: { pauseStartDate, pauseEndDate, pauseReason },
  });

  const ctx = await subscriptionNotifyContext(subscriptionId);
  await emitNotificationEvent({
    eventType: "subscription_paused",
    entityType: "subscription",
    entityId: subscriptionId,
    payload: {
      subscriptionId,
      pauseStartDate,
      pauseEndDate,
      pauseReason,
      customerId: sub.customerId,
      staffId: ctx?.staffId,
      vehicleNumber: ctx?.vehicleNumber,
    },
  });

  return { subscription: updated, history: history! };
}

export async function adminResumeSubscription(subscriptionId: number, performedBy: number) {
  const [sub] = await db.select().from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId)).limit(1);
  if (!sub) throw new Error("Subscription not found");

  const updated = await updateWithVersion(subscriptionId, sub.version, {
    status: "active",
    pauseStartDate: null,
    pauseEndDate: null,
    pauseReason: null,
  });
  if (!updated) throw new Error("Concurrent update — retry resume");

  const [history] = await db.insert(dcmsPauseHistoryTable).values({
    subscriptionId,
    action: "resume",
    performedBy,
    approvalStatus: "approved",
  }).returning();

  await logDcmsActivity({
    subscriptionId,
    action: "subscription_resumed",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
  });

  const ctx = await subscriptionNotifyContext(subscriptionId);
  await emitNotificationEvent({
    eventType: "subscription_resumed",
    entityType: "subscription",
    entityId: subscriptionId,
    payload: {
      subscriptionId,
      customerId: sub.customerId,
      staffId: ctx?.staffId,
      vehicleNumber: ctx?.vehicleNumber,
    },
  });

  return { subscription: updated, history: history! };
}

export async function customerRequestPause(
  subscriptionId: number,
  customerId: number,
  pauseStartDate: string,
  pauseEndDate: string,
  pauseReason: string,
) {
  const [sub] = await db.select().from(dcmsSubscriptionsTable)
    .where(and(
      eq(dcmsSubscriptionsTable.id, subscriptionId),
      eq(dcmsSubscriptionsTable.customerId, customerId),
    )).limit(1);
  if (!sub) throw new Error("Subscription not found");

  const [history] = await db.insert(dcmsPauseHistoryTable).values({
    subscriptionId,
    action: "pause_requested",
    pauseStartDate,
    pauseEndDate,
    pauseReason,
    approvalStatus: "pending",
    performedBy: customerId,
  }).returning();

  await logDcmsActivity({
    subscriptionId,
    action: "pause_requested",
    entityType: "pause_request",
    entityId: history!.id,
    performedBy: customerId,
    metadata: { pauseStartDate, pauseEndDate, pauseReason },
  });

  return history!;
}

export async function approvePauseRequest(historyId: number, performedBy: number) {
  const [req] = await db.select().from(dcmsPauseHistoryTable)
    .where(eq(dcmsPauseHistoryTable.id, historyId)).limit(1);
  if (!req || req.action !== "pause_requested" || req.approvalStatus !== "pending") {
    throw new Error("Pause request not found or already processed");
  }

  await db.update(dcmsPauseHistoryTable)
    .set({ approvalStatus: "approved", action: "pause_approved" })
    .where(eq(dcmsPauseHistoryTable.id, historyId));

  return adminPauseSubscription(
    req.subscriptionId,
    req.pauseStartDate!,
    req.pauseEndDate!,
    req.pauseReason ?? "Customer requested pause",
    performedBy,
  );
}

export async function rejectPauseRequest(historyId: number, performedBy: number, reason?: string) {
  const [req] = await db.select().from(dcmsPauseHistoryTable)
    .where(eq(dcmsPauseHistoryTable.id, historyId)).limit(1);
  if (!req || req.action !== "pause_requested" || req.approvalStatus !== "pending") {
    throw new Error("Pause request not found or already processed");
  }

  await db.update(dcmsPauseHistoryTable)
    .set({ approvalStatus: "rejected", action: "pause_rejected" })
    .where(eq(dcmsPauseHistoryTable.id, historyId));

  await logDcmsActivity({
    subscriptionId: req.subscriptionId,
    action: "pause_rejected",
    entityType: "pause_request",
    entityId: historyId,
    performedBy,
    metadata: { reason },
  });

  return { ok: true };
}

export async function listPauseHistory(subscriptionId: number) {
  return db.select().from(dcmsPauseHistoryTable)
    .where(eq(dcmsPauseHistoryTable.subscriptionId, subscriptionId))
    .orderBy(desc(dcmsPauseHistoryTable.createdAt));
}

export async function listPendingPauseRequests() {
  return db.select({
    history: dcmsPauseHistoryTable,
    subscription: dcmsSubscriptionsTable,
  })
    .from(dcmsPauseHistoryTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsPauseHistoryTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(
      eq(dcmsPauseHistoryTable.action, "pause_requested"),
      eq(dcmsPauseHistoryTable.approvalStatus, "pending"),
    ))
    .orderBy(desc(dcmsPauseHistoryTable.createdAt));
}

/** Auto-resume subscriptions whose pause_end_date has passed. */
export async function autoResumeExpiredPauses(todayStr: string) {
  const expired = await db.select().from(dcmsSubscriptionsTable)
    .where(and(
      eq(dcmsSubscriptionsTable.status, "paused"),
      sql`${dcmsSubscriptionsTable.pauseEndDate} < ${todayStr}`,
    ));

  let resumed = 0;
  for (const sub of expired) {
    await adminResumeSubscription(sub.id, 0);
    resumed++;
  }
  return { resumed };
}
