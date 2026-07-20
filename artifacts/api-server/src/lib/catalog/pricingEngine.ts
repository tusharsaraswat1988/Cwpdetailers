import { db } from "@workspace/db";
import {
  catalogSettingsTable,
  servicesTable,
  solarPricingSlabsTable,
  serviceCityAvailabilityTable,
  citiesTable,
  catalogPackagesTable,
  catalogPackageEntitlementsTable,
  type SolarPricingTerm,
} from "@workspace/db";
import { eq, and, lte, asc, desc } from "drizzle-orm";
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

export type SolarSlabMatch = {
  slabId: number;
  term: SolarPricingTerm;
  minPanels: number;
  maxPanels: number | null;
  pricePerPanel: number | null;
  minimumBilling: number;
  requiresSiteVisit: boolean;
  serviceId: number;
  packageId: number | null;
  cityId: number | null;
};

export type SolarQuoteResult = {
  status: "priced" | "needs_site_visit" | "no_slab";
  term: SolarPricingTerm;
  panelCount: number;
  amount?: number;
  pricePerPanel?: number;
  minimumBilling?: number;
  slabId?: number;
  minPanels?: number;
  maxPanels?: number | null;
  requiresSiteVisit: boolean;
  message?: string;
  matched?: SolarSlabMatch;
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

/** Resolve default operating city from catalog settings, then common slug. */
export async function getDefaultCityId(): Promise<number | null> {
  const slug = await getCatalogSetting<string | null>("default_city_slug", "varanasi");
  if (slug) {
    const id = await resolveCityId(slug);
    if (id) return id;
  }
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

function panelInRange(panelCount: number, minPanels: number, maxPanels: number | null): boolean {
  if (panelCount < minPanels) return false;
  if (maxPanels != null && panelCount > maxPanels) return false;
  return true;
}

function preferCityMatch<T extends { cityId: number | null }>(
  rows: T[],
  cityId?: number | null,
): T | undefined {
  if (!rows.length) return undefined;
  if (cityId != null) {
    const citySpecific = rows.find(r => r.cityId === cityId);
    if (citySpecific) return citySpecific;
  }
  return rows.find(r => r.cityId == null) ?? rows[0];
}

/**
 * Match an active solar rate-card row for panel count + term.
 * All thresholds and rates come from DB — nothing is hardcoded here.
 */
export async function matchSolarSlab(opts: {
  serviceId?: number;
  packageId?: number;
  term: SolarPricingTerm;
  panelCount: number;
  cityId?: number | null;
}): Promise<SolarSlabMatch | null> {
  const { term, panelCount, cityId } = opts;
  if (!Number.isFinite(panelCount) || panelCount <= 0) return null;

  const conditions = [
    eq(solarPricingSlabsTable.isActive, true),
    eq(solarPricingSlabsTable.term, term),
    lte(solarPricingSlabsTable.minPanels, panelCount),
  ];

  if (opts.packageId != null) {
    conditions.push(eq(solarPricingSlabsTable.packageId, opts.packageId));
  } else if (opts.serviceId != null) {
    conditions.push(eq(solarPricingSlabsTable.serviceId, opts.serviceId));
    // Prefer service-level one-time rows (packageId null) when quoting a service
    if (term === "one_time") {
      // packageId filter applied in JS below for null package rows
    }
  } else {
    return null;
  }

  const slabs = await db.select()
    .from(solarPricingSlabsTable)
    .where(and(...conditions))
    .orderBy(desc(solarPricingSlabsTable.sortOrder), asc(solarPricingSlabsTable.minPanels));

  const inRange = slabs.filter(s => {
    if (!panelInRange(panelCount, s.minPanels, s.maxPanels)) return false;
    if (opts.packageId == null && term === "one_time" && s.packageId != null) return false;
    if (cityId != null) return s.cityId == null || s.cityId === cityId;
    return true;
  });

  const matched = preferCityMatch(inRange, cityId);
  if (!matched) return null;

  return {
    slabId: matched.id,
    term: matched.term as SolarPricingTerm,
    minPanels: matched.minPanels,
    maxPanels: matched.maxPanels,
    pricePerPanel: matched.pricePerPanel != null ? parseFloat(matched.pricePerPanel) : null,
    minimumBilling: parseFloat(matched.minimumBilling),
    requiresSiteVisit: matched.requiresSiteVisit,
    serviceId: matched.serviceId,
    packageId: matched.packageId,
    cityId: matched.cityId,
  };
}

/**
 * Resolve solar quote from configurable slabs.
 * Formula when priced: max(minimumBilling, round(panelCount × pricePerPanel))
 * Both minimumBilling and pricePerPanel come from the matched slab row.
 */
export async function resolveSolarSlabQuote(opts: {
  serviceId?: number;
  packageId?: number;
  term?: SolarPricingTerm;
  panelCount: number;
  cityId?: number | null;
}): Promise<SolarQuoteResult> {
  const panelCount = opts.panelCount;
  let term: SolarPricingTerm = opts.term ?? "one_time";

  if (opts.packageId != null && !opts.term) {
    const [pkg] = await db.select({ solarTerm: catalogPackagesTable.solarTerm })
      .from(catalogPackagesTable)
      .where(eq(catalogPackagesTable.id, opts.packageId))
      .limit(1);
    if (pkg?.solarTerm) term = pkg.solarTerm as SolarPricingTerm;
  }

  if (!Number.isFinite(panelCount) || panelCount <= 0) {
    return {
      status: "no_slab",
      term,
      panelCount,
      requiresSiteVisit: false,
      message: "panelCount must be a positive number",
    };
  }

  // If quoting a package without serviceId, resolve linked solar service for slab match fallback
  let serviceId = opts.serviceId;
  if (serviceId == null && opts.packageId != null) {
    const [ent] = await db.select({ serviceId: catalogPackageEntitlementsTable.serviceId })
      .from(catalogPackageEntitlementsTable)
      .where(and(
        eq(catalogPackageEntitlementsTable.packageId, opts.packageId),
        eq(catalogPackageEntitlementsTable.entitlementType, "solar_visit"),
      ))
      .limit(1);
    serviceId = ent?.serviceId;
  }

  // Prefer package-scoped slabs, then service+term slabs
  let matched: SolarSlabMatch | null = null;
  if (opts.packageId != null) {
    matched = await matchSolarSlab({
      packageId: opts.packageId,
      term,
      panelCount,
      cityId: opts.cityId,
    });
  }
  if (!matched && serviceId != null) {
    matched = await matchSolarSlab({
      serviceId,
      term,
      panelCount,
      cityId: opts.cityId,
    });
  }

  if (!matched) {
    return {
      status: "no_slab",
      term,
      panelCount,
      requiresSiteVisit: false,
      message: "No active rate-card slab matches this panel count and term",
    };
  }

  if (matched.requiresSiteVisit || matched.pricePerPanel == null || !Number.isFinite(matched.pricePerPanel)) {
    return {
      status: "needs_site_visit",
      term,
      panelCount,
      slabId: matched.slabId,
      minPanels: matched.minPanels,
      maxPanels: matched.maxPanels,
      minimumBilling: matched.minimumBilling,
      requiresSiteVisit: true,
      matched,
      message: "Site visit required — rates finalized after callback and site assessment",
    };
  }

  const raw = panelCount * matched.pricePerPanel;
  const amount = Math.max(matched.minimumBilling, Math.round(raw));

  return {
    status: "priced",
    term,
    panelCount,
    amount,
    pricePerPanel: matched.pricePerPanel,
    minimumBilling: matched.minimumBilling,
    slabId: matched.slabId,
    minPanels: matched.minPanels,
    maxPanels: matched.maxPanels,
    requiresSiteVisit: false,
    matched,
  };
}

/** @deprecated Use resolveSolarSlabQuote — kept for callers that only need a number. */
export async function resolveSolarSlabPrice(
  serviceId: number,
  panelCount: number,
  cityId?: number | null,
  term: SolarPricingTerm = "one_time",
): Promise<{ amount: number; slabId?: number; pricePerPanel: number; minimumBilling: number } | null> {
  const quote = await resolveSolarSlabQuote({ serviceId, panelCount, cityId, term });
  if (quote.status !== "priced" || quote.amount == null || quote.pricePerPanel == null) return null;
  return {
    amount: quote.amount,
    slabId: quote.slabId,
    pricePerPanel: quote.pricePerPanel,
    minimumBilling: quote.minimumBilling ?? 0,
  };
}

export interface CatalogPricingResult {
  status: "priced" | "needs_site_visit" | "no_slab" | "base";
  amount: number;
  source: "pricing_matrix" | "city_override" | "base_price" | "solar_slab" | "manual";
  vehicleCategory?: string;
  seatCategory?: string;
  durationMinutes?: number;
  gstRate: number;
  pricingType: "inclusive" | "exclusive";
  breakdown: PricingBreakdown;
  cityId?: number | null;
  solar?: SolarQuoteResult;
  message?: string;
}

export async function resolveCatalogPricing(opts: {
  serviceId?: number;
  packageId?: number;
  vehicleModelId?: number;
  /** Per-vehicle seating override (wins over model default). */
  seatCategoryId?: number | null;
  panelCount?: number;
  term?: SolarPricingTerm;
  cityId?: number | null;
  citySlug?: string;
  /** Advisor override after site visit — skips slab math when set. */
  manualAmount?: number;
}): Promise<CatalogPricingResult | null> {
  const cityId = opts.cityId ?? (opts.citySlug ? await resolveCityId(opts.citySlug) : await getDefaultCityId());

  // ── Package (solar AMC) path ─────────────────────────────────────────────
  if (opts.packageId != null) {
    const [pkg] = await db.select().from(catalogPackagesTable)
      .where(eq(catalogPackagesTable.id, opts.packageId))
      .limit(1);
    if (!pkg || pkg.status === "archived") return null;

    const gstRate = parseFloat(pkg.gstRate ?? "18");
    const pricingType = (pkg.pricingType ?? "exclusive") as "inclusive" | "exclusive";
    const term = (opts.term ?? pkg.solarTerm ?? "amc_6") as SolarPricingTerm;

    if (opts.manualAmount != null && Number.isFinite(opts.manualAmount) && opts.manualAmount >= 0) {
      const breakdown = buildPricingBreakdown(opts.manualAmount, gstRate, pricingType);
      return {
        status: "priced",
        amount: breakdown.total,
        source: "manual",
        gstRate,
        pricingType,
        breakdown,
        cityId,
        message: "Manual amount after site visit",
      };
    }

    if (opts.panelCount != null && pkg.solarTerm) {
      const solar = await resolveSolarSlabQuote({
        packageId: opts.packageId,
        term,
        panelCount: opts.panelCount,
        cityId,
      });

      if (solar.status === "needs_site_visit") {
        const breakdown = buildPricingBreakdown(0, gstRate, pricingType);
        return {
          status: "needs_site_visit",
          amount: 0,
          source: "solar_slab",
          gstRate,
          pricingType,
          breakdown,
          cityId,
          solar,
          message: solar.message,
        };
      }

      if (solar.status === "priced" && solar.amount != null) {
        const breakdown = buildPricingBreakdown(solar.amount, gstRate, pricingType);
        return {
          status: "priced",
          amount: breakdown.total,
          source: "solar_slab",
          gstRate,
          pricingType,
          breakdown,
          cityId,
          solar,
        };
      }
    }

    // Fallback to catalog package list price (still DB-driven, not app constants)
    const baseAmount = parseFloat(pkg.price);
    const breakdown = buildPricingBreakdown(baseAmount, gstRate, pricingType);
    return {
      status: "priced",
      amount: breakdown.total,
      source: "base_price",
      gstRate,
      pricingType,
      breakdown,
      cityId,
    };
  }

  if (opts.serviceId == null) return null;

  const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.id, opts.serviceId)).limit(1);
  if (!svc || svc.status === "archived" || !svc.isActive) return null;

  const gstRate = parseFloat(svc.gstRate ?? "18");
  const pricingType = (svc.pricingType ?? "inclusive") as "inclusive" | "exclusive";
  const model = svc.pricingModel ?? "fixed";

  if (opts.manualAmount != null && Number.isFinite(opts.manualAmount) && opts.manualAmount >= 0) {
    const breakdown = buildPricingBreakdown(opts.manualAmount, gstRate, pricingType);
    return {
      status: "priced",
      amount: breakdown.total,
      source: "manual",
      gstRate,
      pricingType,
      breakdown,
      cityId,
      message: "Manual amount after site visit",
    };
  }

  if (model === "solar_slab" && opts.panelCount != null) {
    const solar = await resolveSolarSlabQuote({
      serviceId: opts.serviceId,
      term: opts.term ?? "one_time",
      panelCount: opts.panelCount,
      cityId,
    });

    if (solar.status === "needs_site_visit") {
      const breakdown = buildPricingBreakdown(0, gstRate, pricingType);
      return {
        status: "needs_site_visit",
        amount: 0,
        source: "solar_slab",
        gstRate,
        pricingType,
        breakdown,
        cityId,
        solar,
        message: solar.message,
      };
    }

    if (solar.status === "priced" && solar.amount != null) {
      const breakdown = buildPricingBreakdown(solar.amount, gstRate, pricingType);
      return {
        status: "priced",
        amount: breakdown.total,
        source: "solar_slab",
        gstRate,
        pricingType,
        breakdown,
        cityId,
        solar,
      };
    }

    return {
      status: "no_slab",
      amount: 0,
      source: "solar_slab",
      gstRate,
      pricingType,
      breakdown: buildPricingBreakdown(0, gstRate, pricingType),
      cityId,
      solar,
      message: solar.message,
    };
  }

  if (model === "vehicle_matrix" && opts.vehicleModelId) {
    const { resolveVehiclePricingWithCity } = await import("../dynamicPricing");
    const pricing = await resolveVehiclePricingWithCity(
      opts.serviceId,
      opts.vehicleModelId,
      cityId,
      opts.seatCategoryId,
    );
    if (pricing) {
      const breakdown = buildPricingBreakdown(pricing.amount, gstRate, pricingType);
      return {
        status: "priced",
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
    status: "base",
    amount: breakdown.total,
    source,
    durationMinutes: svc.durationMinutes ?? undefined,
    gstRate,
    pricingType,
    breakdown,
    cityId,
  };
}

/** Public rate-card matrix for landing / calculators — all values from DB. */
export async function getSolarRateCard(opts?: {
  serviceId?: number;
  cityId?: number | null;
  citySlug?: string;
}) {
  const cityId = opts?.cityId ?? (opts?.citySlug ? await resolveCityId(opts.citySlug) : await getDefaultCityId());

  const conditions = [eq(solarPricingSlabsTable.isActive, true)];
  if (opts?.serviceId) conditions.push(eq(solarPricingSlabsTable.serviceId, opts.serviceId));

  const slabs = await db.select()
    .from(solarPricingSlabsTable)
    .where(and(...conditions))
    .orderBy(asc(solarPricingSlabsTable.term), asc(solarPricingSlabsTable.minPanels), asc(solarPricingSlabsTable.sortOrder));

  const filtered = slabs.filter(s => cityId == null || s.cityId == null || s.cityId === cityId);

  return {
    cityId,
    slabs: filtered.map(s => ({
      id: s.id,
      serviceId: s.serviceId,
      packageId: s.packageId,
      term: s.term,
      minPanels: s.minPanels,
      maxPanels: s.maxPanels,
      pricePerPanel: s.pricePerPanel,
      minimumBilling: s.minimumBilling,
      requiresSiteVisit: s.requiresSiteVisit,
      cityId: s.cityId,
      sortOrder: s.sortOrder,
    })),
  };
}
