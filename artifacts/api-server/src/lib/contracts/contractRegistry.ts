import {
  db,
  customerContractsTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  subscriptionsTable,
  customerEntitlementsTable,
  bookingsTable,
  vehiclesTable,
  solarSitesTable,
  catalogPackagesTable,
  servicesTable,
  serviceLocationsTable,
  assetsTable,
  type DcmsSubscription,
  type Subscription,
  type CustomerEntitlement,
  type Booking,
} from "@workspace/db";
import { eq, and, sql, inArray, desc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters } from "../../middlewares/tenantScope";
import { getPlanAddons } from "../dcms/planAddonService";

const ACTIVE_STATUSES = ["active", "paused", "expiring"] as const;

export type RegistryContractRow = {
  id: number;
  customerId: number;
  assetType: string | null;
  assetId: number | null;
  assetLabel: string | null;
  productLine: string;
  sourceSystem: string;
  sourceId: number;
  status: string;
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
};

const PRODUCT_LINE_LABELS: Record<string, string> = {
  daily_cleaning: "Daily cleaning plan",
  wash_package: "Wash package",
  monthly_wash: "Monthly wash plan",
  solar_amc: "Solar AMC",
  detailing_plan: "Detailing plan",
  one_time_service: "One-time service",
};

function resolveContractServiceName(
  productLine: string,
  summary: Record<string, unknown>,
  serviceNameFromDb: string | null,
): string {
  if (typeof summary.serviceName === "string" && summary.serviceName.trim()) return summary.serviceName;
  if (typeof summary.planName === "string" && summary.planName.trim()) return summary.planName;
  if (typeof summary.packageName === "string" && summary.packageName.trim()) return summary.packageName;
  if (serviceNameFromDb) return serviceNameFromDb;
  return PRODUCT_LINE_LABELS[productLine] ?? productLine.replace(/_/g, " ");
}

function mapDcmsStatus(status: string): typeof customerContractsTable.$inferInsert["status"] {
  if (status === "paused") return "paused";
  if (status === "completed") return "completed";
  if (status === "expired") return "expired";
  if (status === "cancelled") return "cancelled";
  return "active";
}

function mapSubscriptionStatus(status: string): typeof customerContractsTable.$inferInsert["status"] {
  if (status === "paused") return "paused";
  if (status === "expiring") return "expiring";
  if (status === "expired") return "expired";
  if (status === "cancelled") return "cancelled";
  return "active";
}

function mapEntitlementStatus(ent: CustomerEntitlement): typeof customerContractsTable.$inferInsert["status"] {
  if (ent.status === "cancelled") return "cancelled";
  if (ent.status === "expired" || ent.status === "exhausted") return "expired";
  if (ent.remainingCredits <= 0) return "expired";
  if (ent.validUntil < new Date().toISOString().slice(0, 10)) return "expired";
  return "active";
}

function productLineFromEntitlement(type: string): typeof customerContractsTable.$inferInsert["productLine"] {
  if (type === "solar_visit") return "solar_amc";
  if (type === "detailing_credit") return "detailing_plan";
  return "wash_package";
}

function productLineFromSubscription(type: string): typeof customerContractsTable.$inferInsert["productLine"] {
  if (type === "solar_amc") return "solar_amc";
  if (type === "detailing_plan") return "detailing_plan";
  return "monthly_wash";
}

async function upsertContract(row: typeof customerContractsTable.$inferInsert): Promise<number> {
  const [result] = await db.insert(customerContractsTable).values(row).onConflictDoUpdate({
    target: [customerContractsTable.sourceSystem, customerContractsTable.sourceId],
    set: {
      customerId: row.customerId,
      assetType: row.assetType,
      assetId: row.assetId,
      serviceLocationId: row.serviceLocationId,
      registryAssetId: row.registryAssetId,
      serviceId: row.serviceId,
      contractType: row.contractType,
      catalogRefKind: row.catalogRefKind,
      catalogRefId: row.catalogRefId,
      productLine: row.productLine,
      status: row.status,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      summaryJson: row.summaryJson,
      companyId: row.companyId,
      franchiseeId: row.franchiseeId,
      branchId: row.branchId,
      updatedAt: new Date(),
    },
  }).returning({ id: customerContractsTable.id });
  return result!.id;
}

export async function syncContractFromDcms(sub: DcmsSubscription, planName?: string) {
  const planAddons = await getPlanAddons(sub.planId);
  await upsertContract({
    customerId: sub.customerId,
    assetType: "vehicle",
    assetId: sub.vehicleId,
    serviceLocationId: sub.serviceLocationId ?? null,
    registryAssetId: sub.assetId ?? null,
    serviceId: null,
    contractType: "contract_recurring",
    catalogRefKind: "plan",
    catalogRefId: sub.planId,
    productLine: "daily_cleaning",
    sourceSystem: "dcms",
    sourceId: sub.id,
    status: mapDcmsStatus(sub.status),
    validFrom: String(sub.startDate),
    validUntil: null,
    summaryJson: {
      planId: sub.planId,
      planName,
      remainingCleanings: sub.remainingCleanings,
      remainingWashes: sub.remainingWashes,
      allocatedCleanings: sub.allocatedCleanings,
      allocatedWashes: sub.allocatedWashes,
      bundledAddons: planAddons.map(a => ({
        name: a.addonName,
        includedCleanings: a.includedCleanings,
        includedWashes: a.includedWashes,
      })),
    },
    companyId: sub.companyId,
    franchiseeId: sub.franchiseeId,
    branchId: sub.branchId,
  });
}

export async function syncContractFromSubscription(sub: Subscription, extras?: {
  contractType?: "contract_recurring" | "contract_credits";
  registryAssetId?: number | null;
  serviceLocationId?: number | null;
  serviceId?: number | null;
  catalogRefKind?: string;
  catalogRefId?: number;
  packageName?: string;
  paymentTerms?: string;
}) {
  const assetType = sub.vehicleId ? "vehicle" as const
    : sub.solarSiteId ? "solar_site" as const
      : "customer" as const;
  await upsertContract({
    customerId: sub.customerId,
    assetType,
    assetId: sub.vehicleId ?? sub.solarSiteId ?? null,
    serviceLocationId: extras?.serviceLocationId ?? sub.serviceLocationId ?? null,
    registryAssetId: extras?.registryAssetId ?? sub.assetId ?? null,
    serviceId: extras?.serviceId ?? sub.serviceId ?? null,
    contractType: extras?.contractType ?? (sub.type === "solar_amc" ? "contract_recurring" : "contract_recurring"),
    catalogRefKind: extras?.catalogRefKind ?? null,
    catalogRefId: extras?.catalogRefId ?? null,
    productLine: productLineFromSubscription(sub.type),
    sourceSystem: "subscription",
    sourceId: sub.id,
    status: mapSubscriptionStatus(sub.status),
    validFrom: String(sub.startDate),
    validUntil: String(sub.endDate),
    summaryJson: {
      type: sub.type,
      packageName: extras?.packageName,
      servicesRemaining: sub.servicesRemaining,
      totalServices: sub.totalServices,
      nextDueDate: sub.nextDueDate,
      price: sub.price,
      paymentTerms: extras?.paymentTerms,
    },
    companyId: sub.companyId,
    franchiseeId: sub.franchiseeId,
    branchId: sub.branchId,
  });
}

export async function syncContractFromEntitlement(ent: CustomerEntitlement, extras?: {
  packageName?: string | null;
  serviceName?: string | null;
  contractType?: "contract_credits";
}) {
  const assetType = ent.solarSiteId ? "solar_site" as const
    : ent.vehicleId ? "vehicle" as const
      : "customer" as const;
  const isWash = ent.entitlementType !== "solar_visit";
  await upsertContract({
    customerId: ent.customerId,
    assetType,
    assetId: ent.solarSiteId ?? ent.vehicleId ?? null,
    serviceLocationId: ent.serviceLocationId ?? null,
    registryAssetId: ent.assetId ?? null,
    serviceId: ent.serviceId,
    contractType: extras?.contractType ?? (isWash ? "contract_credits" : "contract_recurring"),
    catalogRefKind: ent.packageId ? "package" : null,
    catalogRefId: ent.packageId ?? null,
    productLine: productLineFromEntitlement(ent.entitlementType),
    sourceSystem: "entitlement",
    sourceId: ent.id,
    status: mapEntitlementStatus(ent),
    validFrom: String(ent.validFrom),
    validUntil: String(ent.validUntil),
    summaryJson: {
      entitlementType: ent.entitlementType,
      packageId: ent.packageId,
      packageName: extras?.packageName,
      serviceName: extras?.serviceName,
      serviceId: ent.serviceId,
      remainingCredits: ent.remainingCredits,
      totalCredits: ent.totalCredits,
    },
    companyId: null,
    franchiseeId: null,
    branchId: null,
  });
}

export async function syncContractFromBooking(booking: Booking, extras: {
  serviceName: string;
  catalogRefKind: string;
  catalogRefId: number;
  registryAssetId: number;
  paymentTerms?: string;
  discountType?: string;
  discountValue?: string;
}): Promise<number> {
  const assetType = booking.solarSiteId ? "solar_site" as const
    : booking.vehicleId ? "vehicle" as const
      : "customer" as const;
  return upsertContract({
    customerId: booking.customerId,
    assetType,
    assetId: booking.solarSiteId ?? booking.vehicleId ?? null,
    serviceLocationId: booking.serviceLocationId ?? null,
    registryAssetId: extras.registryAssetId,
    serviceId: booking.serviceId ?? null,
    contractType: "one_time",
    catalogRefKind: extras.catalogRefKind,
    catalogRefId: extras.catalogRefId,
    productLine: "one_time_service",
    sourceSystem: "booking",
    sourceId: booking.id,
    status: booking.status === "cancelled" ? "cancelled" : "active",
    validFrom: String(booking.scheduledDate),
    validUntil: String(booking.scheduledDate),
    summaryJson: {
      serviceName: extras.serviceName,
      bookingId: booking.id,
      amount: booking.amount,
      paymentTerms: extras.paymentTerms,
      discountType: extras.discountType,
      discountValue: extras.discountValue,
    },
    companyId: booking.companyId,
    franchiseeId: booking.franchiseeId,
    branchId: booking.branchId,
  });
}

/** Reconcile registry rows for one customer from all source systems. */
export async function syncCustomerContracts(customerId: number) {
  const [dcmsRows, subs, ents, bookingRows] = await Promise.all([
    db.select({ sub: dcmsSubscriptionsTable, planName: dcmsPlansTable.name })
      .from(dcmsSubscriptionsTable)
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .where(eq(dcmsSubscriptionsTable.customerId, customerId)),
    db.select().from(subscriptionsTable).where(eq(subscriptionsTable.customerId, customerId)),
    db.select({
      ent: customerEntitlementsTable,
      packageName: catalogPackagesTable.name,
      serviceName: servicesTable.name,
    })
      .from(customerEntitlementsTable)
      .leftJoin(catalogPackagesTable, eq(customerEntitlementsTable.packageId, catalogPackagesTable.id))
      .leftJoin(servicesTable, eq(customerEntitlementsTable.serviceId, servicesTable.id))
      .where(eq(customerEntitlementsTable.customerId, customerId)),
    db.select({
      booking: bookingsTable,
      serviceName: servicesTable.name,
    })
      .from(bookingsTable)
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(eq(bookingsTable.customerId, customerId)),
  ]);

  for (const row of dcmsRows) {
    await syncContractFromDcms(row.sub, row.planName);
  }
  for (const sub of subs) {
    await syncContractFromSubscription(sub);
  }
  for (const row of ents) {
    await syncContractFromEntitlement(row.ent, {
      packageName: row.packageName,
      serviceName: row.serviceName,
      contractType: row.ent.entitlementType === "solar_visit" ? undefined : "contract_credits",
    });
  }
  for (const row of bookingRows) {
    if (!row.booking.serviceId) continue;
    await syncContractFromBooking(row.booking, {
      serviceName: row.serviceName ?? "One-time service",
      catalogRefKind: "service",
      catalogRefId: row.booking.serviceId,
      registryAssetId: row.booking.assetId ?? 0,
    });
  }
}

export async function countActiveCustomerContracts(customerId: number): Promise<number> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.customerId, customerId),
      inArray(customerContractsTable.status, [...ACTIVE_STATUSES]),
    ));
  return Number(row?.count ?? 0);
}

export async function countActiveContractsForTenant(req: Request): Promise<number> {
  const filters = tenantFilters(req, {
    companyCol: customerContractsTable.companyId,
    branchCol: customerContractsTable.branchId,
    franchiseeCol: customerContractsTable.franchiseeId,
  });
  const where = filters.length
    ? and(inArray(customerContractsTable.status, [...ACTIVE_STATUSES]), ...filters)
    : inArray(customerContractsTable.status, [...ACTIVE_STATUSES]);
  const [row] = await db.select({ count: sql<number>`count(*)::int` })
    .from(customerContractsTable)
    .where(where);
  return Number(row?.count ?? 0);
}

export async function listCustomerContracts(customerId: number): Promise<RegistryContractRow[]> {
  const rows = await db.select({
    contract: customerContractsTable,
    vehicleNumber: vehiclesTable.registrationNumber,
    solarAddress: solarSitesTable.address,
    serviceLocationLabel: serviceLocationsTable.label,
    linkedAssetLabel: assetsTable.label,
    serviceNameFromDb: servicesTable.name,
  })
    .from(customerContractsTable)
    .leftJoin(vehiclesTable, and(
      eq(customerContractsTable.assetType, "vehicle"),
      eq(customerContractsTable.assetId, vehiclesTable.id),
    ))
    .leftJoin(solarSitesTable, and(
      eq(customerContractsTable.assetType, "solar_site"),
      eq(customerContractsTable.assetId, solarSitesTable.id),
    ))
    .leftJoin(serviceLocationsTable, eq(customerContractsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(customerContractsTable.registryAssetId, assetsTable.id))
    .leftJoin(servicesTable, eq(customerContractsTable.serviceId, servicesTable.id))
    .where(eq(customerContractsTable.customerId, customerId))
    .orderBy(desc(customerContractsTable.updatedAt));

  return rows.map(r => {
    const summary = (r.contract.summaryJson ?? {}) as Record<string, unknown>;
    const validFrom = r.contract.validFrom ? String(r.contract.validFrom) : null;
    const validUntil = r.contract.validUntil ? String(r.contract.validUntil) : null;
    const legacyAssetLabel = r.contract.assetType === "vehicle"
      ? r.vehicleNumber ?? null
      : r.contract.assetType === "solar_site"
        ? r.solarAddress ?? null
        : null;

    return {
      id: r.contract.id,
      customerId: r.contract.customerId,
      assetType: r.contract.assetType,
      assetId: r.contract.assetId,
      assetLabel: legacyAssetLabel,
      productLine: r.contract.productLine,
      sourceSystem: r.contract.sourceSystem,
      sourceId: r.contract.sourceId,
      status: r.contract.status,
      validFrom,
      validUntil,
      startDate: validFrom,
      endDate: validUntil,
      serviceName: resolveContractServiceName(r.contract.productLine, summary, r.serviceNameFromDb),
      serviceLocationId: r.contract.serviceLocationId ?? null,
      serviceLocationLabel: r.serviceLocationLabel ?? null,
      linkedAssetId: r.contract.registryAssetId ?? null,
      linkedAssetLabel: r.linkedAssetLabel ?? legacyAssetLabel,
      summary,
    };
  });
}

export function activeContractFilter(): SQL {
  return inArray(customerContractsTable.status, [...ACTIVE_STATUSES]);
}
