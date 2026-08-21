import { coverageRepository } from "../repositories/CoverageRepository";
import { isCoordinateNearPin } from "@workspace/address-model";
import type { CoverageValidator } from "./types";
import { cont, halt } from "./types";

function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export const pinValidator: CoverageValidator = {
  name: "PinValidator",

  async validate(state) {
    const pincode = state.parsedAddress.postalCode ?? state.pincode ?? null;
    if (!pincode) {
      return cont({ ...state, pincode: null, pinRecord: null });
    }

    const pinRecord = await coverageRepository.pins.findByPincode(pincode);
    if (!pinRecord) {
      return halt("SERVICE_AREA_NOT_SUPPORTED");
    }

    const { locationLat, locationLng } = state.request;
    if (
      hasValidCoordinates(locationLat, locationLng)
      && !isCoordinateNearPin(locationLat!, locationLng!, pinRecord.latitude, pinRecord.longitude)
    ) {
      return halt(
        "SERVICE_AREA_NOT_SUPPORTED",
        "This location is outside our service area.",
      );
    }

    return cont({
      ...state,
      pincode,
      pinRecord,
      cityResolutionSource: "pin",
      usedCityFallback: false,
    });
  },
};
