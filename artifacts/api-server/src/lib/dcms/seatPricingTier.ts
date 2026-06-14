/** Business pricing tiers: up to 5 seats vs 6+ seats (matches website "5 seater" / "5+ seater"). */

export type SeatPricingTier = "standard" | "large";

export const SEAT_TIER_CANONICAL_SLUGS: Record<SeatPricingTier, string> = {
  standard: "5-seater",
  large: "7-seater",
};

export function getSeatPricingTier(seatCount: number): SeatPricingTier {
  return seatCount <= 5 ? "standard" : "large";
}

export function getSeatTierLabel(tier: SeatPricingTier): string {
  return tier === "standard" ? "Up to 5 Seater" : "5+ Seater";
}

export function seatCountsShareTier(a: number, b: number): boolean {
  return getSeatPricingTier(a) === getSeatPricingTier(b);
}
