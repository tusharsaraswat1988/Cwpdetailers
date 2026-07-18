/**
 * Sprint 4B — unified service contract creation from Book Services wizard.
 * Creates source records + customer_contracts registry. No billing, assignments, or wallet.
 */

import {
  db,
  subscriptionsTable,
  catalogPackagesTable,
  catalogPackageEntitlementsTable,
  servicesTable,
  serviceLocationsTable,
  customerLocationLinksTable,
  customerContractsTable,
  type Booking,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getTodayIST } from "../../subscriptions/service";
import { getAssetDetail } from "../assets/assetService";
import { createSubscription } from "../dcms/subscriptionService";
import { grantPackageEntitlements } from "../catalog/entitlementEngine";
import {
  resolveFulfillmentMode,
  type FulfillmentMode,
  type CatalogSelectionKind,
} from "./fulfillmentMode";
import {
  syncContractFromSubscription,
  listCustomerContracts,
} from "./contractRegistry";
import { tenantStamp } from "../../middlewares/tenantScope";
import type { Request } from "express";
import {
  assertServiceabilitySuccess,
  validateServiceabilityForBooking,
} from "../serviceability";

export type CreateServiceContractBody = {
  customerId: number;
  serviceLocationId: number;
  assetId: number;
  selectionKind: CatalogSelectionKind;
  selectionId: number;
  catalogServiceId?: number;
  addonIds?: number[];
  discountType?: "none" | "percent" | "flat";
  discountValue?: string;
  paymentTerms?: string;
  partialAdvancePercent?: string;
  startDate?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  notes?: string;
  estimatedAmount?: number;
};

export type ServiceContractResult = {
  contractType: FulfillmentMode;
  registryId: number;
  sourceSystem: "booking" | "dcms" | "entitlement" | "subscription";
  sourceId: number;
  bookingId?: number;
  productLine: string;
  label: string;
  status: string;
  validFrom: string | null;
  validUntil: string | null;
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function computeDiscountedAmount(
  base: number,
  discountType?: string,
  discountValue?: string,
): number {
  if (!discountType || discountType === "none" || !discountValue) return base;
  if (discountType === "percent") {
    const pct = Math.min(100, Math.max(0, parseFloat(discountValue) || 0));
    return Math.max(0, base - (base * pct) / 100);
  }
  if (discountType === "flat") {
    const flat = Math.max(0, parseFloat(discountValue) || 0);
    return Math.max(0, base - flat);
  }
  return base;
}

async function assertCustomerLocation(customerId: number, serviceLocationId: number) {
  const [link] = await db.select()
    .from(customerLocationLinksTable)
    .where(and(
      eq(customerLocationLinksTable.customerId, customerId),
      eq(customerLocationLinksTable.serviceLocationId, serviceLocationId),
    ))
    .limit(1);
  if (!link) throw new Error("Service location is not linked to this customer");
}

async function loadLocation(serviceLocationId: number) {
  const [loc] = await db.select().from(serviceLocationsTable)
    .where(eq(serviceLocationsTable.id, serviceLocationId))
    .limit(1);
  if (!loc) throw new Error("Service location not found");
  return loc;
}

function mapBookingServiceType(assetType: string, category?: string): Booking["serviceType"] {
  const c = (category ?? "").toLowerCase();
  if (assetType === "solar_site" || c.includes("solar")) return "solar_cleaning";
  if (c.includes("detail")) return "detailing";
  return "one_time_wash";
}

async function createOneTimeContract(
  body: CreateServiceContractBody,
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>,
  location: Awaited<ReturnType<typeof loadLocation>>,
  performedBy: number,
  tenant: { companyId?: number | null; franchiseeId?: number | null; branchId?: number | null },
): Promise<ServiceContractResult> {
  const serviceId = body.catalogServiceId ?? body.selectionId;
  const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
  if (!svc) throw new Error("Service not found");
  const { isDailyCleanCatalogServiceName } = await import("@workspace/validation");
  if (isDailyCleanCatalogServiceName(svc.name)) {
    throw new Error("Daily cleaning monthly plans must be selected as a Plan — not as a one-time catalog service.");
  }

  const scheduledDate = body.scheduledDate ?? body.startDate ?? getTodayIST();
  const amount = computeDiscountedAmount(
    body.estimatedAmount ?? (parseFloat(svc.basePrice) || 0),
    body.discountType,
    body.discountValue,
  );

  const address = location.address ?? location.label;
  const lat = location.latitude ?? 0;
  const lng = location.longitude ?? 0;

  const serviceability = await validateServiceabilityForBooking({
    customerId: body.customerId,
    address,
    locationLat: lat,
    locationLng: lng,
    placeId: location.placeId ?? null,
    serviceId,
    cityName: location.city ?? null,
  });
  assertServiceabilitySuccess(serviceability);

  const { createOneTimeContractRegistry, linkContractToBooking } = await import("./contractRegistry");
  const { bookingCapability } = await import("../booking");
  const { enqueuePendingFromLegacyBooking } = await import("../assignments/enqueueAdapters");

  // 1) Contract first (commercial intent)
  const registryId = await createOneTimeContractRegistry({
    customerId: body.customerId,
    vehicleId: asset.vehicleId ?? null,
    solarSiteId: asset.solarSiteId ?? null,
    serviceLocationId: body.serviceLocationId,
    registryAssetId: body.assetId,
    serviceId,
    serviceName: svc.name,
    scheduledDate,
    amount: amount.toFixed(2),
    paymentTerms: body.paymentTerms,
    discountType: body.discountType,
    discountValue: body.discountValue,
    companyId: tenant.companyId ?? null,
    franchiseeId: tenant.franchiseeId ?? null,
    branchId: tenant.branchId ?? null,
  });

  // 2) Booking Engine (schedule only)
  const createResult = await bookingCapability.createBooking({
    customerId: body.customerId,
    contractRegistryId: registryId,
    serviceLocationId: body.serviceLocationId,
    assetId: body.assetId,
    vehicleId: asset.vehicleId ?? null,
    solarSiteId: asset.solarSiteId ?? null,
    serviceId,
    scheduledDate,
    scheduledTime: body.scheduledTime ?? null,
    serviceType: mapBookingServiceType(asset.assetType, svc.category),
    address,
    area: location.city ?? undefined,
    locationLat: lat,
    locationLng: lng,
    placeId: location.placeId ?? undefined,
    cityId: serviceability.resolvedCityId ?? undefined,
    notes: body.notes ?? `Book Services — ${svc.name}`,
    companyId: tenant.companyId ?? null,
    franchiseeId: tenant.franchiseeId ?? null,
    branchId: tenant.branchId ?? null,
    status: "scheduled",
    skipCoverageValidation: true,
  }, {
    requestSource: "book_services_one_time",
  });

  const booking = createResult.booking;

  // 3) Link contract → booking (legacy source_id bridge)
  await linkContractToBooking(registryId, booking.id, amount.toFixed(2));

  // 4) Waiting assignment queue
  await enqueuePendingFromLegacyBooking(booking.id);
  await bookingCapability.markWaitingAssignment(booking.id, {
    actorId: performedBy,
    actorName: "Book Services",
  });

  return {
    contractType: "one_time",
    registryId,
    sourceSystem: "booking",
    sourceId: booking.id,
    bookingId: booking.id,
    productLine: "one_time_service",
    label: svc.name,
    status: "active",
    validFrom: scheduledDate,
    validUntil: null,
  };
}

async function createRecurringDcmsContract(
  body: CreateServiceContractBody,
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>,
  location: Awaited<ReturnType<typeof loadLocation>>,
  performedBy: number,
  tenant: { companyId?: number | null; franchiseeId?: number | null; branchId?: number | null },
): Promise<ServiceContractResult> {
  if (!asset.vehicleId) throw new Error("Daily cleaning plan requires a vehicle asset");

  const startDate = body.startDate ?? getTodayIST();
  const sub = await createSubscription({
    customerId: body.customerId,
    vehicleId: asset.vehicleId,
    planId: body.selectionId,
    startDate,
    latitude: location.latitude ?? undefined,
    longitude: location.longitude ?? undefined,
    serviceLocationId: body.serviceLocationId,
    assetId: body.assetId,
    companyId: tenant.companyId,
    franchiseeId: tenant.franchiseeId,
    branchId: tenant.branchId,
    skipBilling: true,
  }, performedBy);

  const [registry] = await db.select({ id: customerContractsTable.id })
    .from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.sourceSystem, "dcms"),
      eq(customerContractsTable.sourceId, sub.id),
    ))
    .limit(1);

  if (registry?.id && body.paymentTerms) {
    const [existing] = await db.select().from(customerContractsTable)
      .where(eq(customerContractsTable.id, registry.id)).limit(1);
    if (existing) {
      await db.update(customerContractsTable).set({
        summaryJson: {
          ...(existing.summaryJson as Record<string, unknown>),
          paymentTerms: body.paymentTerms,
          partialAdvancePercent: body.partialAdvancePercent,
        },
        updatedAt: new Date(),
      }).where(eq(customerContractsTable.id, registry.id));
    }
  }

  return {
    contractType: "contract_recurring",
    registryId: registry?.id ?? 0,
    sourceSystem: "dcms",
    sourceId: sub.id,
    productLine: "daily_cleaning",
    label: "Daily cleaning plan",
    status: sub.status,
    validFrom: String(sub.startDate),
    validUntil: null,
  };
}

async function createRecurringSolarAmcContract(
  body: CreateServiceContractBody,
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>,
  performedBy: number,
  tenant: { companyId?: number | null; franchiseeId?: number | null; branchId?: number | null },
): Promise<ServiceContractResult> {
  if (!asset.solarSiteId) throw new Error("Solar AMC requires a solar site asset");

  const [pkg] = await db.select().from(catalogPackagesTable)
    .where(eq(catalogPackagesTable.id, body.selectionId))
    .limit(1);
  if (!pkg) throw new Error("Package not found");

  const items = await db.select()
    .from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, body.selectionId));

  const primary = items.find(i => i.entitlementType === "solar_visit") ?? items[0];
  if (!primary) throw new Error("Solar AMC package has no visit entitlements configured");

  const startDate = body.startDate ?? getTodayIST();
  const endDate = addDays(startDate, pkg.validityDays);
  const totalVisits = items
    .filter(i => i.entitlementType === "solar_visit")
    .reduce((sum, i) => sum + i.creditCount, 0) || primary.creditCount;

  const price = computeDiscountedAmount(
    body.estimatedAmount ?? (parseFloat(pkg.price) || 0),
    body.discountType,
    body.discountValue,
  );

  const frequencyDays = pkg.validityDays > 0 && totalVisits > 0
    ? Math.max(1, Math.floor(pkg.validityDays / totalVisits))
    : 30;

  const [sub] = await db.insert(subscriptionsTable).values({
    customerId: body.customerId,
    serviceLocationId: body.serviceLocationId,
    assetId: body.assetId,
    solarSiteId: asset.solarSiteId,
    serviceId: primary.serviceId,
    type: "solar_amc",
    startDate,
    endDate,
    totalServices: totalVisits,
    servicesUsed: 0,
    servicesRemaining: totalVisits,
    frequencyDays,
    nextServiceDate: startDate,
    nextDueDate: startDate,
    price: price.toFixed(2),
    dueAmount: price.toFixed(2),
    paidAmount: "0",
    notes: body.notes ?? `Book Services — ${pkg.name}`,
    companyId: tenant.companyId ?? null,
    franchiseeId: tenant.franchiseeId ?? null,
    branchId: tenant.branchId ?? null,
  }).returning();

  await syncContractFromSubscription(sub!, {
    contractType: "contract_recurring",
    registryAssetId: body.assetId,
    serviceLocationId: body.serviceLocationId,
    serviceId: primary.serviceId,
    catalogRefKind: "package",
    catalogRefId: body.selectionId,
    packageName: pkg.name,
    paymentTerms: body.paymentTerms,
  });

  const [registry] = await db.select({ id: customerContractsTable.id })
    .from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.sourceSystem, "subscription"),
      eq(customerContractsTable.sourceId, sub!.id),
    ))
    .limit(1);

  return {
    contractType: "contract_recurring",
    registryId: registry?.id ?? 0,
    sourceSystem: "subscription",
    sourceId: sub!.id,
    productLine: "solar_amc",
    label: pkg.name,
    status: sub!.status,
    validFrom: startDate,
    validUntil: endDate,
  };
}

async function createCreditsPackageContract(
  body: CreateServiceContractBody,
  asset: NonNullable<Awaited<ReturnType<typeof getAssetDetail>>>,
  performedBy: number,
  tenant: { companyId?: number | null; franchiseeId?: number | null; branchId?: number | null },
): Promise<ServiceContractResult> {
  const [pkg] = await db.select().from(catalogPackagesTable)
    .where(eq(catalogPackagesTable.id, body.selectionId))
    .limit(1);
  if (!pkg) throw new Error("Package not found");

  const grants = await grantPackageEntitlements(
    body.customerId,
    body.selectionId,
    {
      vehicleId: asset.vehicleId ?? undefined,
      solarSiteId: asset.solarSiteId ?? undefined,
      serviceLocationId: body.serviceLocationId,
      assetId: body.assetId,
      validFrom: body.startDate,
      skipBilling: true,
    },
  );

  const primary = grants[0];
  if (!primary) throw new Error("Package grant produced no entitlements");

  const [registry] = await db.select({ id: customerContractsTable.id })
    .from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.sourceSystem, "entitlement"),
      eq(customerContractsTable.sourceId, primary.id),
    ))
    .limit(1);

  if (registry?.id) {
    const [existing] = await db.select().from(customerContractsTable)
      .where(eq(customerContractsTable.id, registry.id)).limit(1);
    if (existing) {
      await db.update(customerContractsTable).set({
        companyId: tenant.companyId ?? existing.companyId,
        franchiseeId: tenant.franchiseeId ?? existing.franchiseeId,
        branchId: tenant.branchId ?? existing.branchId,
        summaryJson: {
          ...(existing.summaryJson as Record<string, unknown>),
          paymentTerms: body.paymentTerms,
          partialAdvancePercent: body.partialAdvancePercent,
          discountType: body.discountType,
          discountValue: body.discountValue,
        },
        updatedAt: new Date(),
      }).where(eq(customerContractsTable.id, registry.id));
    }
  }

  return {
    contractType: "contract_credits",
    registryId: registry?.id ?? 0,
    sourceSystem: "entitlement",
    sourceId: primary.id,
    productLine: "wash_package",
    label: pkg.name,
    status: primary.status,
    validFrom: String(primary.validFrom),
    validUntil: String(primary.validUntil),
  };
}

export async function createServiceContract(
  req: Request,
  body: CreateServiceContractBody,
  performedBy: number,
): Promise<ServiceContractResult> {
  if (!body.customerId || !body.serviceLocationId || !body.assetId) {
    throw new Error("customerId, serviceLocationId, and assetId are required");
  }
  if (!body.selectionKind || !body.selectionId) {
    throw new Error("selectionKind and selectionId are required");
  }
  if (!body.paymentTerms || !["full_advance", "partial_advance", "after_service"].includes(body.paymentTerms)) {
    throw new Error("paymentTerms is required (full_advance, partial_advance, or after_service)");
  }

  await assertCustomerLocation(body.customerId, body.serviceLocationId);

  const asset = await getAssetDetail(body.assetId);
  if (!asset) throw new Error("Asset not found");

  const ownsAsset = asset.customerLinks.some(l => l.customerId === body.customerId);
  if (!ownsAsset) throw new Error("Asset is not linked to this customer");

  const atLocation = asset.locationLinks.some(l => l.serviceLocationId === body.serviceLocationId);
  if (!atLocation) throw new Error("Asset is not placed at the selected service location");

  const location = await loadLocation(body.serviceLocationId);
  const fulfillment = await resolveFulfillmentMode({
    selectionKind: body.selectionKind,
    selectionId: body.selectionId,
    assetType: asset.assetType as "vehicle" | "solar_site",
  });

  const stamped = tenantStamp(req, {});
  const tenant = {
    companyId: stamped.companyId ?? null,
    franchiseeId: stamped.franchiseeId ?? null,
    branchId: stamped.branchId ?? null,
  };

  switch (fulfillment.mode) {
    case "one_time":
      return createOneTimeContract(body, asset, location, performedBy, tenant);
    case "contract_recurring":
      if (body.selectionKind === "plan") {
        return createRecurringDcmsContract(body, asset, location, performedBy, tenant);
      }
      return createRecurringSolarAmcContract(body, asset, performedBy, tenant);
    case "contract_credits":
      return createCreditsPackageContract(body, asset, performedBy, tenant);
    default:
      throw new Error(`Unsupported fulfillment mode: ${fulfillment.mode}`);
  }
}

export async function getServiceContract(registryId: number, req?: Request) {
  const rows = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, registryId))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row) return null;
  if (req) {
    const { rowInScope } = await import("../../middlewares/tenantScope");
    if (!rowInScope(req, {
      companyId: row.companyId,
      branchId: row.branchId,
      franchiseeId: row.franchiseeId,
      customerId: row.customerId,
    })) {
      return null;
    }
  }
  return row;
}

export async function updateContractStatus(
  registryId: number,
  status: "active" | "paused" | "completed" | "expired" | "cancelled" | "expiring",
  req?: Request,
) {
  const existing = await getServiceContract(registryId, req);
  if (!existing) throw new Error("Contract not found");

  await db.update(customerContractsTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(customerContractsTable.id, registryId));

  // Propagate to source system where supported
  if (existing.sourceSystem === "dcms") {
    const { dcmsSubscriptionsTable } = await import("@workspace/db");
    const mapped = status === "paused" ? "paused"
      : status === "cancelled" ? "cancelled"
        : status === "expired" ? "expired"
          : status === "completed" ? "completed"
            : "active";
    await db.update(dcmsSubscriptionsTable)
      .set({ status: mapped, updatedAt: new Date() })
      .where(eq(dcmsSubscriptionsTable.id, existing.sourceId));
  } else if (existing.sourceSystem === "subscription") {
    await db.update(subscriptionsTable)
      .set({ status: status as "active", updatedAt: new Date() })
      .where(eq(subscriptionsTable.id, existing.sourceId));
  }

  return getServiceContract(registryId, req);
}

export { listCustomerContracts };
