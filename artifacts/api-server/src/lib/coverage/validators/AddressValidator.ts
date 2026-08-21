import { COVERAGE_MESSAGES } from "../CoverageTypes";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function hasManualPlace(request: {
  address?: string | null;
  postalCode?: string | null;
  pincode?: string | null;
  cityName?: string | null;
  cityId?: number | null;
}): boolean {
  return Boolean(
    request.address?.trim()
    && (request.postalCode?.trim() || request.pincode?.trim() || request.cityName?.trim() || request.cityId != null),
  );
}

export const addressValidator: CoverageValidator = {
  name: "AddressValidator",

  async validate(state) {
    const { request } = state;
    const coords = hasValidCoordinates(request.locationLat, request.locationLng);

    if (coords) return cont(state);

    if (hasManualPlace(request)) return cont(state);

    return halt("INVALID_ADDRESS", COVERAGE_MESSAGES.INVALID_ADDRESS);
  },
};
