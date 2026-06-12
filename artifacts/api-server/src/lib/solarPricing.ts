/** Solar cleaning price: ₹60/panel, minimum ₹800 (Varanasi MVP). */
export function computeSolarCleaningPrice(panelCount: number): number {
  if (!Number.isFinite(panelCount) || panelCount <= 0) {
    throw new Error("panelCount must be a positive number");
  }
  return Math.max(800, Math.round(panelCount * 60));
}
