import { db } from "@workspace/db";
import {
  vehicleModelsTable,
  vehicleBrandsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  servicePricingTable,
  servicesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { computeSolarCleaningPrice } from "./solarPricing";

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

  // Try exact match: category + seat
  const [exact] = await db
    .select()
    .from(servicePricingTable)
    .where(and(
      ...pricingConditions,
      eq(servicePricingTable.vehicleCategoryId, model.vehicleCategoryId),
      eq(servicePricingTable.seatCategoryId, model.seatCategoryId),
    ))
    .limit(1);

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
  const [seatOnly] = await db
    .select()
    .from(servicePricingTable)
    .where(and(
      ...pricingConditions,
      eq(servicePricingTable.seatCategoryId, model.seatCategoryId),
    ))
    .limit(1);

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
  const [catOnly] = await db
    .select()
    .from(servicePricingTable)
    .where(and(
      ...pricingConditions,
      eq(servicePricingTable.vehicleCategoryId, model.vehicleCategoryId),
    ))
    .limit(1);

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
}): Promise<number | null> {
  if (opts.solarSiteId && opts.serviceType === "solar_cleaning" && opts.panelCount) {
    return computeSolarCleaningPrice(opts.panelCount);
  }

  if (opts.serviceId && opts.vehicleId) {
    const { vehiclesTable } = await import("@workspace/db");
    const [vehicle] = await db
      .select({ vehicleModelId: vehiclesTable.vehicleModelId })
      .from(vehiclesTable)
      .where(eq(vehiclesTable.id, opts.vehicleId))
      .limit(1);

    if (vehicle?.vehicleModelId) {
      const pricing = await resolveVehiclePricing(opts.serviceId, vehicle.vehicleModelId);
      if (pricing) return pricing.amount;
    }
  }

  if (opts.serviceId) {
    const [svc] = await db
      .select({ basePrice: servicesTable.basePrice })
      .from(servicesTable)
      .where(eq(servicesTable.id, opts.serviceId))
      .limit(1);
    if (svc) return parseFloat(svc.basePrice);
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
