/** Client-side estimate — defaults match catalog migration (₹60/panel, min ₹800). Prefer API /catalog/pricing/quote for live pricing. */
export function computeSolarCleaningPrice(panelCount: number, pricePerPanel = 60, minimumBilling = 800): number {
  if (!Number.isFinite(panelCount) || panelCount <= 0) return minimumBilling;
  return Math.max(minimumBilling, Math.round(panelCount * pricePerPanel));
}
