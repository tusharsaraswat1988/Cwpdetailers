import type { Booking } from "@workspace/db";
import {
  assertGpsAccuracy,
  BOOKING_GEOFENCE_RADIUS_METERS,
  LocationValidationError,
  locationActionForTransition,
  parseStaffLocation,
  recordStaffLocation,
  validateBookingGeofence,
} from "./locationService";

export { LocationValidationError } from "./locationService";

export async function captureBookingTransitionLocation(
  booking: Booking,
  staffId: number,
  toStatus: string,
  body: Record<string, unknown>,
  opts: { requireLocation: boolean },
) {
  const action = locationActionForTransition(toStatus);
  if (!action) return null;

  const location = parseStaffLocation(body, { required: opts.requireLocation });
  if (!location) return null;

  const needsGeofence =
    (toStatus === "in_progress" || toStatus === "completed")
    && booking.locationLat != null
    && booking.locationLng != null;

  assertGpsAccuracy(location.accuracy, needsGeofence);

  let geoResult: ReturnType<typeof validateBookingGeofence> | null = null;
  if (needsGeofence) {
    geoResult = validateBookingGeofence(
      location.latitude,
      location.longitude,
      booking.locationLat!,
      booking.locationLng!,
      BOOKING_GEOFENCE_RADIUS_METERS,
    );
  }

  return recordStaffLocation({
    staffId,
    action,
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    bookingId: booking.id,
    subscriptionId: booking.subscriptionId,
    geoFenceVerified: needsGeofence ? geoResult!.geoFenceVerified : null,
    geoFenceRadiusMeters: needsGeofence ? geoResult!.geoFenceRadiusMeters : null,
    distanceMeters: needsGeofence ? geoResult!.distanceMeters : null,
    targetLatitude: needsGeofence ? booking.locationLat : null,
    targetLongitude: needsGeofence ? booking.locationLng : null,
    metadata: { toStatus },
  });
}
