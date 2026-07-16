/**
 * Catalog services that duplicate DCMS monthly plans must be sold via the
 * DCMS plan flow only — never as a one-time catalog service.
 *
 * Shared by API (authoritative rejection) and admin UI (filter options).
 * Keep this heuristic in one place until catalog services gain an explicit
 * "plan-only" flag in master data.
 */
export function isDailyCleanCatalogServiceName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("daily") && (n.includes("clean") || n.includes("exterior"));
}
