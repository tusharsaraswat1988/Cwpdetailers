import type { PipelineState } from "../../coverage/validators/types";

function hasValidCoordinates(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

/**
 * Confidence scoring for LocationContext.
 * Reflects resolution quality — driven by cityResolutionSource when present.
 */
export function calculateLocationConfidence(state: PipelineState): number {
  const hasGps = hasValidCoordinates(state.request.locationLat, state.request.locationLng);
  const hasGoogleComponents = Boolean(state.request.addressComponents?.length);
  const hasPinMaster = Boolean(state.pinRecord && state.pincode);
  const parsedPin = state.parsedAddress.postalCode ?? state.pincode;
  const source = state.cityResolutionSource;

  if (hasGps && hasGoogleComponents && (hasPinMaster || parsedPin)) return 100;
  if (hasGoogleComponents) return 95;
  if (source === "pin" || hasPinMaster) return 90;
  if (parsedPin && !source) return 90;
  if (source === "google_city" || source === "city_id" || source === "city_name") return 50;
  if (source === "city_slug") return 25;
  if (state.request.address?.trim() && hasGps) return 70;
  return 0;
}
