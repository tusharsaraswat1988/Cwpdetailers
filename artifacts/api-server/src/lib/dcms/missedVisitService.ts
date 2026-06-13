import { db, dcmsSubscriptionsTable, dcmsPlansTable, customersTable, vehiclesTable } from "@workspace/db";
import { eq, and, desc, gt } from "drizzle-orm";
import type { DcmsSubscription } from "@workspace/db";

export { runMissedVisitScheduler, syncMissedVisitsForDate, isCleaningExpectedToday } from "./missedVisitScheduler";

/** Pending cleanings = visits still owed on the subscription. */
export function getPendingCleanings(sub: Pick<DcmsSubscription, "remainingCleanings">): number {
  return sub.remainingCleanings;
}

export function getCompletedCleanings(sub: Pick<DcmsSubscription, "usedCleanings">): number {
  return sub.usedCleanings;
}

export function getVisitStats(sub: Pick<DcmsSubscription, "allocatedCleanings" | "usedCleanings" | "remainingCleanings" | "missedCleanings">) {
  return {
    allocatedCleanings: sub.allocatedCleanings,
    completedCleanings: sub.usedCleanings,
    pendingCleanings: sub.remainingCleanings,
    missedCleanings: sub.missedCleanings,
  };
}

/** Renewal allowed only when no pending cleanings or washes remain. */
export function isRenewalEligible(sub: Pick<DcmsSubscription, "remainingCleanings" | "remainingWashes" | "status">): boolean {
  return sub.remainingCleanings === 0 && sub.remainingWashes === 0 && sub.status === "active";
}

export async function listSubscriptionsWithOutstandingVisits() {
  return db
    .select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      pendingCleanings: dcmsSubscriptionsTable.remainingCleanings,
      missedCleanings: dcmsSubscriptionsTable.missedCleanings,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(and(
      eq(dcmsSubscriptionsTable.status, "active"),
      gt(dcmsSubscriptionsTable.remainingCleanings, 0),
    ))
    .orderBy(desc(dcmsSubscriptionsTable.remainingCleanings));
}

export async function listSubscriptionsWithOutstandingWashes() {
  return db
    .select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      remainingWashes: dcmsSubscriptionsTable.remainingWashes,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(and(
      eq(dcmsSubscriptionsTable.status, "active"),
      gt(dcmsSubscriptionsTable.remainingWashes, 0),
    ))
    .orderBy(desc(dcmsSubscriptionsTable.remainingWashes));
}
