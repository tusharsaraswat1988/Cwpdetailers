import {
  db,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsVisitsTable,
  dcmsStaffAssignmentsTable,
  vehiclesTable,
  solarSitesTable,
  subscriptionsTable,
  servicesTable,
  customerEntitlementsTable,
  entitlementConsumptionLogTable,
  catalogPackagesTable,
  bookingsTable,
  serviceAddonsTable,
  staffTable,
  customersTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import {
  buildCustomerProfile,
  activeProductLinesFromContracts,
  type CustomerProfile,
} from "@workspace/customer-model";
import { isRenewalEligible } from "../dcms/missedVisitService";
import { getPlanAddonsForPlans } from "../dcms/planAddonService";
import {
  syncCustomerContracts,
  listCustomerContracts,
  countActiveCustomerContracts as registryActiveCount,
} from "../contracts/contractRegistry";

export type CustomerServicesHub = {
  customerId: number;
  profile: CustomerProfile;
  counts: {
    dailyCleaning: number;
    entitlements: number;
    legacySubscriptions: number;
    solarSites: number;
    activeContracts: number;
  };
  dailyCleaning: Array<{
    id: number;
    vehicleId: number;
    vehicleLabel: string;
    planName: string;
    status: string;
    startDate: string;
    remainingCleanings: number;
    remainingWashes: number;
    allocatedCleanings: number;
    allocatedWashes: number;
    assignedStaffName: string | null;
    renewalEligible: boolean;
    bundledAddons: string[];
  }>;
  entitlements: Array<{
    id: number;
    entitlementType: string;
    serviceName: string | null;
    packageName: string | null;
    remainingCredits: number;
    totalCredits: number;
    validFrom: string;
    validUntil: string;
    status: string;
  }>;
  legacySubscriptions: Array<{
    id: number;
    type: string;
    status: string;
    serviceName: string | null;
    vehicleId: number | null;
    solarSiteId: number | null;
    startDate: string;
    endDate: string;
    servicesRemaining: number | null;
    totalServices: number | null;
    nextDueDate: string | null;
  }>;
  solarSites: Array<{
    id: number;
    address: string;
    panelCount: number;
    lastCleanedDate: string | null;
    nextServiceDate: string | null;
    locationLabel: string | null;
    completedBookings: number;
    activeAmcEntitlements: number;
  }>;
  recentWork: Array<{
    id: string;
    source: "dcms_visit" | "booking" | "entitlement";
    workType: string;
    assetLabel: string | null;
    status: string;
    occurredAt: string;
    staffName: string | null;
    addonLabel: string | null;
  }>;
  contracts: Array<{
    id: number;
    productLine: string;
    sourceSystem: string;
    sourceId: number;
    status: string;
    assetType: string | null;
    assetId: number | null;
    assetLabel: string | null;
    validFrom: string | null;
    validUntil: string | null;
    startDate: string | null;
    endDate: string | null;
    serviceName: string;
    serviceLocationId: number | null;
    serviceLocationLabel: string | null;
    linkedAssetId: number | null;
    linkedAssetLabel: string | null;
    summary: Record<string, unknown>;
  }>;
};

export async function getCustomerServicesHub(customerId: number): Promise<CustomerServicesHub> {
  await syncCustomerContracts(customerId);

  const [
    customerRow,
    vehicleCountRow,
    dcmsRows,
    entitlementRows,
    legacySubs,
    solarRows,
    dcmsVisits,
    bookingRows,
    entitlementUsage,
    contracts,
    solarBookingCounts,
    solarAmcBySite,
    dcmsAssignments,
  ] = await Promise.all([
    db.select({
      status: customersTable.status,
      legacySegment: customersTable.legacySegment,
      reactivatedAt: customersTable.reactivatedAt,
      gstin: customersTable.gstin,
      billingName: customersTable.billingName,
    }).from(customersTable).where(eq(customersTable.id, customerId)).limit(1),

    db.select({ count: sql<number>`count(*)::int` })
      .from(vehiclesTable)
      .where(eq(vehiclesTable.customerId, customerId)),

    db.select({
      sub: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
    })
      .from(dcmsSubscriptionsTable)
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
      .where(eq(dcmsSubscriptionsTable.customerId, customerId))
      .orderBy(desc(dcmsSubscriptionsTable.createdAt)),

    db.select({
      ent: customerEntitlementsTable,
      serviceName: servicesTable.name,
      packageName: catalogPackagesTable.name,
    })
      .from(customerEntitlementsTable)
      .leftJoin(servicesTable, eq(customerEntitlementsTable.serviceId, servicesTable.id))
      .leftJoin(catalogPackagesTable, eq(customerEntitlementsTable.packageId, catalogPackagesTable.id))
      .where(eq(customerEntitlementsTable.customerId, customerId))
      .orderBy(desc(customerEntitlementsTable.createdAt)),

    db.select({
      sub: subscriptionsTable,
      serviceName: servicesTable.name,
    })
      .from(subscriptionsTable)
      .leftJoin(servicesTable, eq(subscriptionsTable.serviceId, servicesTable.id))
      .where(eq(subscriptionsTable.customerId, customerId))
      .orderBy(desc(subscriptionsTable.createdAt)),

    db.select().from(solarSitesTable)
      .where(eq(solarSitesTable.customerId, customerId))
      .orderBy(desc(solarSitesTable.createdAt)),

    db.select({
      visit: dcmsVisitsTable,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
    })
      .from(dcmsVisitsTable)
      .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
      .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
      .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
      .where(eq(dcmsSubscriptionsTable.customerId, customerId))
      .orderBy(desc(dcmsVisitsTable.visitTime))
      .limit(15),

    db.select({
      booking: bookingsTable,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      serviceName: servicesTable.name,
    })
      .from(bookingsTable)
      .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
      .leftJoin(vehiclesTable, eq(bookingsTable.vehicleId, vehiclesTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(eq(bookingsTable.customerId, customerId))
      .orderBy(desc(bookingsTable.scheduledDate), desc(bookingsTable.createdAt))
      .limit(15),

    db.select({
      log: entitlementConsumptionLogTable,
      serviceName: servicesTable.name,
      packageName: catalogPackagesTable.name,
      entitlementType: customerEntitlementsTable.entitlementType,
    })
      .from(entitlementConsumptionLogTable)
      .innerJoin(customerEntitlementsTable, eq(entitlementConsumptionLogTable.entitlementId, customerEntitlementsTable.id))
      .leftJoin(servicesTable, eq(customerEntitlementsTable.serviceId, servicesTable.id))
      .leftJoin(catalogPackagesTable, eq(customerEntitlementsTable.packageId, catalogPackagesTable.id))
      .where(and(
        eq(customerEntitlementsTable.customerId, customerId),
        sql`${entitlementConsumptionLogTable.revertedAt} IS NULL`,
      ))
      .orderBy(desc(entitlementConsumptionLogTable.consumedAt))
      .limit(10),

    listCustomerContracts(customerId),

    db.select({
      solarSiteId: bookingsTable.solarSiteId,
      count: sql<number>`count(*)::int`,
    })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.customerId, customerId),
        eq(bookingsTable.status, "completed"),
        sql`${bookingsTable.solarSiteId} is not null`,
      ))
      .groupBy(bookingsTable.solarSiteId),

    db.select({
      solarSiteId: subscriptionsTable.solarSiteId,
      count: sql<number>`count(*)::int`,
    })
      .from(subscriptionsTable)
      .where(and(
        eq(subscriptionsTable.customerId, customerId),
        eq(subscriptionsTable.type, "solar_amc"),
        inArray(subscriptionsTable.status, ["active", "paused", "expiring"]),
        sql`${subscriptionsTable.solarSiteId} is not null`,
      ))
      .groupBy(subscriptionsTable.solarSiteId),

    db.select({
      subscriptionId: dcmsStaffAssignmentsTable.subscriptionId,
      staffName: staffTable.name,
    })
      .from(dcmsStaffAssignmentsTable)
      .innerJoin(staffTable, eq(dcmsStaffAssignmentsTable.staffId, staffTable.id))
      .where(eq(dcmsStaffAssignmentsTable.isActive, true)),
  ]);

  const assignmentBySub = Object.fromEntries(
    dcmsAssignments.map(a => [a.subscriptionId, a.staffName]),
  );
  const bookingCountBySolar = Object.fromEntries(
    solarBookingCounts.filter(r => r.solarSiteId).map(r => [r.solarSiteId!, Number(r.count)]),
  );
  const amcBySolar = Object.fromEntries(
    solarAmcBySite.filter(r => r.solarSiteId).map(r => [r.solarSiteId!, Number(r.count)]),
  );

  const activeContracts = await registryActiveCount(customerId);

  const planIds = [...new Set(dcmsRows.map(r => r.sub.planId))];
  const planAddonsMap = await getPlanAddonsForPlans(planIds);

  const allAddonIds = [
    ...new Set(
      bookingRows.flatMap(r => (r.booking.addonIds as number[] | null) ?? []).filter(Boolean),
    ),
  ];
  const addonRows = allAddonIds.length
    ? await db.select({ id: serviceAddonsTable.id, name: serviceAddonsTable.name })
      .from(serviceAddonsTable)
      .where(inArray(serviceAddonsTable.id, allAddonIds))
    : [];
  const addonNameById = Object.fromEntries(addonRows.map(a => [a.id, a.name]));

  const dailyCleaning = dcmsRows.map(row => ({
    id: row.sub.id,
    vehicleId: row.sub.vehicleId,
    vehicleLabel: [row.vehicleNumber, row.vehicleMake, row.vehicleModel].filter(Boolean).join(" · "),
    planName: row.planName,
    status: row.sub.status,
    startDate: String(row.sub.startDate),
    remainingCleanings: row.sub.remainingCleanings,
    remainingWashes: row.sub.remainingWashes,
    allocatedCleanings: row.sub.allocatedCleanings,
    allocatedWashes: row.sub.allocatedWashes,
    assignedStaffName: assignmentBySub[row.sub.id] ?? null,
    renewalEligible: isRenewalEligible(row.sub),
    bundledAddons: (planAddonsMap.get(row.sub.planId) ?? []).map(a => a.addonName),
  }));

  const entitlements = entitlementRows.map(row => ({
    id: row.ent.id,
    entitlementType: row.ent.entitlementType,
    serviceName: row.serviceName,
    packageName: row.packageName,
    remainingCredits: row.ent.remainingCredits,
    totalCredits: row.ent.totalCredits,
    validFrom: String(row.ent.validFrom),
    validUntil: String(row.ent.validUntil),
    status: row.ent.status,
  }));

  const legacySubscriptions = legacySubs.map(row => ({
    id: row.sub.id,
    type: row.sub.type,
    status: row.sub.status,
    serviceName: row.serviceName,
    vehicleId: row.sub.vehicleId,
    solarSiteId: row.sub.solarSiteId,
    startDate: String(row.sub.startDate),
    endDate: String(row.sub.endDate),
    servicesRemaining: row.sub.servicesRemaining,
    totalServices: row.sub.totalServices,
    nextDueDate: row.sub.nextDueDate ? String(row.sub.nextDueDate) : null,
  }));

  const solarSites = solarRows.map(site => ({
    id: site.id,
    address: site.address,
    panelCount: site.panelCount,
    lastCleanedDate: site.lastCleanedDate ? String(site.lastCleanedDate) : null,
    nextServiceDate: site.nextServiceDate ? String(site.nextServiceDate) : null,
    locationLabel: site.locationLabel,
    completedBookings: bookingCountBySolar[site.id] ?? 0,
    activeAmcEntitlements: amcBySolar[site.id] ?? 0,
  }));

  type TimelineItem = CustomerServicesHub["recentWork"][number] & { sortKey: string };

  const visitItems: TimelineItem[] = dcmsVisits.map(row => ({
    id: `visit-${row.visit.id}`,
    source: "dcms_visit" as const,
    workType: row.visit.visitType === "wash" ? "DCMS wash" : "Daily cleaning",
    assetLabel: row.vehicleNumber,
    status: row.visit.status,
    occurredAt: row.visit.visitTime.toISOString(),
    staffName: row.staffName,
    sortKey: row.visit.visitTime.toISOString(),
    addonLabel: null,
  }));

  const bookingItems: TimelineItem[] = bookingRows.map(row => {
    const ids = (row.booking.addonIds as number[] | null) ?? [];
    const addonNames = ids.map(id => addonNameById[id]).filter(Boolean);
    return {
      id: `booking-${row.booking.id}`,
      source: "booking" as const,
      workType: row.serviceName ?? row.booking.serviceType.replace(/_/g, " "),
      assetLabel: row.vehicleNumber ?? (row.booking.solarSiteId ? `Solar site #${row.booking.solarSiteId}` : null),
      status: row.booking.status,
      occurredAt: row.booking.completedAt?.toISOString()
        ?? `${row.booking.scheduledDate}T${row.booking.scheduledTime ?? "00:00"}:00`,
      staffName: row.staffName,
      addonLabel: addonNames.length ? addonNames.join(", ") : null,
      sortKey: row.booking.completedAt?.toISOString()
        ?? `${row.booking.scheduledDate}T${row.booking.scheduledTime ?? "00:00"}:00`,
    };
  });

  const entitlementItems: TimelineItem[] = entitlementUsage.map(row => ({
    id: `entitlement-${row.log.id}`,
    source: "entitlement" as const,
    workType: `Credit used · ${row.packageName ?? row.serviceName ?? row.entitlementType}`,
    assetLabel: null,
    status: "consumed",
    occurredAt: row.log.consumedAt.toISOString(),
    staffName: null,
    sortKey: row.log.consumedAt.toISOString(),
    addonLabel: null,
  }));

  const recentWork = [...visitItems, ...bookingItems, ...entitlementItems]
    .sort((a, b) => b.sortKey.localeCompare(a.sortKey))
    .slice(0, 20)
    .map(({ sortKey: _s, ...item }) => item);

  const activeProductLines = activeProductLinesFromContracts(contracts);
  const customer = customerRow[0];
  const profile = buildCustomerProfile({
    status: customer?.status ?? "active",
    legacySegment: customer?.legacySegment,
    reactivatedAt: customer?.reactivatedAt,
    gstin: customer?.gstin,
    billingName: customer?.billingName,
    vehicleCount: Number(vehicleCountRow[0]?.count ?? 0),
    solarSiteCount: solarRows.length,
    activeProductLines,
    activeContracts,
    recentWorkCount: recentWork.length,
  });

  return {
    customerId,
    profile,
    counts: {
      dailyCleaning: contracts.filter(c => c.productLine === "daily_cleaning" && ["active", "paused"].includes(c.status)).length,
      entitlements: contracts.filter(c => c.productLine === "wash_package" && c.status === "active").length,
      legacySubscriptions: contracts.filter(c =>
        ["monthly_wash", "solar_amc", "detailing_plan"].includes(c.productLine)
        && ["active", "paused", "expiring"].includes(c.status),
      ).length,
      solarSites: solarRows.length,
      activeContracts,
    },
    dailyCleaning,
    entitlements,
    legacySubscriptions,
    solarSites,
    recentWork,
    contracts,
  };
}

/** Active contract count from unified registry. */
export async function countActiveCustomerContracts(customerId: number): Promise<number> {
  await syncCustomerContracts(customerId);
  return registryActiveCount(customerId);
}
