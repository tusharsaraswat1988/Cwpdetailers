import { db } from "@workspace/db";
import { solarPricingSlabsTable, servicesTable, type SolarPricingTerm } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { resolveSolarSlabQuote } from "./catalog/pricingEngine";

/**
 * DB-driven solar pricing. Returns null when no slab matches or site visit is required.
 * Callers must handle needs_site_visit via resolveSolarSlabQuote / resolveCatalogPricing.
 */
export async function computeSolarCleaningPrice(
  panelCount: number,
  serviceId?: number,
  cityId?: number | null,
  term: SolarPricingTerm = "one_time",
): Promise<number | null> {
  if (!Number.isFinite(panelCount) || panelCount <= 0) {
    throw new Error("panelCount must be a positive number");
  }

  if (serviceId) {
    const quote = await resolveSolarSlabQuote({ serviceId, panelCount, cityId, term });
    if (quote.status === "priced" && quote.amount != null) return quote.amount;
    return null;
  }

  // Resolve any active one-time slab for a solar service (still DB-driven)
  const [svc] = await db.select({ id: servicesTable.id })
    .from(servicesTable)
    .where(eq(servicesTable.pricingModel, "solar_slab"))
    .limit(1);

  if (!svc) return null;

  const quote = await resolveSolarSlabQuote({
    serviceId: svc.id,
    panelCount,
    cityId,
    term,
  });
  if (quote.status === "priced" && quote.amount != null) return quote.amount;
  return null;
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
