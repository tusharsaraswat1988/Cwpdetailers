import { COVERAGE_MESSAGES } from "../CoverageTypes";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export const addressValidator: CoverageValidator = {
  name: "AddressValidator",

  async validate(state) {
    const { request } = state;

    if (!request.address?.trim() && !hasValidCoordinates(request.locationLat, request.locationLng)) {
      return halt("INVALID_ADDRESS", COVERAGE_MESSAGES.INVALID_ADDRESS);
    }

    if (!hasValidCoordinates(request.locationLat, request.locationLng)) {
      return halt(
        "INVALID_ADDRESS",
        "Service location coordinates (latitude and longitude) are required.",
      );
    }

    return cont(state);
  },
};
