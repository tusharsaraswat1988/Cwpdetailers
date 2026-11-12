import {
  db,
  customersTable,
  vehiclesTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsOperationalExceptionsTable,
  invoicesTable,
  paymentsTable,
  branchesTable,
  citiesTable,
  franchiseesTable,
  staffTable,
} from "@workspace/db";
import { eq, and, sql, gte, lte, desc, inArray } from "drizzle-orm";
import { todayStrInIST } from "../dcms/dateUtils";

export type UnifiedPlatformAnalytics = {
  operational: {
    activeCustomers: number;
    activeVehicles: number;
    activeSubscriptions: number;
    todayAssigned: number;
    todayCompleted: number;
    todayPending: number;
    todayCna: number;
    todayMissed: number;
    overallCompletionRate: number;
    openExceptionsCount: number;
    resolvedExceptionsCount: number;
  };
  financial: {
    invoicedRevenue: number;
    collectedRevenue: number;
    outstandingDues: number;
    collectionRate: number;
  };
  cityBreakdown: Array<{
    cityId: number;
    cityName: string;
    activeCustomers: number;
    activeSubscriptions: number;
    invoicedRevenue: number;
    collectedRevenue: number;
  }>;
  branchBreakdown: Array<{
    branchId: number;
    branchName: string;
    cityId: number | null;
    cityName: string;
    isCompanyOperated: boolean;
    franchiseeName: string | null;
    activeSubscriptions: number;
    staffCount: number;
    collectedRevenue: number;
    completionRate: number;
  }>;
  retention: {
    newCustomersThisMonth: number;
    renewalsDueThisMonth: number;
    cancelledSubscriptionsThisMonth: number;
  };
};

export type AnalyticsFilter = {
  cityId?: number;
  branchId?: number;
  franchiseeId?: number;
  companyId?: number;
};

export async function getUnifiedPlatformAnalytics(
  filters?: AnalyticsFilter,
): Promise<UnifiedPlatformAnalytics> {
  const today = todayStrInIST();

  // 1. Build Scoped Conditions for Subscriptions
  const subConditions = [eq(dcmsSubscriptionsTable.status, "active")];
  if (filters?.cityId) subConditions.push(eq(dcmsSubscriptionsTable.cityId, filters.cityId));
  if (filters?.branchId) subConditions.push(eq(dcmsSubscriptionsTable.branchId, filters.branchId));
  if (filters?.franchiseeId) subConditions.push(eq(dcmsSubscriptionsTable.franchiseeId, filters.franchiseeId));
  if (filters?.companyId) subConditions.push(eq(dcmsSubscriptionsTable.companyId, filters.companyId));

  const [activeSubResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(and(...subConditions));

  const activeSubCount = activeSubResult?.count ?? 0;

  // 2. Active Customers & Vehicles
  const custConditions = [];
  if (filters?.cityId) custConditions.push(eq(customersTable.cityId, filters.cityId));
  if (filters?.branchId) custConditions.push(eq(customersTable.branchId, filters.branchId));
  if (filters?.companyId) custConditions.push(eq(customersTable.companyId, filters.companyId));

  const [custResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(custConditions.length ? and(...custConditions) : undefined);

  const [vehResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(vehiclesTable);

  // 3. Today's DCMS Visits
  const visitConditions = [
    eq(dcmsVisitsTable.visitDate, today),
    eq(dcmsVisitsTable.visitType, "cleaning"),
  ];

  const todayVisits = await db
    .select({
      status: dcmsVisitsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dcmsVisitsTable)
    .where(and(...visitConditions))
    .groupBy(dcmsVisitsTable.status);

  let todayCompleted = 0;
  let todayCna = 0;
  let todayRejected = 0;
  for (const v of todayVisits) {
    if (v.status === "completed") todayCompleted += v.count;
    else if (v.status === "car_not_available") todayCna += v.count;
    else if (v.status === "rejected") todayRejected += v.count;
  }

  const todayPending = Math.max(0, activeSubCount - todayCompleted - todayCna);
  const completionRate =
    activeSubCount > 0 ? Math.round((todayCompleted / activeSubCount) * 100) : 0;

  // 4. Operational Exceptions
  const excConditions = [];
  if (filters?.cityId) excConditions.push(eq(dcmsOperationalExceptionsTable.cityId, filters.cityId));

  const exceptionCounts = await db
    .select({
      status: dcmsOperationalExceptionsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(dcmsOperationalExceptionsTable)
    .where(excConditions.length ? and(...excConditions) : undefined)
    .groupBy(dcmsOperationalExceptionsTable.status);

  let openExc = 0;
  let resolvedExc = 0;
  for (const e of exceptionCounts) {
    if (e.status === "open" || e.status === "investigating") openExc += e.count;
    else if (e.status === "resolved") resolvedExc += e.count;
  }

  // 5. Financial KPIs
  const invoiceConditions = [sql`status <> 'cancelled'`];
  if (filters?.branchId) invoiceConditions.push(eq(invoicesTable.branchId, filters.branchId));
  if (filters?.companyId) invoiceConditions.push(eq(invoicesTable.companyId, filters.companyId));

  const [invResult] = await db
    .select({
      invoicedTotal: sql<number>`COALESCE(SUM(total_amount::numeric), 0)::float`,
      dueTotal: sql<number>`COALESCE(SUM(due_amount::numeric), 0)::float`,
    })
    .from(invoicesTable)
    .where(and(...invoiceConditions));

  const paymentConditions = [eq(paymentsTable.status, "completed")];
  if (filters?.branchId) paymentConditions.push(eq(paymentsTable.branchId, filters.branchId));
  if (filters?.companyId) paymentConditions.push(eq(paymentsTable.companyId, filters.companyId));

  const [payResult] = await db
    .select({
      collectedTotal: sql<number>`COALESCE(SUM(amount::numeric), 0)::float`,
    })
    .from(paymentsTable)
    .where(and(...paymentConditions));

  const invoicedRevenue = Math.round((invResult?.invoicedTotal ?? 0) * 100) / 100;
  const collectedRevenue = Math.round((payResult?.collectedTotal ?? 0) * 100) / 100;
  const outstandingDues = Math.round((invResult?.dueTotal ?? 0) * 100) / 100;
  const financialCollectionRate =
    invoicedRevenue > 0 ? Math.min(100, Math.round((collectedRevenue / invoicedRevenue) * 100)) : 100;

  // 6. City Breakdown
  const cities = await db
    .select({
      cityId: citiesTable.id,
      cityName: citiesTable.name,
    })
    .from(citiesTable)
    .where(eq(citiesTable.isActive, true));

  const cityBreakdown = [];
  for (const c of cities) {
    const [subC] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(dcmsSubscriptionsTable)
      .where(and(eq(dcmsSubscriptionsTable.cityId, c.cityId), eq(dcmsSubscriptionsTable.status, "active")));

    const [custC] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customersTable)
      .where(eq(customersTable.cityId, c.cityId));

    cityBreakdown.push({
      cityId: c.cityId,
      cityName: c.cityName,
      activeCustomers: custC?.count ?? 0,
      activeSubscriptions: subC?.count ?? 0,
      invoicedRevenue: 0,
      collectedRevenue: 0,
    });
  }

  // 7. Branch Breakdown
  const branches = await db
    .select({
      branchId: branchesTable.id,
      branchName: branchesTable.name,
      cityId: branchesTable.cityId,
      cityName: citiesTable.name,
      isCompanyOperated: branchesTable.isCompanyOperated,
      franchiseeName: franchiseesTable.name,
      staffCount: sql<number>`(SELECT COUNT(*)::int FROM staff s WHERE s.branch_id = ${branchesTable.id})`,
      activeSubscriptions: sql<number>`(SELECT COUNT(*)::int FROM dcms_subscriptions sub WHERE sub.branch_id = ${branchesTable.id} AND sub.status = 'active')`,
      collectedRevenue: sql<number>`COALESCE((SELECT SUM(p.amount::numeric) FROM payments p WHERE p.branch_id = ${branchesTable.id} AND p.status = 'completed'), 0)::float`,
    })
    .from(branchesTable)
    .leftJoin(citiesTable, eq(branchesTable.cityId, citiesTable.id))
    .leftJoin(franchiseesTable, eq(branchesTable.franchiseeId, franchiseesTable.id))
    .where(eq(branchesTable.isActive, true));

  const branchBreakdown = branches.map((b) => ({
    branchId: b.branchId,
    branchName: b.branchName,
    cityId: b.cityId,
    cityName: b.cityName ?? "Unknown",
    isCompanyOperated: b.isCompanyOperated,
    franchiseeName: b.franchiseeName,
    activeSubscriptions: b.activeSubscriptions,
    staffCount: b.staffCount,
    collectedRevenue: Math.round(b.collectedRevenue * 100) / 100,
    completionRate: 100,
  }));

  // 8. Retention & Lifecycle Metrics
  const [newCust] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customersTable)
    .where(sql`DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW())`);

  const [renewalsDue] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(
      and(
        eq(dcmsSubscriptionsTable.status, "active"),
        sql`remaining_cleanings <= 3`,
      ),
    );

  const [cancelledSubs] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(
      and(
        eq(dcmsSubscriptionsTable.status, "cancelled"),
        sql`DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', NOW())`,
      ),
    );

  return {
    operational: {
      activeCustomers: custResult?.count ?? 0,
      activeVehicles: vehResult?.count ?? 0,
      activeSubscriptions: activeSubCount,
      todayAssigned: activeSubCount,
      todayCompleted,
      todayPending,
      todayCna,
      todayMissed: todayRejected,
      overallCompletionRate: completionRate,
      openExceptionsCount: openExc,
      resolvedExceptionsCount: resolvedExc,
    },
    financial: {
      invoicedRevenue,
      collectedRevenue,
      outstandingDues,
      collectionRate: financialCollectionRate,
    },
    cityBreakdown,
    branchBreakdown,
    retention: {
      newCustomersThisMonth: newCust?.count ?? 0,
      renewalsDueThisMonth: renewalsDue?.count ?? 0,
      cancelledSubscriptionsThisMonth: cancelledSubs?.count ?? 0,
    },
  };
}
