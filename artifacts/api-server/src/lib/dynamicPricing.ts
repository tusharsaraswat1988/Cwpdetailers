import { db } from "@workspace/db";
import {
  vehicleModelsTable,
  vehicleBrandsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  servicePricingTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";

export interface PricingResult {
  amount: number;
  source: "pricing_matrix" | "base_price" | "solar_formula";
  vehicleCategory?: string;
  seatCategory?: string;
  durationMinutes?: number;
}

export async function resolveVehiclePricing(
  serviceId: number,
  vehicleModelId: number,
  cityId?: number | null,
): Promise<PricingResult | null> {
  return resolveVehiclePricingWithCity(serviceId, vehicleModelId, cityId);
}

export async function resolveVehiclePricingWithCity(
  serviceId: number,
  vehicleModelId: number,
  cityId?: number | null,
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

  const pricingConditions = [
    eq(servicePricingTable.serviceId, serviceId),
    eq(servicePricingTable.isActive, true),
  ];

  if (cityId) {
    pricingConditions.push(
      or(eq(servicePricingTable.cityId, cityId), isNull(servicePricingTable.cityId))!,
    );
  }

  const allPricing = await db
    .select()
    .from(servicePricingTable)
    .where(and(...pricingConditions));

  const preferCity = (rows: typeof allPricing) => {
    const citySpecific = rows.filter(r => r.cityId === cityId);
    return citySpecific.length ? citySpecific : rows.filter(r => r.cityId == null);
  };

  // Try exact match: category + seat
  const exactPool = preferCity(allPricing.filter(r =>
    r.vehicleCategoryId === model.vehicleCategoryId &&
    r.seatCategoryId === model.seatCategoryId,
  ));
  const exact = exactPool[0];
  if (exact) {
    return {
      amount: parseFloat(exact.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: model.seatName ?? undefined,
      durationMinutes: exact.durationMinutes ?? undefined,
    };
  }

  // Fallback: seat category only
  const seatPool = preferCity(allPricing.filter(r =>
    r.seatCategoryId === model.seatCategoryId && !r.vehicleCategoryId,
  ));
  const seatOnly = seatPool[0];
  if (seatOnly) {
    return {
      amount: parseFloat(seatOnly.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: model.seatName ?? undefined,
      durationMinutes: seatOnly.durationMinutes ?? undefined,
    };
  }

  // Fallback: category only
  const catPool = preferCity(allPricing.filter(r =>
    r.vehicleCategoryId === model.vehicleCategoryId && !r.seatCategoryId,
  ));
  const catOnly = catPool[0];
  if (catOnly) {
    return {
      amount: parseFloat(catOnly.price),
      source: "pricing_matrix",
      vehicleCategory: model.categoryName ?? undefined,
      seatCategory: model.seatName ?? undefined,
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
      seatCategory: model.seatName ?? undefined,
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
    if (opts.vehicleId) {
      const { vehiclesTable } = await import("@workspace/db");
      const [vehicle] = await db
        .select({ vehicleModelId: vehiclesTable.vehicleModelId })
        .from(vehiclesTable)
        .where(eq(vehiclesTable.id, opts.vehicleId))
        .limit(1);
      vehicleModelId = vehicle?.vehicleModelId ?? undefined;
    }

    const pricing = await resolveCatalogPricing({
      serviceId: opts.serviceId,
      vehicleModelId,
      panelCount,
      cityId: opts.cityId,
      citySlug: opts.citySlug,
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
    })
    .from(vehicleModelsTable)
    .innerJoin(vehicleBrandsTable, eq(vehicleModelsTable.brandId, vehicleBrandsTable.id))
    .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .innerJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
    .where(eq(vehicleModelsTable.id, vehicleModelId))
    .limit(1);
  return row ?? null;
}
