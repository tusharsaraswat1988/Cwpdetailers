import { db } from "@workspace/db";
import {
  vehicleModelsTable,
  vehicleBrandsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  servicePricingTable,
  servicesTable,
  vehiclesTable,
} from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";

export interface PricingResult {
  amount: number;
  source: "pricing_matrix" | "base_price" | "solar_formula";
  vehicleCategory?: string;
  seatCategory?: string;
  seatCategoryId?: number;
  durationMinutes?: number;
}

export async function resolveVehiclePricing(
  serviceId: number,
  vehicleModelId: number,
  cityId?: number | null,
  seatCategoryIdOverride?: number | null,
  branchId?: number | null,
): Promise<PricingResult | null> {
  return resolveVehiclePricingWithCity(serviceId, vehicleModelId, cityId, seatCategoryIdOverride, branchId);
}

/**
 * Resolve wash pricing from matrix.
 * Precedence: Branch override -> City override -> Global default.
 * Seat category: override (vehicle.seatCategoryId) wins over model default.
 */
export async function resolveVehiclePricingWithCity(
  serviceId: number,
  vehicleModelId: number,
  cityId?: number | null,
  seatCategoryIdOverride?: number | null,
  branchId?: number | null,
): Promise<PricingResult | null> {
  const [model] = await db
    .select({
      vehicleCategoryId: vehicleModelsTable.vehicleCategoryId,
      seatCategoryId: vehicleModelsTable.seatCategoryId,
      categoryName: vehicleCategoriesTable.name,
      seatName: seatCategoriesTable.name,
    })
    .from(vehicleModelsTable)
    .leftJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .leftJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
    .where(eq(vehicleModelsTable.id, vehicleModelId))
    .limit(1);

  if (!model) return null;

  let seatCategoryId = model.seatCategoryId;
  let seatName = model.seatName ?? undefined;

  if (seatCategoryIdOverride != null) {
    const [seat] = await db.select({
      id: seatCategoriesTable.id,
      name: seatCategoriesTable.name,
    })
      .from(seatCategoriesTable)
      .where(eq(seatCategoriesTable.id, seatCategoryIdOverride))
      .limit(1);
    if (seat) {
      seatCategoryId = seat.id;
      seatName = seat.name;
    }
  }

  const pricingConditions = [
    eq(servicePricingTable.serviceId, serviceId),
    eq(servicePricingTable.isActive, true),
  ];

  const orBranchesOrCities = [];
  if (branchId) {
    orBranchesOrCities.push(eq(servicePricingTable.branchId, branchId));
  }
  if (cityId) {
    orBranchesOrCities.push(and(eq(servicePricingTable.cityId, cityId), isNull(servicePricingTable.branchId)));
  }
  orBranchesOrCities.push(and(isNull(servicePricingTable.cityId), isNull(servicePricingTable.branchId)));
  pricingConditions.push(or(...orBranchesOrCities)!);

  const rawPricing = await db
    .select()
    .from(servicePricingTable)
    .where(and(...pricingConditions));

  const now = new Date();
  const allPricing = rawPricing.filter(r => {
    if (r.effectiveFrom && new Date(r.effectiveFrom) > now) return false;
    if (r.effectiveUntil && new Date(r.effectiveUntil) < now) return false;
    return true;
  });

  const preferBranchThenCity = (rows: typeof allPricing) => {
    if (branchId) {
      const branchSpecific = rows.filter(r => r.branchId === branchId);
      if (branchSpecific.length) return branchSpecific;
    }
    if (cityId) {
      const citySpecific = rows.filter(r => r.cityId === cityId && !r.branchId);
      if (citySpecific.length) return citySpecific;
    }
    return rows.filter(r => !r.cityId && !r.branchId);
  };

  // Try exact match: category + seat
  const exactPool = preferBranchThenCity(allPricing.filter(r =>
    r.vehicleCategoryId === model.vehicleCategoryId &&
    r.seatCategoryId === seatCategoryId,
  ));
  const exact = exactPool[0];
  if (exact) {
    return {
      amount: parseFloat(exact.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: seatName,
      seatCategoryId: seatCategoryId ?? undefined,
      durationMinutes: exact.durationMinutes ?? undefined,
    };
  }

  // Fallback: seat category only
  const seatPool = preferBranchThenCity(allPricing.filter(r =>
    r.seatCategoryId === seatCategoryId && !r.vehicleCategoryId,
  ));
  const seatOnly = seatPool[0];
  if (seatOnly) {
    return {
      amount: parseFloat(seatOnly.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: seatName,
      seatCategoryId: seatCategoryId ?? undefined,
      durationMinutes: seatOnly.durationMinutes ?? undefined,
    };
  }

  // Fallback: category only
  const catPool = preferBranchThenCity(allPricing.filter(r =>
    r.vehicleCategoryId === model.vehicleCategoryId && !r.seatCategoryId,
  ));
  const catOnly = catPool[0];
  if (catOnly) {
    return {
      amount: parseFloat(catOnly.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: seatName,
      seatCategoryId: seatCategoryId ?? undefined,
      durationMinutes: catOnly.durationMinutes ?? undefined,
    };
  }

  const [svc] = await db
    .select({ basePrice: servicesTable.basePrice })
    .from(servicesTable)
    .where(eq(servicesTable.id, serviceId))
    .limit(1);

  if (svc) {
    return {
      amount: parseFloat(svc.basePrice),
      source: "base_price",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: seatName,
      seatCategoryId: seatCategoryId ?? undefined,
    };
  }

  return null;
}

export async function resolveBookingAmount(opts: {
  serviceId?: number | null;
  vehicleId?: number | null;
  solarSiteId?: number | null;
  serviceType?: string;
  panelCount?: number;
  cityId?: number | null;
  citySlug?: string;
  branchId?: number | null;
}): Promise<number | null> {
  if (opts.serviceId) {
    const { resolveCatalogPricing } = await import("./catalog/pricingEngine");
    let panelCount = opts.panelCount;
    if (!panelCount && opts.solarSiteId) {
      const { solarSitesTable } = await import("@workspace/db");
      const [site] = await db.select({ panelCount: solarSitesTable.panelCount })
        .from(solarSitesTable).where(eq(solarSitesTable.id, opts.solarSiteId)).limit(1);
      panelCount = site?.panelCount ?? undefined;
    }

    let vehicleModelId: number | undefined;
    let seatCategoryId: number | undefined;
    if (opts.vehicleId) {
      const [vehicle] = await db
        .select({
          vehicleModelId: vehiclesTable.vehicleModelId,
          seatCategoryId: vehiclesTable.seatCategoryId,
        })
        .from(vehiclesTable)
        .where(eq(vehiclesTable.id, opts.vehicleId))
        .limit(1);
      vehicleModelId = vehicle?.vehicleModelId ?? undefined;
      seatCategoryId = vehicle?.seatCategoryId ?? undefined;
    }

    const pricing = await resolveCatalogPricing({
      serviceId: opts.serviceId,
      vehicleModelId,
      seatCategoryId,
      panelCount,
      cityId: opts.cityId,
      citySlug: opts.citySlug,
      branchId: opts.branchId,
    });
    if (pricing) return pricing.amount;
  }

  return null;
}

export async function getVehicleModelDetails(vehicleModelId: number) {
  const [row] = await db
    .select({
      id: vehicleModelsTable.id,
      name: vehicleModelsTable.name,
      brandName: vehicleBrandsTable.name,
      categoryName: vehicleCategoriesTable.name,
      categorySlug: vehicleCategoriesTable.slug,
      seatName: seatCategoriesTable.name,
      seatCount: seatCategoriesTable.seatCount,
      seatCategoryId: seatCategoriesTable.id,
    })
    .from(vehicleModelsTable)
    .innerJoin(vehicleBrandsTable, eq(vehicleModelsTable.brandId, vehicleBrandsTable.id))
    .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .innerJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
    .where(eq(vehicleModelsTable.id, vehicleModelId))
    .limit(1);
  return row ?? null;
}
