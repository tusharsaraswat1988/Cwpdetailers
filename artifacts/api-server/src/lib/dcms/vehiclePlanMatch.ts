import {
  db,
  vehiclesTable,
  vehicleModelsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  type DcmsPlan,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  getSeatPricingTier,
  getSeatTierLabel,
  seatCountsShareTier,
  type SeatPricingTier,
} from "./seatPricingTier";

export type VehiclePlanContext = {
  vehicleId: number;
  vehicleModelId: number | null;
  vehicleCategoryId: number;
  seatCategoryId: number;
  vehicleCategoryName: string;
  seatCategoryName: string;
  seatCount: number;
  seatPricingTier: SeatPricingTier;
};

export async function getVehiclePlanContext(vehicleId: number): Promise<VehiclePlanContext | null> {
  const [row] = await db
    .select({
      vehicleId: vehiclesTable.id,
      vehicleModelId: vehiclesTable.vehicleModelId,
      vehicleCategoryId: vehicleModelsTable.vehicleCategoryId,
      seatCategoryId: sql<number>`coalesce(${vehiclesTable.seatCategoryId}, ${vehicleModelsTable.seatCategoryId})`,
      vehicleCategoryName: vehicleCategoriesTable.name,
      seatCategoryName: seatCategoriesTable.name,
      seatCount: seatCategoriesTable.seatCount,
    })
    .from(vehiclesTable)
    .innerJoin(vehicleModelsTable, eq(vehiclesTable.vehicleModelId, vehicleModelsTable.id))
    .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .innerJoin(
      seatCategoriesTable,
      sql`${seatCategoriesTable.id} = coalesce(${vehiclesTable.seatCategoryId}, ${vehicleModelsTable.seatCategoryId})`,
    )
    .where(eq(vehiclesTable.id, vehicleId))
    .limit(1);

  if (!row?.vehicleModelId) return null;
  return {
    ...row,
    seatPricingTier: getSeatPricingTier(row.seatCount),
  };
}

export function planMatchesVehicle(
  plan: DcmsPlan,
  vehicle: VehiclePlanContext,
  planSeatCount?: number | null,
): boolean {
  // Pricing is keyed by seater tier only — car type does not affect plan matching.
  if (plan.seatCategoryId != null) {
    if (planSeatCount == null) return false;
    if (!seatCountsShareTier(planSeatCount, vehicle.seatCount)) return false;
  }
  return true;
}

export function getPlanInapplicableReason(
  plan: Pick<DcmsPlan, "seatCategoryId">,
  vehicle: VehiclePlanContext,
  planSeatCount?: number | null,
  planSeatLabel?: string | null,
): string {
  const vehicleLabel = `${vehicle.seatCategoryName} (${getSeatTierLabel(vehicle.seatPricingTier)})`;
  if (plan.seatCategoryId == null) {
    return `Vehicle is ${vehicleLabel}`;
  }
  const planLabel = planSeatLabel
    ?? (planSeatCount != null ? getSeatTierLabel(getSeatPricingTier(planSeatCount)) : "another seater tier");
  return `Vehicle is ${vehicleLabel}; plan is for ${planLabel}`;
}

export function assertPlanMatchesVehicle(
  plan: DcmsPlan,
  vehicle: VehiclePlanContext,
  planSeatCount?: number | null,
): void {
  if (!planMatchesVehicle(plan, vehicle, planSeatCount)) {
    const tierLabel = vehicle.seatPricingTier === "standard" ? "up to 5 seater" : "5+ seater";
    throw new Error(
      `Plan "${plan.name}" does not match this vehicle. `
      + `Vehicle is ${vehicle.seatCategoryName} (${tierLabel}). `
      + `Choose a plan for the same seater tier.`,
    );
  }
}
