/** Client-side mirror of api-server solar pricing (₹60/panel, min ₹800). */
export function computeSolarCleaningPrice(panelCount: number): number {
  if (!Number.isFinite(panelCount) || panelCount <= 0) return 800;
  return Math.max(800, Math.round(panelCount * 60));
}
