/** Catalog services that duplicate DCMS monthly plans — must be sold via DCMS plan flow only. */
export function isDailyCleanCatalogServiceName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("daily") && (n.includes("clean") || n.includes("exterior"));
}
