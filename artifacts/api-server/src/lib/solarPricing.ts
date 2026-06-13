import { db } from "@workspace/db";
import { solarPricingSlabsTable, servicesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";

/** DB-driven solar pricing with legacy fallback (₹60/panel, min ₹800). */
export async function computeSolarCleaningPrice(
  panelCount: number,
  serviceId?: number,
  cityId?: number | null,
): Promise<number> {
  if (!Number.isFinite(panelCount) || panelCount <= 0) {
    throw new Error("panelCount must be a positive number");
  }

  if (serviceId) {
    const { resolveSolarSlabPrice } = await import("./catalog/pricingEngine");
    const result = await resolveSolarSlabPrice(serviceId, panelCount, cityId);
    if (result) return result.amount;
  }

  // Global fallback slab from DB (any solar service)
  const slabs = await db.select()
    .from(solarPricingSlabsTable)
    .where(eq(solarPricingSlabsTable.isActive, true))
    .orderBy(asc(solarPricingSlabsTable.sortOrder))
    .limit(1);

  if (slabs[0]) {
    const pricePerPanel = parseFloat(slabs[0].pricePerPanel);
    const minimumBilling = parseFloat(slabs[0].minimumBilling);
    return Math.max(minimumBilling, Math.round(panelCount * pricePerPanel));
  }

  // Last resort — should not occur after migration
  return Math.max(800, Math.round(panelCount * 60));
}

/** Sync helper for client-side estimate when serviceId unknown */
export function computeSolarCleaningPriceSync(panelCount: number, pricePerPanel = 60, minimumBilling = 800): number {
  if (!Number.isFinite(panelCount) || panelCount <= 0) {
    throw new Error("panelCount must be a positive number");
  }
  return Math.max(minimumBilling, Math.round(panelCount * pricePerPanel));
}

export async function getSolarPricingConfig(serviceId: number, cityId?: number | null) {
  const conditions = [eq(solarPricingSlabsTable.serviceId, serviceId), eq(solarPricingSlabsTable.isActive, true)];
  const slabs = await db.select().from(solarPricingSlabsTable)
    .where(and(...conditions))
    .orderBy(asc(solarPricingSlabsTable.sortOrder));

  const citySlabs = cityId ? slabs.filter(s => s.cityId === cityId || s.cityId == null) : slabs;
  return citySlabs.length ? citySlabs : slabs;
}

export async function resolveSolarServiceId(): Promise<number | null> {
  const [svc] = await db.select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.category, "solar_cleaning"))
    .limit(1);
  return svc?.id ?? null;
}
