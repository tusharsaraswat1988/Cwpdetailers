import type {
  CoverageStatusLabel,
  ParsedAddressComponents,
  CitySummary,
} from "../coverage/CoverageTypes";

/** How geographic resolution was achieved (feeds confidence scoring). */
export type LocationResolvedBy =
  | "pin_master"
  | "google_city"
  | "city_slug"
  | "city_id"
  | "city_name"
  | "unknown";

export type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

export type LocationServiceArea = {
  id: number;
  name: string;
};

export type LocationState = {
  name: string;
  code?: string;
};

/**
 * Standard location object for all Location Intelligence consumers.
 * Future modules (Address, Pricing, ETA, Workforce) should accept/return this.
 */
export type LocationContext = {
  address: {
    formatted?: string | null;
    placeId?: string | null;
    parsed: ParsedAddressComponents;
  };
  coordinates: LocationCoordinates | null;
  postalCode?: string | null;
  serviceArea?: LocationServiceArea | null;
  city?: CitySummary | null;
  state?: LocationState | null;
  country?: string | null;
  branch?: { id: number; name?: string } | null;
  franchise?: { id: number; name?: string } | null;
  zone?: { id: number; name: string; code: string } | null;
  locality?: { id: number; name: string; slug: string } | null;
  society?: { id: number; name: string; code?: string } | null;
  propertyType?: string | null;
  resolutionStatus?: "EXACT_MATCH" | "CANDIDATE_MATCH" | "AMBIGUOUS" | "UNRESOLVED" | null;
  pricingTier?: { ruleId: number; basePrice: number; total: number; source: string } | null;
  coverageStatus: CoverageStatusLabel;
  confidenceScore: number;
  resolvedBy: LocationResolvedBy;
  validationId: string;
  metadata: {
    cityResolutionSource?: string;
    usedCityFallback?: boolean;
    version: string;
    [key: string]: unknown;
  };
};

export type BuildLocationContextInput = {
  formattedAddress?: string | null;
  placeId?: string | null;
  parsed: ParsedAddressComponents;
  coordinates?: LocationCoordinates | null;
  postalCode?: string | null;
  serviceArea?: LocationServiceArea | null;
  city?: CitySummary | null;
  stateName?: string | null;
  stateCode?: string | null;
  country?: string | null;
  branch?: { id: number; name?: string } | null;
  franchise?: { id: number; name?: string } | null;
  zone?: { id: number; name: string; code: string } | null;
  locality?: { id: number; name: string; slug: string } | null;
  society?: { id: number; name: string; code?: string } | null;
  propertyType?: string | null;
  resolutionStatus?: "EXACT_MATCH" | "CANDIDATE_MATCH" | "AMBIGUOUS" | "UNRESOLVED" | null;
  pricingTier?: { ruleId: number; basePrice: number; total: number; source: string } | null;
  coverageStatus: CoverageStatusLabel;
  confidenceScore: number;
  resolvedBy: LocationResolvedBy;
  validationId: string;
  metadata?: Record<string, unknown>;
};

export function mapResolutionSource(
  source?: "pin" | "google_city" | "city_slug" | "city_id" | "city_name",
): LocationResolvedBy {
  switch (source) {
    case "pin": return "pin_master";
    case "google_city": return "google_city";
    case "city_slug": return "city_slug";
    case "city_id": return "city_id";
    case "city_name": return "city_name";
    default: return "unknown";
  }
}

export function buildLocationContext(input: BuildLocationContextInput): LocationContext {
  return {
    address: {
      formatted: input.formattedAddress ?? null,
      placeId: input.placeId ?? null,
      parsed: input.parsed,
    },
    coordinates: input.coordinates ?? null,
    postalCode: input.postalCode ?? input.parsed.postalCode ?? null,
    serviceArea: input.serviceArea ?? null,
    city: input.city ?? null,
    state: input.stateName
      ? { name: input.stateName, code: input.stateCode }
      : input.parsed.state
        ? { name: input.parsed.state }
        : null,
    country: input.country ?? input.parsed.country ?? null,
    branch: input.branch ?? null,
    franchise: input.franchise ?? null,
    zone: input.zone ?? null,
    locality: input.locality ?? null,
    society: input.society ?? null,
    propertyType: input.propertyType ?? null,
    resolutionStatus: input.resolutionStatus ?? null,
    pricingTier: input.pricingTier ?? null,
    coverageStatus: input.coverageStatus,
    confidenceScore: input.confidenceScore,
    resolvedBy: input.resolvedBy,
    validationId: input.validationId,
    metadata: {
      version: "LocationIntelligenceV1",
      ...input.metadata,
    },
  };
}
