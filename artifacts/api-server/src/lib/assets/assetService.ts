import type { Request } from "express";
import { db } from "@workspace/db";
import {
  assetsTable,
  locationAssetLinksTable,
  customerAssetLinksTable,
  vehiclesTable,
  solarSitesTable,
  serviceLocationsTable,
  customerLocationLinksTable,
  customersTable,
} from "@workspace/db";
import { and, eq, isNull, or, sql, desc, inArray } from "drizzle-orm";
import { tenantStamp, loadIfInScope } from "../../middlewares/tenantScope";
import { normalizeRegistration } from "../dcms/registration";
import { ensureDefaultServiceLocation } from "../serviceLocations/defaultLocationService";
import { isAssetsModuleEnabled } from "./featureFlag";
import { normalizeVehicleType, vehicleTypeFromCategorySlug } from "../vehicleType";

type DbLike = typeof db;

const LINK_TYPES = ["operational", "commercial", "historical"] as const;
export type CustomerAssetLinkType = typeof LINK_TYPES[number];

export function todayIso(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function parseDateField(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function resolveServiceLocationForCustomer(
  req: Request,
  customerId: number,
  serviceLocationId: number | undefined,
  tx: DbLike = db,
): Promise<{ id: number } | null> {
  if (serviceLocationId) {
    const [link] = await tx
      .select({ serviceLocationId: customerLocationLinksTable.serviceLocationId })
      .from(customerLocationLinksTable)
      .innerJoin(serviceLocationsTable, eq(customerLocationLinksTable.serviceLocationId, serviceLocationsTable.id))
      .where(and(
        eq(customerLocationLinksTable.customerId, customerId),
        eq(customerLocationLinksTable.serviceLocationId, serviceLocationId),
      ))
      .limit(1);
    if (!link) return null;
    const loc = await loadIfInScope(req, async () => {
      const [row] = await tx.select().from(serviceLocationsTable).where(eq(serviceLocationsTable.id, serviceLocationId)).limit(1);
      return row;
    }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId }));
    return loc ? { id: loc.id } : null;
  }

  const [defaultLink] = await tx
    .select({ serviceLocationId: customerLocationLinksTable.serviceLocationId })
    .from(customerLocationLinksTable)
    .where(and(
      eq(customerLocationLinksTable.customerId, customerId),
      eq(customerLocationLinksTable.isDefault, true),
    ))
    .limit(1);

  if (defaultLink) return { id: defaultLink.serviceLocationId };

  const [customer] = await tx.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
  if (!customer) return null;
  const result = await ensureDefaultServiceLocation(customer, tx);
  if (result.locationId) return { id: result.locationId };
  return null;
}

async function insertAssetLinks(
  req: Request,
  params: {
    assetId: number;
    customerId: number;
    serviceLocationId: number;
    effectiveFrom?: string;
    linkType?: CustomerAssetLinkType;
  },
  tx: DbLike,
) {
  const effFrom = params.effectiveFrom ?? todayIso();
  await tx.insert(locationAssetLinksTable).values({
    assetId: params.assetId,
    serviceLocationId: params.serviceLocationId,
    effectiveFrom: effFrom,
    updatedAt: new Date(),
  });
  await tx.insert(customerAssetLinksTable).values({
    assetId: params.assetId,
    customerId: params.customerId,
    linkType: params.linkType ?? "commercial",
    effectiveFrom: effFrom,
    updatedAt: new Date(),
  });
}

export async function registerVehicleAsset(
  req: Request,
  vehicle: typeof vehiclesTable.$inferSelect,
  opts: { serviceLocationId?: number; effectiveFrom?: string },
  tx: DbLike = db,
) {
  if (!isAssetsModuleEnabled()) return null;

  const [existing] = await tx.select().from(assetsTable).where(eq(assetsTable.vehicleId, vehicle.id)).limit(1);
  if (existing) return existing;

  const loc = await resolveServiceLocationForCustomer(req, vehicle.customerId, opts.serviceLocationId, tx);
  if (!loc) throw new Error("Service location required — link customer to a location first");

  const stamp = tenantStamp(req, {
    assetType: "vehicle" as const,
    vehicleId: vehicle.id,
    label: vehicle.registrationNumber,
    status: "active" as const,
    companyId: vehicle.companyId,
    franchiseeId: vehicle.franchiseeId,
    branchId: vehicle.branchId,
    updatedAt: new Date(),
  });

  const [asset] = await tx.insert(assetsTable).values(stamp as typeof assetsTable.$inferInsert).returning();
  await insertAssetLinks(req, {
    assetId: asset.id,
    customerId: vehicle.customerId,
    serviceLocationId: loc.id,
    effectiveFrom: opts.effectiveFrom ?? vehicle.createdAt.toISOString().split("T")[0],
  }, tx);
  return asset;
}

export async function registerSolarAsset(
  req: Request,
  site: typeof solarSitesTable.$inferSelect,
  opts: { serviceLocationId?: number; effectiveFrom?: string },
  tx: DbLike = db,
) {
  if (!isAssetsModuleEnabled()) return null;

  const [existing] = await tx.select().from(assetsTable).where(eq(assetsTable.solarSiteId, site.id)).limit(1);
  if (existing) return existing;

  const loc = await resolveServiceLocationForCustomer(req, site.customerId, opts.serviceLocationId, tx);
  if (!loc) throw new Error("Service location required — link customer to a location first");

  const label = site.siteName?.trim() || site.address.slice(0, 80);
  const stamp = tenantStamp(req, {
    assetType: "solar_site" as const,
    solarSiteId: site.id,
    label,
    notes: site.notes,
    status: "active" as const,
    companyId: site.companyId,
    franchiseeId: site.franchiseeId,
    branchId: site.branchId,
    updatedAt: new Date(),
  });

  const [asset] = await tx.insert(assetsTable).values(stamp as typeof assetsTable.$inferInsert).returning();
  await insertAssetLinks(req, {
    assetId: asset.id,
    customerId: site.customerId,
    serviceLocationId: loc.id,
    effectiveFrom: opts.effectiveFrom ?? site.createdAt.toISOString().split("T")[0],
  }, tx);
  return asset;
}

export type CreateVehicleAssetInput = {
  customerId: number;
  serviceLocationId: number;
  registrationNumber: string;
  vehicleType?: string;
  vehicleModelId?: number;
  /** Seating override for pricing (5 vs 7 seater). Defaults to model seat when omitted. */
  seatCategoryId?: number | null;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  notes?: string;
  effectiveFrom?: string;
};

export async function createVehicleAsset(req: Request, input: CreateVehicleAssetInput, tx: DbLike = db) {
  const loc = await resolveServiceLocationForCustomer(req, input.customerId, input.serviceLocationId, tx);
  if (!loc) throw new Error("Invalid service location for customer");

  const regNorm = normalizeRegistration(input.registrationNumber);
  const [dup] = await tx.select({ id: vehiclesTable.id }).from(vehiclesTable)
    .where(eq(vehiclesTable.registrationNormalized, regNorm)).limit(1);
  if (dup) throw new Error("Vehicle registration number already exists");

  let resolvedMake = input.make;
  let resolvedModel = input.model;
  let resolvedType = normalizeVehicleType(input.vehicleType);
  let resolvedModelId = input.vehicleModelId;
  let resolvedSeatId = input.seatCategoryId ?? null;

  if (input.vehicleModelId) {
    const { vehicleModelsTable, vehicleBrandsTable, vehicleCategoriesTable } = await import("@workspace/db");
    const [vm] = await tx
      .select({
        modelName: vehicleModelsTable.name,
        brandName: vehicleBrandsTable.name,
        categorySlug: vehicleCategoriesTable.slug,
        seatCategoryId: vehicleModelsTable.seatCategoryId,
      })
      .from(vehicleModelsTable)
      .innerJoin(vehicleBrandsTable, eq(vehicleModelsTable.brandId, vehicleBrandsTable.id))
      .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
      .where(eq(vehicleModelsTable.id, input.vehicleModelId))
      .limit(1);
    if (!vm) throw new Error("Invalid vehicleModelId");
    resolvedMake = vm.brandName;
    resolvedModel = vm.modelName;
    resolvedType = vehicleTypeFromCategorySlug(vm.categorySlug);
    if (resolvedSeatId == null) resolvedSeatId = vm.seatCategoryId;
  }

  if (!resolvedMake || !resolvedModel) throw new Error("vehicleModelId or make+model are required");

  const vehicleValues = tenantStamp(req, {
    customerId: input.customerId,
    vehicleModelId: resolvedModelId,
    seatCategoryId: resolvedSeatId,
    make: resolvedMake,
    model: resolvedModel,
    year: input.year,
    color: input.color,
    registrationNumber: input.registrationNumber,
    registrationNormalized: regNorm,
    vehicleType: resolvedType,
    locationComplete: false,
  });

  const [vehicle] = await tx.insert(vehiclesTable).values(vehicleValues as typeof vehiclesTable.$inferInsert).returning();

  const [asset] = await tx.insert(assetsTable).values(tenantStamp(req, {
    assetType: "vehicle",
    vehicleId: vehicle.id,
    label: vehicle.registrationNumber,
    notes: input.notes ?? null,
    status: "active",
    companyId: vehicle.companyId,
    franchiseeId: vehicle.franchiseeId,
    branchId: vehicle.branchId,
    updatedAt: new Date(),
  }) as typeof assetsTable.$inferInsert).returning();

  await insertAssetLinks(req, {
    assetId: asset.id,
    customerId: input.customerId,
    serviceLocationId: loc.id,
    effectiveFrom: input.effectiveFrom,
  }, tx);

  return { asset, vehicle };
}

export type CreateSolarAssetInput = {
  customerId: number;
  serviceLocationId: number;
  siteName: string;
  /** Optional metadata — not used for pricing. */
  panelCapacityKw?: string | number | null;
  /** Required for rate-card quoting. */
  panelCount: number;
  address?: string;
  city?: string;
  notes?: string;
  effectiveFrom?: string;
};

export async function createSolarAsset(req: Request, input: CreateSolarAssetInput, tx: DbLike = db) {
  const loc = await resolveServiceLocationForCustomer(req, input.customerId, input.serviceLocationId, tx);
  if (!loc) throw new Error("Invalid service location for customer");

  const [locationRow] = await tx.select().from(serviceLocationsTable).where(eq(serviceLocationsTable.id, loc.id)).limit(1);
  const address = input.address?.trim() || locationRow?.address || input.siteName;

  const siteValues = tenantStamp(req, {
    customerId: input.customerId,
    siteName: input.siteName.trim(),
    address,
    city: input.city ?? locationRow?.city ?? null,
    panelCount: input.panelCount,
    panelCapacityKw: input.panelCapacityKw != null && String(input.panelCapacityKw).trim() !== ""
      ? String(input.panelCapacityKw)
      : null,
    notes: input.notes ?? null,
    locationComplete: !!(locationRow?.latitude != null && locationRow?.longitude != null),
    serviceLat: locationRow?.latitude ?? null,
    serviceLng: locationRow?.longitude ?? null,
    placeId: locationRow?.placeId ?? null,
    locationLabel: locationRow?.label ?? null,
  });

  const [site] = await tx.insert(solarSitesTable).values(siteValues as typeof solarSitesTable.$inferInsert).returning();

  const [asset] = await tx.insert(assetsTable).values(tenantStamp(req, {
    assetType: "solar_site",
    solarSiteId: site.id,
    label: input.siteName.trim(),
    notes: input.notes ?? null,
    status: "active",
    companyId: site.companyId,
    franchiseeId: site.franchiseeId,
    branchId: site.branchId,
    updatedAt: new Date(),
  }) as typeof assetsTable.$inferInsert).returning();

  await insertAssetLinks(req, {
    assetId: asset.id,
    customerId: input.customerId,
    serviceLocationId: loc.id,
    effectiveFrom: input.effectiveFrom,
  }, tx);

  return { asset, solarSite: site };
}

export async function closeActiveCustomerLinks(assetId: number, until: string, tx: DbLike) {
  await tx.update(customerAssetLinksTable)
    .set({ effectiveUntil: until, updatedAt: new Date() })
    .where(and(
      eq(customerAssetLinksTable.assetId, assetId),
      isNull(customerAssetLinksTable.effectiveUntil),
      inArray(customerAssetLinksTable.linkType, ["commercial", "operational"]),
    ));
}

export async function closeActiveLocationLinks(assetId: number, until: string, tx: DbLike) {
  await tx.update(locationAssetLinksTable)
    .set({ effectiveUntil: until, updatedAt: new Date() })
    .where(and(
      eq(locationAssetLinksTable.assetId, assetId),
      isNull(locationAssetLinksTable.effectiveUntil),
    ));
}

export async function transferCustomerOwnership(
  req: Request,
  assetId: number,
  newCustomerId: number,
  opts: { effectiveFrom?: string; linkType?: CustomerAssetLinkType },
  tx: DbLike = db,
) {
  const effFrom = opts.effectiveFrom ?? todayIso();
  const until = effFrom; // previous link ends when new starts

  const [asset] = await tx.select().from(assetsTable).where(eq(assetsTable.id, assetId)).limit(1);
  if (!asset) throw new Error("Asset not found");

  await closeActiveCustomerLinks(assetId, until, tx);

  await tx.insert(customerAssetLinksTable).values({
    assetId,
    customerId: newCustomerId,
    linkType: opts.linkType ?? "commercial",
    effectiveFrom: effFrom,
    updatedAt: new Date(),
  });

  // Dual-read: keep legacy FKs in sync
  if (asset.vehicleId) {
    await tx.update(vehiclesTable).set({ customerId: newCustomerId, updatedAt: new Date() })
      .where(eq(vehiclesTable.id, asset.vehicleId));
  }
  if (asset.solarSiteId) {
    await tx.update(solarSitesTable).set({ customerId: newCustomerId, updatedAt: new Date() })
      .where(eq(solarSitesTable.id, asset.solarSiteId));
  }

  return asset;
}

export async function transferAssetLocation(
  req: Request,
  assetId: number,
  serviceLocationId: number,
  customerId: number,
  opts: { effectiveFrom?: string },
  tx: DbLike = db,
) {
  const loc = await resolveServiceLocationForCustomer(req, customerId, serviceLocationId, tx);
  if (!loc) throw new Error("Invalid service location for customer");

  const effFrom = opts.effectiveFrom ?? todayIso();
  await closeActiveLocationLinks(assetId, effFrom, tx);

  await tx.insert(locationAssetLinksTable).values({
    assetId,
    serviceLocationId: loc.id,
    effectiveFrom: effFrom,
    updatedAt: new Date(),
  });
}

export function activeLinkPredicate() {
  return or(
    isNull(customerAssetLinksTable.effectiveUntil),
    sql`${customerAssetLinksTable.effectiveUntil} >= CURRENT_DATE`,
  );
}

export async function listAssetsForQuery(params: {
  customerId?: number;
  assetType?: string;
  serviceLocationId?: number;
  limit: number;
  offset: number;
}) {
  const conditions = [];
  if (params.assetType === "vehicle" || params.assetType === "solar_site") {
    conditions.push(eq(assetsTable.assetType, params.assetType));
  }
  if (params.customerId) {
    conditions.push(eq(customerAssetLinksTable.customerId, params.customerId));
    conditions.push(activeLinkPredicate()!);
  }
  if (params.serviceLocationId) {
    conditions.push(eq(locationAssetLinksTable.serviceLocationId, params.serviceLocationId));
    conditions.push(or(
      isNull(locationAssetLinksTable.effectiveUntil),
      sql`${locationAssetLinksTable.effectiveUntil} >= CURRENT_DATE`,
    )!);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: assetsTable.id,
      assetType: assetsTable.assetType,
      vehicleId: assetsTable.vehicleId,
      solarSiteId: assetsTable.solarSiteId,
      label: assetsTable.label,
      notes: assetsTable.notes,
      status: assetsTable.status,
      companyId: assetsTable.companyId,
      franchiseeId: assetsTable.franchiseeId,
      branchId: assetsTable.branchId,
      createdAt: assetsTable.createdAt,
      updatedAt: assetsTable.updatedAt,
      serviceLocationId: locationAssetLinksTable.serviceLocationId,
      serviceLocationLabel: serviceLocationsTable.label,
      customerId: customerAssetLinksTable.customerId,
      customerName: customersTable.name,
      panelCount: solarSitesTable.panelCount,
    })
    .from(assetsTable)
    .leftJoin(locationAssetLinksTable, and(
      eq(locationAssetLinksTable.assetId, assetsTable.id),
      or(isNull(locationAssetLinksTable.effectiveUntil), sql`${locationAssetLinksTable.effectiveUntil} >= CURRENT_DATE`),
    ))
    .leftJoin(serviceLocationsTable, eq(locationAssetLinksTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(customerAssetLinksTable, and(
      eq(customerAssetLinksTable.assetId, assetsTable.id),
      activeLinkPredicate(),
      inArray(customerAssetLinksTable.linkType, ["commercial", "operational"]),
    ))
    .leftJoin(customersTable, eq(customerAssetLinksTable.customerId, customersTable.id))
    .leftJoin(solarSitesTable, eq(assetsTable.solarSiteId, solarSitesTable.id));

  const rows = await (where ? baseQuery.where(where) : baseQuery)
    .orderBy(desc(assetsTable.updatedAt))
    .limit(params.limit)
    .offset(params.offset);

  const countQuery = db.select({ count: sql<number>`count(distinct ${assetsTable.id})` }).from(assetsTable)
    .leftJoin(customerAssetLinksTable, eq(customerAssetLinksTable.assetId, assetsTable.id))
    .leftJoin(locationAssetLinksTable, eq(locationAssetLinksTable.assetId, assetsTable.id));

  const [countRow] = await (where ? countQuery.where(where) : countQuery);
  return { data: rows, total: Number(countRow?.count ?? 0) };
}

export async function getAssetDetail(assetId: number) {
  const [asset] = await db.select().from(assetsTable).where(eq(assetsTable.id, assetId)).limit(1);
  if (!asset) return null;

  const [vehicle] = asset.vehicleId
    ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, asset.vehicleId)).limit(1)
    : [undefined];
  const [solarSite] = asset.solarSiteId
    ? await db.select().from(solarSitesTable).where(eq(solarSitesTable.id, asset.solarSiteId)).limit(1)
    : [undefined];

  const locationLinks = await db
    .select({
      id: locationAssetLinksTable.id,
      serviceLocationId: locationAssetLinksTable.serviceLocationId,
      effectiveFrom: locationAssetLinksTable.effectiveFrom,
      effectiveUntil: locationAssetLinksTable.effectiveUntil,
      locationLabel: serviceLocationsTable.label,
      locationAddress: serviceLocationsTable.address,
    })
    .from(locationAssetLinksTable)
    .innerJoin(serviceLocationsTable, eq(locationAssetLinksTable.serviceLocationId, serviceLocationsTable.id))
    .where(eq(locationAssetLinksTable.assetId, assetId))
    .orderBy(desc(locationAssetLinksTable.effectiveFrom));

  const customerLinks = await db
    .select({
      id: customerAssetLinksTable.id,
      customerId: customerAssetLinksTable.customerId,
      linkType: customerAssetLinksTable.linkType,
      effectiveFrom: customerAssetLinksTable.effectiveFrom,
      effectiveUntil: customerAssetLinksTable.effectiveUntil,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
    })
    .from(customerAssetLinksTable)
    .innerJoin(customersTable, eq(customerAssetLinksTable.customerId, customersTable.id))
    .where(eq(customerAssetLinksTable.assetId, assetId))
    .orderBy(desc(customerAssetLinksTable.effectiveFrom));

  return { ...asset, vehicle, solarSite, locationLinks, customerLinks };
}
