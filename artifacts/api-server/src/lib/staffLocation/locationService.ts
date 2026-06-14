import { db, staffLocationLogsTable, staffTable, type StaffLocationLog } from "@workspace/db";
import { eq } from "drizzle-orm";
import { distanceMeters, isWithinRadius } from "../dcms/geoFence";

/** Default geofence for doorstep job start/complete (Urban Company / Swiggy-style). */
export const BOOKING_GEOFENCE_RADIUS_METERS = 150;

/** Reject GPS fixes worse than this for geofenced actions. */
export const MAX_GPS_ACCURACY_METERS = 200;

export type StaffLocationAction = "attendance" | "en_route" | "job_start" | "job_complete";

export type ParsedStaffLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export class LocationValidationError extends Error {
  constructor(
    message: string,
    public code: "LOCATION_REQUIRED" | "INVALID_COORDINATES" | "POOR_ACCURACY" | "GEOFENCE_FAILED",
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LocationValidationError";
  }
}

export function parseStaffLocation(
  body: Record<string, unknown>,
  opts?: { required?: boolean },
): ParsedStaffLocation | null {
  const required = opts?.required ?? true;
  const { latitude, longitude, accuracy } = body;

  if (latitude == null || longitude == null) {
    if (!required) return null;
    throw new LocationValidationError(
      "Location is required. Enable GPS and try again.",
      "LOCATION_REQUIRED",
    );
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new LocationValidationError("Invalid GPS coordinates", "INVALID_COORDINATES");
  }

  const acc = accuracy != null ? Number(accuracy) : undefined;
  if (acc != null && (!Number.isFinite(acc) || acc < 0)) {
    throw new LocationValidationError("Invalid GPS accuracy", "INVALID_COORDINATES");
  }

  return { latitude: lat, longitude: lng, accuracy: acc };
}

export function assertGpsAccuracy(accuracy: number | undefined, forGeofence: boolean) {
  if (!forGeofence || accuracy == null) return;
  if (accuracy > MAX_GPS_ACCURACY_METERS) {
    throw new LocationValidationError(
      `GPS signal too weak (${Math.round(accuracy)}m). Move outdoors and wait for a better fix.`,
      "POOR_ACCURACY",
      { accuracyMeters: accuracy, maxAllowed: MAX_GPS_ACCURACY_METERS },
    );
  }
}

export function validateBookingGeofence(
  staffLat: number,
  staffLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters = BOOKING_GEOFENCE_RADIUS_METERS,
) {
  const dist = distanceMeters(staffLat, staffLng, targetLat, targetLng);
  const verified = isWithinRadius(staffLat, staffLng, targetLat, targetLng, radiusMeters);
  if (!verified) {
    throw new LocationValidationError(
      `You must be within ${radiusMeters}m of the customer location (${Math.round(dist)}m away). Move closer and try again.`,
      "GEOFENCE_FAILED",
      { distanceMeters: Math.round(dist), requiredRadiusMeters: radiusMeters },
    );
  }
  return { distanceMeters: dist, geoFenceVerified: true, geoFenceRadiusMeters: radiusMeters };
}

export async function recordStaffLocation(input: {
  staffId: number;
  action: StaffLocationAction;
  latitude: number;
  longitude: number;
  accuracy?: number;
  bookingId?: number | null;
  subscriptionId?: number | null;
  geoFenceVerified?: boolean | null;
  geoFenceRadiusMeters?: number | null;
  distanceMeters?: number | null;
  targetLatitude?: number | null;
  targetLongitude?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<StaffLocationLog> {
  const [staff] = await db.select({
    companyId: staffTable.companyId,
    branchId: staffTable.branchId,
  }).from(staffTable).where(eq(staffTable.id, input.staffId)).limit(1);

  const [log] = await db.insert(staffLocationLogsTable).values({
    staffId: input.staffId,
    companyId: staff?.companyId ?? null,
    branchId: staff?.branchId ?? null,
    bookingId: input.bookingId ?? null,
    subscriptionId: input.subscriptionId ?? null,
    action: input.action,
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyMeters: input.accuracy ?? null,
    geoFenceVerified: input.geoFenceVerified ?? null,
    geoFenceRadiusMeters: input.geoFenceRadiusMeters ?? null,
    distanceMeters: input.distanceMeters ?? null,
    targetLatitude: input.targetLatitude ?? null,
    targetLongitude: input.targetLongitude ?? null,
    metadata: input.metadata ?? {},
  }).returning();

  return log!;
}

export function locationActionForTransition(toStatus: string): StaffLocationAction | null {
  if (toStatus === "en_route") return "en_route";
  if (toStatus === "in_progress") return "job_start";
  if (toStatus === "completed") return "job_complete";
  return null;
}

export function handleLocationError(err: unknown) {
  if (err instanceof LocationValidationError) {
    return { status: 400, body: { error: err.message, code: err.code, ...err.details } };
  }
  return null;
}
