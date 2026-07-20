/**
 * Client-side helper — rates must be passed from the catalog quote / rate card.
 * No default ₹/panel or minimum billing is embedded here.
 */
export function computeSolarCleaningPrice(
  panelCount: number,
  pricePerPanel: number,
  minimumBilling: number,
): number {
  if (!Number.isFinite(panelCount) || panelCount <= 0) return minimumBilling;
  if (!Number.isFinite(pricePerPanel) || !Number.isFinite(minimumBilling)) {
    throw new Error("pricePerPanel and minimumBilling must come from the rate card");
  }
  return Math.max(minimumBilling, Math.round(panelCount * pricePerPanel));
}
