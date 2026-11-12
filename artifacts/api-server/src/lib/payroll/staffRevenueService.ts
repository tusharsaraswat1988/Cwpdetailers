import {
  db,
  invoicesTable,
  serviceExecutionsTable,
  dcmsSubscriptionsTable,
  dcmsStaffAssignmentsTable,
  dcmsVisitsTable,
  staffTable,
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { logger } from "../logger";

export type StaffRevenueBreakdown = {
  staffId: number;
  periodMonth: string;
  totalRevenue: number;
  executionRevenue: number;
  subscriptionRevenue: number;
  completedJobsCount: number;
  activeSubscriptionsCount: number;
  collectedRevenue?: number;
  uncollectedRevenue?: number;
};

/**
 * Recognized revenue invoice statuses.
 * Excludes 'cancelled', 'draft', and unverified invoices (FIN-004).
 */
export const RECOGNIZED_INVOICE_STATUSES = ["paid", "sent", "overdue"] as const;

/**
 * Calculates authoritative recognized revenue attributed to a staff member for a given month.
 * PRD v4.2 (FIN-004, FIN-005):
 * 1. Excludes draft and cancelled invoices.
 * 2. Directly attributes completed service executions (one-off washes, periodic washes, solar cleaning).
 * 3. Fairly attributes DCMS subscription plan revenue to assigned daily cleaners without double counting.
 */
export async function calculateStaffRevenue(
  staffId: number,
  periodMonth: string, // "YYYY-MM"
): Promise<StaffRevenueBreakdown> {
  // 1. Direct Service Executions Revenue (One-time wash, bundled wash, solar cleaning)
  const executionInvoices = await db
    .select({
      invoiceId: invoicesTable.id,
      totalAmount: invoicesTable.totalAmount,
      executionId: invoicesTable.executionId,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .innerJoin(
      serviceExecutionsTable,
      eq(invoicesTable.executionId, serviceExecutionsTable.id),
    )
    .where(
      and(
        eq(serviceExecutionsTable.assignedStaffId, staffId),
        eq(serviceExecutionsTable.status, "completed"),
        inArray(invoicesTable.status, [...RECOGNIZED_INVOICE_STATUSES]),
        sql`TO_CHAR(${serviceExecutionsTable.scheduledDate}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  let executionRevenue = 0;
  let collectedExecutionRevenue = 0;
  let uncollectedExecutionRevenue = 0;

  for (const inv of executionInvoices) {
    const amt = Number(inv.totalAmount || 0);
    executionRevenue += amt;
    if (inv.status === "paid") {
      collectedExecutionRevenue += amt;
    } else {
      uncollectedExecutionRevenue += amt;
    }
  }

  // 2. DCMS Subscription Plan Revenue (Recurring daily car cleaning)
  // Find all active/recognized subscription invoices issued in this period
  const subscriptionInvoices = await db
    .select({
      invoiceId: invoicesTable.id,
      subscriptionId: invoicesTable.subscriptionId,
      totalAmount: invoicesTable.totalAmount,
      status: invoicesTable.status,
    })
    .from(invoicesTable)
    .where(
      and(
        sql`${invoicesTable.subscriptionId} IS NOT NULL`,
        sql`${invoicesTable.executionId} IS NULL`, // Prevent overlap with execution invoices
        inArray(invoicesTable.status, [...RECOGNIZED_INVOICE_STATUSES]),
        sql`TO_CHAR(${invoicesTable.createdAt}::date, 'YYYY-MM') = ${periodMonth}`,
      ),
    );

  let subscriptionRevenue = 0;
  let collectedSubscriptionRevenue = 0;
  let uncollectedSubscriptionRevenue = 0;
  let activeSubscriptionsCount = 0;

  for (const inv of subscriptionInvoices) {
    if (!inv.subscriptionId) continue;

    // Check if target staff was assigned to this subscription during period
    const assignments = await db
      .select({
        staffId: dcmsStaffAssignmentsTable.staffId,
        isActive: dcmsStaffAssignmentsTable.isActive,
      })
      .from(dcmsStaffAssignmentsTable)
      .where(eq(dcmsStaffAssignmentsTable.subscriptionId, inv.subscriptionId));

    if (assignments.length === 0) continue;

    const assignedStaffIds = assignments.map((a) => a.staffId);
    if (!assignedStaffIds.includes(staffId)) continue;

    activeSubscriptionsCount++;

    // Attribution model:
    // If multiple cleaners share the subscription, apportion proportionally
    // based on completed cleaning visits in the month.
    // If visits haven't occurred or are equal, split equally among assigned cleaners.
    const completedVisits = await db
      .select({
        staffId: dcmsVisitsTable.staffId,
        count: sql<number>`count(*)::int`,
      })
      .from(dcmsVisitsTable)
      .where(
        and(
          eq(dcmsVisitsTable.subscriptionId, inv.subscriptionId),
          eq(dcmsVisitsTable.status, "completed"),
          sql`TO_CHAR(${dcmsVisitsTable.visitDate}::date, 'YYYY-MM') = ${periodMonth}`,
        ),
      )
      .groupBy(dcmsVisitsTable.staffId);

    const totalCompletedVisits = completedVisits.reduce((sum, v) => sum + v.count, 0);
    const staffVisits = completedVisits.find((v) => v.staffId === staffId)?.count ?? 0;

    const invAmount = Number(inv.totalAmount || 0);

    let allocatedAmount = 0;
    if (totalCompletedVisits > 0) {
      // Proportional split based on verified work performed
      const share = staffVisits / totalCompletedVisits;
      allocatedAmount = invAmount * share;
    } else {
      // Equal split among currently assigned cleaners
      const share = 1 / assignedStaffIds.length;
      allocatedAmount = invAmount * share;
    }

    subscriptionRevenue += allocatedAmount;
    if (inv.status === "paid") {
      collectedSubscriptionRevenue += allocatedAmount;
    } else {
      uncollectedSubscriptionRevenue += allocatedAmount;
    }
  }

  const totalRevenue = Math.round((executionRevenue + subscriptionRevenue) * 100) / 100;
  const collectedRevenue = Math.round((collectedExecutionRevenue + collectedSubscriptionRevenue) * 100) / 100;
  const uncollectedRevenue = Math.round((uncollectedExecutionRevenue + uncollectedSubscriptionRevenue) * 100) / 100;

  return {
    staffId,
    periodMonth,
    totalRevenue,
    executionRevenue: Math.round(executionRevenue * 100) / 100,
    subscriptionRevenue: Math.round(subscriptionRevenue * 100) / 100,
    completedJobsCount: executionInvoices.length,
    activeSubscriptionsCount,
    collectedRevenue,
    uncollectedRevenue,
  };
}

/**
 * Returns a fast aggregated map of staffId -> revenueGenerated for leaderboard/admin reporting.
 */
export async function getStaffLeaderboardRevenueMap(
  periodMonth: string,
  branchId?: number,
): Promise<Map<number, number>> {
  const revenueMap = new Map<number, number>();

  // 1. Fetch execution-based revenues
  const executionWhere = [
    eq(serviceExecutionsTable.status, "completed"),
    inArray(invoicesTable.status, [...RECOGNIZED_INVOICE_STATUSES]),
    sql`TO_CHAR(${serviceExecutionsTable.scheduledDate}::date, 'YYYY-MM') = ${periodMonth}`,
  ];
  if (branchId) {
    executionWhere.push(eq(serviceExecutionsTable.branchId, branchId));
  }

  const executionTotals = await db
    .select({
      staffId: serviceExecutionsTable.assignedStaffId,
      total: sql<string>`COALESCE(SUM(${invoicesTable.totalAmount}::numeric), 0)`,
    })
    .from(invoicesTable)
    .innerJoin(
      serviceExecutionsTable,
      eq(invoicesTable.executionId, serviceExecutionsTable.id),
    )
    .where(and(...executionWhere))
    .groupBy(serviceExecutionsTable.assignedStaffId);

  for (const row of executionTotals) {
    if (row.staffId) {
      revenueMap.set(row.staffId, (revenueMap.get(row.staffId) ?? 0) + Number(row.total));
    }
  }

  // 2. Fetch subscription-based revenues
  const subWhere = [
    sql`${invoicesTable.subscriptionId} IS NOT NULL`,
    sql`${invoicesTable.executionId} IS NULL`,
    inArray(invoicesTable.status, [...RECOGNIZED_INVOICE_STATUSES]),
    sql`TO_CHAR(${invoicesTable.createdAt}::date, 'YYYY-MM') = ${periodMonth}`,
  ];
  if (branchId) {
    subWhere.push(eq(invoicesTable.branchId, branchId));
  }

  const subscriptionInvoices = await db
    .select({
      subscriptionId: invoicesTable.subscriptionId,
      totalAmount: invoicesTable.totalAmount,
    })
    .from(invoicesTable)
    .where(and(...subWhere));

  for (const inv of subscriptionInvoices) {
    if (!inv.subscriptionId) continue;
    const completedVisits = await db
      .select({
        staffId: dcmsVisitsTable.staffId,
        count: sql<number>`count(*)::int`,
      })
      .from(dcmsVisitsTable)
      .where(
        and(
          eq(dcmsVisitsTable.subscriptionId, inv.subscriptionId),
          eq(dcmsVisitsTable.status, "completed"),
          sql`TO_CHAR(${dcmsVisitsTable.visitDate}::date, 'YYYY-MM') = ${periodMonth}`,
        ),
      )
      .groupBy(dcmsVisitsTable.staffId);

    const totalCompletedVisits = completedVisits.reduce((sum, v) => sum + v.count, 0);
    const invAmount = Number(inv.totalAmount || 0);

    if (totalCompletedVisits > 0) {
      for (const v of completedVisits) {
        if (v.staffId) {
          const share = invAmount * (v.count / totalCompletedVisits);
          revenueMap.set(v.staffId, (revenueMap.get(v.staffId) ?? 0) + share);
        }
      }
    } else {
      const assignments = await db
        .select({
          staffId: dcmsStaffAssignmentsTable.staffId,
        })
        .from(dcmsStaffAssignmentsTable)
        .where(
          and(
            eq(dcmsStaffAssignmentsTable.subscriptionId, inv.subscriptionId),
            eq(dcmsStaffAssignmentsTable.isActive, true),
          ),
        );

      if (assignments.length > 0) {
        const share = invAmount / assignments.length;
        for (const a of assignments) {
          revenueMap.set(a.staffId, (revenueMap.get(a.staffId) ?? 0) + share);
        }
      }
    }
  }

  // Format to 2 decimal places
  for (const [sId, rev] of revenueMap.entries()) {
    revenueMap.set(sId, Math.round(rev * 100) / 100);
  }

  return revenueMap;
}
