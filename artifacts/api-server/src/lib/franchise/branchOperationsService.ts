import {
  db,
  branchesTable,
  citiesTable,
  franchiseesTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsOperationalExceptionsTable,
  staffTable,
  invoicesTable,
  paymentsTable,
  customersTable,
  vehiclesTable,
  type Branch,
} from "@workspace/db";
import { eq, and, sql, desc, or } from "drizzle-orm";
import { todayStrInIST } from "../dcms/dateUtils";

export type PrioritizedAction = {
  id: string;
  priority: "high" | "medium" | "low";
  category: "exception" | "renewal" | "operations" | "financial";
  title: string;
  description: string;
  actionUrl: string;
  count?: number;
};

export type CleanerWorkload = {
  staffId: number;
  staffName: string;
  assignedVisits: number;
  completedVisits: number;
  cnaVisits: number;
  completionRate: number;
};

export type BranchOperationsDashboard = {
  branch: {
    id: number;
    name: string;
    code: string | null;
    city: string;
    cityName: string;
    isCompanyOperated: boolean;
    franchiseeName: string | null;
    status: string;
    isActive: boolean;
  };
  metrics: {
    activeSubscriptions: number;
    todayAssigned: number;
    todayCompleted: number;
    todayPending: number;
    todayCna: number;
    todayMissed: number;
    completionRate: number;
    openExceptionsCount: number;
    renewalsDueCount: number;
    invoicedRevenue: number;
    collectedRevenue: number;
    outstandingDues: number;
    collectionEfficiency: number;
  };
  cleaners: CleanerWorkload[];
  prioritizedActions: PrioritizedAction[];
};

export async function getBranchOperationsDashboard(
  branchId: number,
): Promise<BranchOperationsDashboard> {
  const [branch] = await db
    .select({
      id: branchesTable.id,
      name: branchesTable.name,
      code: branchesTable.code,
      city: branchesTable.city,
      cityId: branchesTable.cityId,
      cityName: citiesTable.name,
      isCompanyOperated: branchesTable.isCompanyOperated,
      franchiseeName: franchiseesTable.name,
      status: branchesTable.status,
      isActive: branchesTable.isActive,
    })
    .from(branchesTable)
    .leftJoin(citiesTable, eq(branchesTable.cityId, citiesTable.id))
    .leftJoin(franchiseesTable, eq(branchesTable.franchiseeId, franchiseesTable.id))
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch) throw new Error("Branch not found");

  const today = todayStrInIST();

  // 1. Active Subscriptions
  const [subRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(and(eq(dcmsSubscriptionsTable.branchId, branchId), eq(dcmsSubscriptionsTable.status, "active")));

  const activeSubscriptions = subRes?.count ?? 0;

  // 2. Today's DCMS Visits in this Branch
  const todayVisits = await db
    .select({
      status: dcmsVisitsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(
      and(
        eq(dcmsSubscriptionsTable.branchId, branchId),
        eq(dcmsVisitsTable.visitDate, today),
        eq(dcmsVisitsTable.visitType, "cleaning"),
      ),
    )
    .groupBy(dcmsVisitsTable.status);

  let todayCompleted = 0;
  let todayCna = 0;
  let todayMissed = 0;
  for (const v of todayVisits) {
    if (v.status === "completed") todayCompleted += v.count;
    else if (v.status === "car_not_available") todayCna += v.count;
    else if (v.status === "rejected") todayMissed += v.count;
  }

  const todayPending = Math.max(0, activeSubscriptions - todayCompleted - todayCna);
  const completionRate =
    activeSubscriptions > 0 ? Math.round((todayCompleted / activeSubscriptions) * 100) : 0;

  // 3. Open Exceptions in this branch
  const [excRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsOperationalExceptionsTable)
    .where(
      and(
        or(
          eq(dcmsOperationalExceptionsTable.branchId, branchId),
          sql`${dcmsOperationalExceptionsTable.subscriptionId} IN (SELECT id FROM dcms_subscriptions WHERE branch_id = ${branchId})`,
        ),
        eq(dcmsOperationalExceptionsTable.status, "open"),
      ),
    );

  const openExceptionsCount = excRes?.count ?? 0;

  // 4. Renewals Due (<= 3 cleanings left)
  const [renewalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(
      and(
        eq(dcmsSubscriptionsTable.branchId, branchId),
        eq(dcmsSubscriptionsTable.status, "active"),
        sql`remaining_cleanings <= 3`,
      ),
    );

  const renewalsDueCount = renewalRes?.count ?? 0;

  // 5. Financials
  const [invRes] = await db
    .select({
      invoicedTotal: sql<number>`COALESCE(SUM(total_amount::numeric), 0)::float`,
      dueTotal: sql<number>`COALESCE(SUM(due_amount::numeric), 0)::float`,
    })
    .from(invoicesTable)
    .where(and(eq(invoicesTable.branchId, branchId), sql`status <> 'cancelled'`));

  const [payRes] = await db
    .select({
      collectedTotal: sql<number>`COALESCE(SUM(amount::numeric), 0)::float`,
    })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.branchId, branchId), eq(paymentsTable.status, "completed")));

  const invoicedRevenue = Math.round((invRes?.invoicedTotal ?? 0) * 100) / 100;
  const collectedRevenue = Math.round((payRes?.collectedTotal ?? 0) * 100) / 100;
  const outstandingDues = Math.round((invRes?.dueTotal ?? 0) * 100) / 100;
  const collectionEfficiency =
    invoicedRevenue > 0 ? Math.min(100, Math.round((collectedRevenue / invoicedRevenue) * 100)) : 100;

  // 6. Cleaners on Duty
  const branchStaff = await db
    .select({
      staffId: staffTable.id,
      staffName: staffTable.name,
    })
    .from(staffTable)
    .where(and(eq(staffTable.branchId, branchId), eq(staffTable.isActive, true)));

  const cleaners: CleanerWorkload[] = [];
  for (const s of branchStaff) {
    const visits = await db
      .select({
        status: dcmsVisitsTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(dcmsVisitsTable)
      .where(and(eq(dcmsVisitsTable.staffId, s.staffId), eq(dcmsVisitsTable.visitDate, today)))
      .groupBy(dcmsVisitsTable.status);

    let completed = 0;
    let cna = 0;
    for (const v of visits) {
      if (v.status === "completed") completed += v.count;
      if (v.status === "car_not_available") cna += v.count;
    }

    const assigned = activeSubscriptions > 0 ? Math.ceil(activeSubscriptions / Math.max(1, branchStaff.length)) : 0;
    const rate = assigned > 0 ? Math.min(100, Math.round((completed / assigned) * 100)) : 100;

    cleaners.push({
      staffId: s.staffId,
      staffName: s.staffName,
      assignedVisits: assigned,
      completedVisits: completed,
      cnaVisits: cna,
      completionRate: rate,
    });
  }

  // 7. Prioritized Next Actions
  const prioritizedActions: PrioritizedAction[] = [];

  if (openExceptionsCount > 0) {
    prioritizedActions.push({
      id: "action-exceptions",
      priority: "high",
      category: "exception",
      title: "Review Operational Exceptions",
      description: `${openExceptionsCount} open exceptions (gate denied, vehicle moved, or complaint) require supervisor resolution.`,
      actionUrl: "/admin/societies",
      count: openExceptionsCount,
    });
  }

  if (todayCna > 0) {
    prioritizedActions.push({
      id: "action-cna",
      priority: "high",
      category: "operations",
      title: "Car Not Available (CNA) Verification",
      description: `${todayCna} vehicles were reported unavailable by cleaners today. Verify photographic evidence.`,
      actionUrl: "/admin/societies",
      count: todayCna,
    });
  }

  if (renewalsDueCount > 0) {
    prioritizedActions.push({
      id: "action-renewals",
      priority: "medium",
      category: "renewal",
      title: "Follow Up Expiring Subscriptions",
      description: `${renewalsDueCount} customers have 3 or fewer cleanings remaining. Send renewal reminders.`,
      actionUrl: "/admin/daily-cleaning/subscriptions",
      count: renewalsDueCount,
    });
  }

  if (todayPending > 0) {
    prioritizedActions.push({
      id: "action-pending-visits",
      priority: "medium",
      category: "operations",
      title: "Monitor Today's Route Execution",
      description: `${todayPending} of ${activeSubscriptions} scheduled cleaning visits are pending completion.`,
      actionUrl: "/admin/societies",
      count: todayPending,
    });
  }

  if (outstandingDues > 0) {
    prioritizedActions.push({
      id: "action-dues",
      priority: "low",
      category: "financial",
      title: "Outstanding Dues Reconciliation",
      description: `₹${outstandingDues.toLocaleString("en-IN")} remains overdue for this branch across invoices.`,
      actionUrl: "/admin/payments/ledger",
    });
  }

  return {
    branch: {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      city: branch.city,
      cityName: branch.cityName ?? branch.city,
      isCompanyOperated: branch.isCompanyOperated,
      franchiseeName: branch.franchiseeName,
      status: branch.status,
      isActive: branch.isActive,
    },
    metrics: {
      activeSubscriptions,
      todayAssigned: activeSubscriptions,
      todayCompleted,
      todayPending,
      todayCna,
      todayMissed,
      completionRate,
      openExceptionsCount,
      renewalsDueCount,
      invoicedRevenue,
      collectedRevenue,
      outstandingDues,
      collectionEfficiency,
    },
    cleaners,
    prioritizedActions,
  };
}
