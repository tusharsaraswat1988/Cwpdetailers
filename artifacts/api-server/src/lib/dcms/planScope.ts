import type { SeatPricingTier } from "./seatPricingTier";

export type PlanScopeInput = {
  allVehicleCategories?: boolean;
  vehicleCategoryIds?: number[];
  allSeatTiers?: boolean;
  seatPricingTiers?: SeatPricingTier[];
};

export function resolveVehicleScopes(input: PlanScopeInput): (number | null)[] {
  if (input.allVehicleCategories || !input.vehicleCategoryIds?.length) return [null];
  return [...new Set(input.vehicleCategoryIds)];
}

export function expandPlanScopes(
  input: PlanScopeInput,
  seatCategoryIdByTier: Map<SeatPricingTier, number>,
): Array<{ vehicleCategoryId: number | null; seatCategoryId: number | null }> {
  const seats = input.allSeatTiers || !input.seatPricingTiers?.length
    ? [null]
    : [...new Set(input.seatPricingTiers)].map(tier => {
      const id = seatCategoryIdByTier.get(tier);
      if (id == null) throw new Error(`Seat category not configured for tier: ${tier}`);
      return id;
    });

  // Plans are priced by seater tier only — car type is always null (all types).
  return seats.map(seatCategoryId => ({ vehicleCategoryId: null, seatCategoryId }));
}
