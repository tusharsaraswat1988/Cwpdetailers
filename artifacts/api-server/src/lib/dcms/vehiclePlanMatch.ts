import {
  db,
  vehiclesTable,
  vehicleModelsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  type DcmsPlan,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getSeatPricingTier,
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
      seatCategoryId: vehicleModelsTable.seatCategoryId,
      vehicleCategoryName: vehicleCategoriesTable.name,
      seatCategoryName: seatCategoriesTable.name,
      seatCount: seatCategoriesTable.seatCount,
    })
    .from(vehiclesTable)
    .innerJoin(vehicleModelsTable, eq(vehiclesTable.vehicleModelId, vehicleModelsTable.id))
    .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .innerJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
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
  if (plan.vehicleCategoryId != null && plan.vehicleCategoryId !== vehicle.vehicleCategoryId) {
    return false;
  }
  if (plan.seatCategoryId != null) {
    if (planSeatCount == null) return false;
    if (!seatCountsShareTier(planSeatCount, vehicle.seatCount)) return false;
  }
  return true;
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
      + `Vehicle is ${vehicle.vehicleCategoryName} · ${vehicle.seatCategoryName} (${tierLabel}). `
      + `Choose a plan for the same car type and seater tier.`,
    );
  }
}
