import { db } from "@workspace/db";
import {
  catalogSettingsTable,
  servicesTable,
  servicePricingTable,
  solarPricingSlabsTable,
  serviceCityAvailabilityTable,
  citiesTable,
} from "@workspace/db";
import { eq, and, or, isNull, lte, gte, asc, desc } from "drizzle-orm";
import { computeGst, splitGstInclusive } from "../gst";

export type PricingBreakdown = {
  baseAmount: number;
  gstRate: number;
  pricingType: "inclusive" | "exclusive";
  subtotal: number;
  gst: number;
  total: number;
  displayPrice: number;
};

export async function getCatalogSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(catalogSettingsTable).where(eq(catalogSettingsTable.key, key)).limit(1);
  if (!row) return fallback;
  return row.value as T;
}

export async function getDefaultGstMode(): Promise<"inclusive" | "exclusive"> {
  return getCatalogSetting("default_gst_mode", "inclusive");
}

export async function getDefaultGstRate(): Promise<number> {
  const rate = await getCatalogSetting<number | string>("default_gst_rate", 18);
  return typeof rate === "string" ? parseFloat(rate) : rate;
}

export function buildPricingBreakdown(
  amount: number,
  gstRate: number,
  pricingType: "inclusive" | "exclusive",
): PricingBreakdown {
  if (pricingType === "inclusive") {
    const { subtotal, gst, total } = splitGstInclusive(amount, gstRate);
    return { baseAmount: amount, gstRate, pricingType, subtotal, gst, total, displayPrice: total };
  }
  const { subtotal, gst, total } = computeGst(amount, gstRate);
  return { baseAmount: amount, gstRate, pricingType, subtotal, gst, total, displayPrice: total };
}

export async function resolveCityId(citySlugOrId?: string | number | null): Promise<number | null> {
  if (citySlugOrId == null) return null;
  if (typeof citySlugOrId === "number") return citySlugOrId;
  const [city] = await db.select({ id: citiesTable.id })
    .from(citiesTable)
    .where(eq(citiesTable.slug, citySlugOrId.toLowerCase()))
    .limit(1);
  return city?.id ?? null;
}

/** Resolve Varanasi as default operating city */
export async function getDefaultCityId(): Promise<number | null> {
  return resolveCityId("varanasi");
}

export async function isServiceAvailableInCity(serviceId: number, cityId: number): Promise<boolean> {
  const [row] = await db.select()
    .from(serviceCityAvailabilityTable)
    .where(and(
      eq(serviceCityAvailabilityTable.serviceId, serviceId),
      eq(serviceCityAvailabilityTable.cityId, cityId),
      eq(serviceCityAvailabilityTable.isActive, true),
    ))
    .limit(1);
  return !!row;
}

export async function resolveSolarSlabPrice(
  serviceId: number,
  panelCount: number,
  cityId?: number | null,
): Promise<{ amount: number; slabId?: number; pricePerPanel: number; minimumBilling: number } | null> {
  if (!Number.isFinite(panelCount) || panelCount <= 0) return null;

  const conditions = [
    eq(solarPricingSlabsTable.serviceId, serviceId),
    eq(solarPricingSlabsTable.isActive, true),
    lte(solarPricingSlabsTable.minPanels, panelCount),
  ];

  const slabs = await db.select()
    .from(solarPricingSlabsTable)
    .where(and(...conditions))
    .orderBy(desc(solarPricingSlabsTable.sortOrder), asc(solarPricingSlabsTable.minPanels));

  let matched = slabs.find(s =>
    (s.cityId == null || s.cityId === cityId) &&
    (s.maxPanels == null || panelCount <= s.maxPanels),
  );

  if (!matched && cityId) {
    matched = slabs.find(s =>
      s.cityId == null &&
      (s.maxPanels == null || panelCount <= s.maxPanels),
    );
  }

  if (!matched) return null;

  const pricePerPanel = parseFloat(matched.pricePerPanel);
  const minimumBilling = parseFloat(matched.minimumBilling);
  const raw = panelCount * pricePerPanel;
  return {
    amount: Math.max(minimumBilling, Math.round(raw)),
    slabId: matched.id,
    pricePerPanel,
    minimumBilling,
  };
}

export interface CatalogPricingResult {
  amount: number;
  source: "pricing_matrix" | "city_override" | "base_price" | "solar_slab";
  vehicleCategory?: string;
  seatCategory?: string;
  durationMinutes?: number;
  gstRate: number;
  pricingType: "inclusive" | "exclusive";
  breakdown: PricingBreakdown;
  cityId?: number | null;
}

export async function resolveCatalogPricing(opts: {
  serviceId: number;
  vehicleModelId?: number;
  panelCount?: number;
  cityId?: number | null;
  citySlug?: string;
}): Promise<CatalogPricingResult | null> {
  const cityId = opts.cityId ?? (opts.citySlug ? await resolveCityId(opts.citySlug) : await getDefaultCityId());

  const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.id, opts.serviceId)).limit(1);
  if (!svc || svc.status === "archived" || !svc.isActive) return null;

  const gstRate = parseFloat(svc.gstRate ?? "18");
  const pricingType = (svc.pricingType ?? "inclusive") as "inclusive" | "exclusive";
  const model = svc.pricingModel ?? "fixed";

  if (model === "solar_slab" && opts.panelCount) {
    const solar = await resolveSolarSlabPrice(opts.serviceId, opts.panelCount, cityId);
    if (solar) {
      const breakdown = buildPricingBreakdown(solar.amount, gstRate, pricingType);
      return {
        amount: breakdown.total,
        source: "solar_slab",
        gstRate,
        pricingType,
        breakdown,
        cityId,
      };
    }
  }

  if (model === "vehicle_matrix" && opts.vehicleModelId) {
    const { resolveVehiclePricingWithCity } = await import("../dynamicPricing");
    const pricing = await resolveVehiclePricingWithCity(opts.serviceId, opts.vehicleModelId, cityId);
    if (pricing) {
      const breakdown = buildPricingBreakdown(pricing.amount, gstRate, pricingType);
      return {
        amount: breakdown.total,
        source: pricing.source === "solar_formula" ? "solar_slab" as const : "pricing_matrix" as const,
        vehicleCategory: pricing.vehicleCategory,
        seatCategory: pricing.seatCategory,
        durationMinutes: pricing.durationMinutes,
        gstRate,
        pricingType,
        breakdown,
        cityId,
      };
    }
  }

  let baseAmount = parseFloat(svc.basePrice);
  let source: CatalogPricingResult["source"] = "base_price";

  if (cityId) {
    const [cityRow] = await db.select()
      .from(serviceCityAvailabilityTable)
      .where(and(
        eq(serviceCityAvailabilityTable.serviceId, opts.serviceId),
        eq(serviceCityAvailabilityTable.cityId, cityId),
        eq(serviceCityAvailabilityTable.isActive, true),
      ))
      .limit(1);
    if (cityRow?.basePriceOverride) {
      baseAmount = parseFloat(cityRow.basePriceOverride);
      source = "city_override";
    }
  }

  const breakdown = buildPricingBreakdown(baseAmount, gstRate, pricingType);
  return {
    amount: breakdown.total,
    source,
    durationMinutes: svc.durationMinutes ?? undefined,
    gstRate,
    pricingType,
    breakdown,
    cityId,
  };
}
