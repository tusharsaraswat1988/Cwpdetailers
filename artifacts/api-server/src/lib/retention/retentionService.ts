import {
  db,
  dcmsSubscriptionsTable,
  customersTable,
  vehiclesTable,
  citiesTable,
  branchesTable,
} from "@workspace/db";
import { eq, and, sql, desc, gte, inArray, notInArray } from "drizzle-orm";
import { cancelSubscription } from "../dcms/subscriptionService";
import { notifySubscriptionRenewalDue } from "../notifications/dispatcher";

export const CANCELLATION_REASONS = [
  "relocated",
  "quality",
  "price",
  "vehicle_sold",
  "travel",
  "other",
] as const;

export type CancellationReasonType = (typeof CANCELLATION_REASONS)[number];

export async function processCustomerCancellation(input: {
  subscriptionId: number;
  customerId: number;
  reason: CancellationReasonType;
  feedback?: string;
  performedBy: number;
}) {
  const [sub] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId))
    .limit(1);

  if (!sub) throw new Error("Subscription not found");
  if (sub.customerId !== input.customerId) {
    throw new Error("Access denied: You can only cancel your own subscription");
  }

  // Cancel the subscription via DCMS service (handles assignment suspension & audit log)
  await cancelSubscription(input.subscriptionId, input.performedBy, input.reason);

  const now = new Date();
  const churnRiskLevel = input.reason === "quality" ? "high" : "churned";

  const [updated] = await db
    .update(dcmsSubscriptionsTable)
    .set({
      cancellationReason: input.reason,
      cancellationFeedback: input.feedback || null,
      churnRiskLevel,
      cancellationRequestedAt: now,
      updatedAt: now,
    })
    .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId))
    .returning();

  return updated;
}

/**
 * Returns customers eligible for win-back campaigns:
 * Customers who had a subscription that was cancelled or completed within the last 90 days,
 * and currently DO NOT have any active DCMS subscription.
 */
export async function getWinbackCandidates(params: {
  cityId?: number;
  branchId?: number;
  reasonFilter?: string;
  limit?: number;
}) {
  const lim = Math.min(params.limit || 50, 100);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

  // 1. Get customer IDs with currently active subscriptions
  const activeSubRows = await db
    .select({ customerId: dcmsSubscriptionsTable.customerId })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "active"));
  const activeCustomerIds = new Set(activeSubRows.map((r) => r.customerId));

  // 2. Query cancelled or completed subscriptions
  const conditions = [
    inArray(dcmsSubscriptionsTable.status, ["cancelled", "completed"]),
    gte(dcmsSubscriptionsTable.updatedAt, ninetyDaysAgo),
  ];
  if (params.cityId) conditions.push(eq(dcmsSubscriptionsTable.cityId, params.cityId));
  if (params.branchId) conditions.push(eq(dcmsSubscriptionsTable.branchId, params.branchId));
  if (params.reasonFilter) {
    conditions.push(eq(dcmsSubscriptionsTable.cancellationReason, params.reasonFilter));
  }

  const rows = await db
    .select({
      subscriptionId: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      vehicleId: dcmsSubscriptionsTable.vehicleId,
      cityId: dcmsSubscriptionsTable.cityId,
      branchId: dcmsSubscriptionsTable.branchId,
      cancellationReason: dcmsSubscriptionsTable.cancellationReason,
      cancellationFeedback: dcmsSubscriptionsTable.cancellationFeedback,
      cancelledAt: dcmsSubscriptionsTable.cancellationRequestedAt,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .where(and(...conditions))
    .orderBy(desc(dcmsSubscriptionsTable.updatedAt))
    .limit(lim * 2);

  // Filter out any customers who already reactivated another subscription
  const candidates = rows
    .filter((r) => !activeCustomerIds.has(r.customerId))
    .slice(0, lim)
    .map((r) => ({
      ...r,
      suggestedPromotion:
        r.cancellationReason === "price"
          ? "WINBACK_15_PERCENT"
          : r.cancellationReason === "quality"
          ? "SUPERVISOR_ASSURED_TRIAL"
          : "WELCOME_BACK_RENEWAL",
    }));

  return candidates;
}

/**
 * Triggers renewal reminders for subscriptions with <= 3 cleanings remaining.
 */
export async function triggerRenewalReminders(cityId?: number) {
  const conditions = [
    eq(dcmsSubscriptionsTable.status, "active"),
    sql`${dcmsSubscriptionsTable.remainingCleanings} <= 3`,
    sql`${dcmsSubscriptionsTable.remainingCleanings} > 0`,
  ];
  if (cityId) conditions.push(eq(dcmsSubscriptionsTable.cityId, cityId));

  const expiring = await db
    .select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      remainingCleanings: dcmsSubscriptionsTable.remainingCleanings,
    })
    .from(dcmsSubscriptionsTable)
    .where(and(...conditions))
    .limit(50);

  let sent = 0;
  for (const sub of expiring) {
    await notifySubscriptionRenewalDue({
      customerId: sub.customerId,
      subscriptionId: sub.id,
      remainingCleanings: sub.remainingCleanings,
    });
    sent += 1;
  }

  return { eligible: expiring.length, sent };
}
