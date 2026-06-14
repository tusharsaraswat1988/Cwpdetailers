import {
  db,
  customerContractsTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  subscriptionsTable,
  customerEntitlementsTable,
  vehiclesTable,
  solarSitesTable,
  catalogPackagesTable,
  servicesTable,
  type DcmsSubscription,
  type Subscription,
  type CustomerEntitlement,
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
  summary: Record<string, unknown>;
};

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

async function upsertContract(row: typeof customerContractsTable.$inferInsert) {
  await db.insert(customerContractsTable).values(row).onConflictDoUpdate({
    target: [customerContractsTable.sourceSystem, customerContractsTable.sourceId],
    set: {
      customerId: row.customerId,
      assetType: row.assetType,
      assetId: row.assetId,
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
  });
}

export async function syncContractFromDcms(sub: DcmsSubscription, planName?: string) {
  const planAddons = await getPlanAddons(sub.planId);
  await upsertContract({
    customerId: sub.customerId,
    assetType: "vehicle",
    assetId: sub.vehicleId,
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

export async function syncContractFromSubscription(sub: Subscription) {
  const assetType = sub.vehicleId ? "vehicle" as const
    : sub.solarSiteId ? "solar_site" as const
      : "customer" as const;
  await upsertContract({
    customerId: sub.customerId,
    assetType,
    assetId: sub.vehicleId ?? sub.solarSiteId ?? null,
    productLine: productLineFromSubscription(sub.type),
    sourceSystem: "subscription",
    sourceId: sub.id,
    status: mapSubscriptionStatus(sub.status),
    validFrom: String(sub.startDate),
    validUntil: String(sub.endDate),
    summaryJson: {
      type: sub.type,
      servicesRemaining: sub.servicesRemaining,
      totalServices: sub.totalServices,
      nextDueDate: sub.nextDueDate,
      price: sub.price,
    },
    companyId: sub.companyId,
    franchiseeId: sub.franchiseeId,
    branchId: sub.branchId,
  });
}

export async function syncContractFromEntitlement(ent: CustomerEntitlement, extras?: {
  packageName?: string | null;
  serviceName?: string | null;
}) {
  const assetType = ent.solarSiteId ? "solar_site" as const
    : ent.vehicleId ? "vehicle" as const
      : "customer" as const;
  await upsertContract({
    customerId: ent.customerId,
    assetType,
    assetId: ent.solarSiteId ?? ent.vehicleId ?? null,
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

/** Reconcile registry rows for one customer from all source systems. */
export async function syncCustomerContracts(customerId: number) {
  const [dcmsRows, subs, ents] = await Promise.all([
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
    .where(eq(customerContractsTable.customerId, customerId))
    .orderBy(desc(customerContractsTable.updatedAt));

  return rows.map(r => ({
    id: r.contract.id,
    customerId: r.contract.customerId,
    assetType: r.contract.assetType,
    assetId: r.contract.assetId,
    assetLabel: r.contract.assetType === "vehicle"
      ? r.vehicleNumber ?? null
      : r.contract.assetType === "solar_site"
        ? r.solarAddress ?? null
        : null,
    productLine: r.contract.productLine,
    sourceSystem: r.contract.sourceSystem,
    sourceId: r.contract.sourceId,
    status: r.contract.status,
    validFrom: r.contract.validFrom ? String(r.contract.validFrom) : null,
    validUntil: r.contract.validUntil ? String(r.contract.validUntil) : null,
    summary: (r.contract.summaryJson ?? {}) as Record<string, unknown>,
  }));
}

export function activeContractFilter(): SQL {
  return inArray(customerContractsTable.status, [...ACTIVE_STATUSES]);
}
