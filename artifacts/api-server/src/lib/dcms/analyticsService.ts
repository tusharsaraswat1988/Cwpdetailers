import {
  db,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsStaffAssignmentsTable,
} from "@workspace/db";
import { eq, and, sql, desc, gt, lte } from "drizzle-orm";
import { getFraudMetrics } from "./visitService";
import {
  isRenewalEligible,
  listSubscriptionsWithOutstandingVisits,
  listSubscriptionsWithOutstandingWashes,
} from "./missedVisitService";
import { getFeedbackStats } from "./feedbackService";
import { getStaffPerformanceMetrics } from "./staffPerformanceService";
import { listPendingPauseRequests } from "./pauseService";

export async function getRenewalOperationsStats() {
  const renewalEligible = await db
    .select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      remainingCleanings: dcmsSubscriptionsTable.remainingCleanings,
    })
    .from(dcmsSubscriptionsTable)
    .where(and(
      eq(dcmsSubscriptionsTable.status, "active"),
      eq(dcmsSubscriptionsTable.remainingCleanings, 0),
      eq(dcmsSubscriptionsTable.remainingWashes, 0),
    ));

  const renewalDueSoon = await db
    .select({ id: dcmsSubscriptionsTable.id })
    .from(dcmsSubscriptionsTable)
    .where(and(
      eq(dcmsSubscriptionsTable.status, "active"),
      lte(dcmsSubscriptionsTable.remainingCleanings, 3),
      gt(dcmsSubscriptionsTable.remainingCleanings, 0),
    ));

  const [pausedCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "paused"));

  const [inactiveCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(sql`${dcmsSubscriptionsTable.status} IN ('completed', 'expired', 'cancelled')`);

  const outstandingVisits = await listSubscriptionsWithOutstandingVisits();
  const outstandingWashes = await listSubscriptionsWithOutstandingWashes();
  const pendingPauses = await listPendingPauseRequests();

  return {
    renewalEligible: renewalEligible.length,
    renewalDueSoon: renewalDueSoon.length,
    outstandingVisits: outstandingVisits.length,
    outstandingWashes: outstandingWashes.length,
    pausedSubscriptions: pausedCount?.count ?? 0,
    inactiveSubscriptions: inactiveCount?.count ?? 0,
    pendingPauseRequests: pendingPauses.length,
    renewalEligibleList: renewalEligible.slice(0, 10),
    outstandingVisitList: outstandingVisits.slice(0, 10),
    outstandingWashList: outstandingWashes.slice(0, 10),
    pendingPauseList: pendingPauses.slice(0, 10),
  };
}

export async function getAdminDashboardStats() {
  const [activeSubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "active"));

  const [pendingVisits] = await db
    .select({ total: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.remainingCleanings}), 0)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "active"));

  const [completedVisits] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsVisitsTable)
    .where(eq(dcmsVisitsTable.status, "completed"));

  const renewalOps = await getRenewalOperationsStats();
  const feedback = await getFeedbackStats();
  const performance = await getStaffPerformanceMetrics();

  const [washStats] = await db
    .select({
      used: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.usedWashes}), 0)::int`,
      allocated: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.allocatedWashes}), 0)::int`,
    })
    .from(dcmsSubscriptionsTable);

  const [allocationTotals] = await db
    .select({
      allocated: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.allocatedCleanings}), 0)::int`,
      used: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.usedCleanings}), 0)::int`,
    })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "active"));

  const allocated = allocationTotals?.allocated ?? 0;
  const used = allocationTotals?.used ?? 0;
  const completionPercentage = allocated > 0 ? Math.round((used / allocated) * 100) : 0;

  const fraud = await getFraudMetrics();

  const activeAssignments = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsStaffAssignmentsTable)
    .where(eq(dcmsStaffAssignmentsTable.isActive, true));

  const [missedTotal] = await db
    .select({ total: sql<number>`coalesce(sum(${dcmsSubscriptionsTable.missedCleanings}), 0)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.status, "active"));

  return {
    activeSubscriptions: activeSubs?.count ?? 0,
    pendingVisits: pendingVisits?.total ?? 0,
    completedVisits: completedVisits?.count ?? 0,
    renewalsDue: renewalOps.renewalEligible,
    missedVisits: missedTotal?.total ?? 0,
    completionPercentage,
    washConsumption: {
      used: washStats?.used ?? 0,
      allocated: washStats?.allocated ?? 0,
    },
    activeAssignments: activeAssignments[0]?.count ?? 0,
    fraud,
    feedback,
    renewalOps,
    staffPerformance: performance,
    staffProductivity: performance.staff.map(s => ({
      staffId: s.staffId,
      staffName: s.staffName,
      completed: s.completedVisits,
      rejected: s.rejectedVisits,
    })),
    outstandingCount: renewalOps.outstandingVisits,
    outstandingSubscriptions: renewalOps.outstandingVisitList.map(o => ({
      customerName: o.customerName,
      vehicleNumber: o.vehicleNumber,
      planName: o.planName,
      pendingCleanings: o.pendingCleanings,
      missedCleanings: o.missedCleanings,
    })),
  };
}

export async function getCustomerDashboardStats(customerId: number, vehicleId?: number) {
  const conditions = [eq(dcmsSubscriptionsTable.customerId, customerId)];
  if (vehicleId) conditions.push(eq(dcmsSubscriptionsTable.vehicleId, vehicleId));

  const rows = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(and(...conditions))
    .orderBy(desc(dcmsSubscriptionsTable.createdAt))
    .limit(1);

  const sub = rows[0];
  if (!sub) return null;

  const pendingFeedback = await import("./feedbackService").then(m => m.getPendingFeedbackForCustomer(customerId));

  return {
    planId: sub.planId,
    subscriptionId: sub.id,
    subscriptionType: sub.subscriptionType,
    allocatedCleanings: sub.allocatedCleanings,
    usedCleanings: sub.usedCleanings,
    remainingCleanings: sub.remainingCleanings,
    missedCleanings: sub.missedCleanings,
    pendingCleanings: sub.remainingCleanings,
    completedCleanings: sub.usedCleanings,
    allocatedWashes: sub.allocatedWashes,
    usedWashes: sub.usedWashes,
    remainingWashes: sub.remainingWashes,
    status: sub.status,
    pauseStartDate: sub.pauseStartDate,
    pauseEndDate: sub.pauseEndDate,
    renewalEligible: isRenewalEligible(sub),
    renewalBlocked: !isRenewalEligible(sub),
    pendingFeedbackVisits: pendingFeedback,
  };
}
