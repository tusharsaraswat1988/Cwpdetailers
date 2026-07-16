/** @module coverage — shared types for the Coverage Engine */

import type { LocationContext } from "../location-intelligence/LocationContext";

/** Extended coverage statuses (Phase 1.2). Legacy booking statuses remain supported. */
export type CoverageStatusCode =
  | "SUCCESS"
  | "INVALID_ADDRESS"
  | "PIN_NOT_FOUND"
  | "SERVICE_AREA_NOT_SUPPORTED"
  | "CITY_NOT_FOUND"
  | "CITY_DISABLED"
  | "CITY_NOT_AVAILABLE"
  | "SERVICE_AVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "SERVICE_NOT_AVAILABLE"
  | "SERVICE_COMING_SOON"
  | "TEMPORARILY_UNAVAILABLE"
  | "WAITLIST"
  | "PRE_LAUNCH"
  | "INVITE_ONLY";

/** Legacy alias — booking routes continue to emit these values. */
export type ServiceabilityStatus =
  | "SUCCESS"
  | "PIN_NOT_FOUND"
  | "CITY_NOT_FOUND"
  | "CITY_NOT_AVAILABLE"
  | "SERVICE_NOT_AVAILABLE"
  | "SERVICE_AREA_NOT_SUPPORTED"
  | "INVALID_ADDRESS";

/** Public-facing coverage state for `/coverage/check` responses. */
export type CoverageStatusLabel =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "COMING_SOON"
  | "TEMPORARILY_UNAVAILABLE"
  | "WAITLIST"
  | "PRE_LAUNCH"
  | "INVITE_ONLY"
  | "INVALID";

export type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type ParsedAddressComponents = {
  postalCode?: string | null;
  locality?: string | null;
  subLocality?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

/** Input to the Coverage Engine — backward compatible with Phase 1 ServiceabilityRequest. */
export type CoverageRequest = {
  customerId?: number;
  address?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  placeId?: string | null;
  serviceId?: number | null;
  cityId?: number | null;
  citySlug?: string | null;
  cityName?: string | null;
  addressComponents?: GoogleAddressComponent[];
  postalCode?: string | null;
  pincode?: string | null;
};

/** @deprecated alias */
export type ServiceabilityRequest = CoverageRequest;

export type CitySummary = {
  id: number;
  name: string;
  slug: string;
  stateName?: string;
};

export type ServiceSummary = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
};

export type CoverageCorrelation = {
  coverageValidationId: string;
  requestId: string;
  bookingId?: number;
  /** Additive — flows through logs and domain events. */
  traceId?: string;
};

export type CoverageResult = {
  success: boolean;
  status: CoverageStatusCode;
  /** Legacy status for booking HTTP responses. */
  legacyStatus: ServiceabilityStatus;
  message: string;
  coverageStatus: CoverageStatusLabel;
  correlation: CoverageCorrelation;
  pincode?: string;
  city?: CitySummary;
  cityId?: number;
  cityName?: string;
  stateName?: string;
  serviceAreaId?: number;
  serviceArea?: string;
  serviceAreaName?: string;
  serviceId?: number;
  parsedAddress?: ParsedAddressComponents;
  cityResolutionSource?: "pin" | "google_city" | "city_slug" | "city_id" | "city_name";
  usedCityFallback?: boolean;
  availableServices?: ServiceSummary[];
  comingSoonServices?: ServiceSummary[];
  unavailableServices?: ServiceSummary[];
  resolvedCityId?: number;
  /** Additive — standard location object for future modules. */
  locationContext?: LocationContext;
  confidenceScore?: number;
  version?: string;
};

/** @deprecated alias */
export type ServiceabilityResult = CoverageResult;

export type CoverageCheckOptions = {
  requestSource?: string;
  requestId?: string;
  traceId?: string;
  bookingId?: number;
  includeServiceCatalog?: boolean;
};

export const COVERAGE_MESSAGES: Record<Exclude<CoverageStatusCode, "SUCCESS" | "SERVICE_AVAILABLE">, string> = {
  INVALID_ADDRESS: "A valid service address with location coordinates is required.",
  PIN_NOT_FOUND: "We could not determine a valid PIN code from the service address.",
  SERVICE_AREA_NOT_SUPPORTED: "We do not serve this PIN code yet.",
  CITY_NOT_FOUND: "The city for this address could not be identified.",
  CITY_DISABLED: "This service is currently unavailable in your city.",
  CITY_NOT_AVAILABLE: "This service is currently unavailable in your city.",
  SERVICE_UNAVAILABLE: "This service is currently unavailable in your city.",
  SERVICE_NOT_AVAILABLE: "This service is currently unavailable in your city.",
  SERVICE_COMING_SOON: "This service is coming soon in your area.",
  TEMPORARILY_UNAVAILABLE: "Service is temporarily unavailable in your area.",
  WAITLIST: "This area is on our waitlist.",
  PRE_LAUNCH: "This area is in pre-launch.",
  INVITE_ONLY: "This area is invite-only.",
};

/** @deprecated alias */
export const SERVICEABILITY_MESSAGES = COVERAGE_MESSAGES;

export function toLegacyStatus(status: CoverageStatusCode): ServiceabilityStatus {
  switch (status) {
    case "SUCCESS":
    case "SERVICE_AVAILABLE":
      return "SUCCESS";
    case "CITY_DISABLED":
      return "CITY_NOT_AVAILABLE";
    case "SERVICE_UNAVAILABLE":
      return "SERVICE_NOT_AVAILABLE";
    case "SERVICE_COMING_SOON":
    case "TEMPORARILY_UNAVAILABLE":
    case "WAITLIST":
    case "PRE_LAUNCH":
    case "INVITE_ONLY":
      return "SERVICE_NOT_AVAILABLE";
    default:
      return status as ServiceabilityStatus;
  }
}

export function toCoverageStatusLabel(
  status: CoverageStatusCode,
  success: boolean,
): CoverageStatusLabel {
  if (success) return "AVAILABLE";
  switch (status) {
    case "INVALID_ADDRESS":
    case "PIN_NOT_FOUND":
    case "CITY_NOT_FOUND":
      return "INVALID";
    case "SERVICE_COMING_SOON":
      return "COMING_SOON";
    case "TEMPORARILY_UNAVAILABLE":
      return "TEMPORARILY_UNAVAILABLE";
    case "WAITLIST":
      return "WAITLIST";
    case "PRE_LAUNCH":
      return "PRE_LAUNCH";
    case "INVITE_ONLY":
      return "INVITE_ONLY";
    default:
      return "UNAVAILABLE";
  }
}
