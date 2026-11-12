/** Haversine distance in meters between two GPS coordinates. */
export function distanceMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const DEFAULT_RADIUS_METERS = 100;
export const BASEMENT_EXTRA_TOLERANCE_METERS = 250;

export const VALID_GPS_UNAVAILABLE_REASONS = [
  "underground_basement_no_signal",
  "covered_parking_timeout",
  "hardware_gps_unavailable",
] as const;

export type GpsUnavailableReason = (typeof VALID_GPS_UNAVAILABLE_REASONS)[number];

export function validateBasementGpsFallback(options: {
  staffLat: number;
  staffLng: number;
  isBasement: boolean;
  gpsUnavailable?: boolean;
  gpsUnavailableReason?: string;
  hasPhoto: boolean;
}): { allowed: boolean; error?: string; requiresAudit: boolean } {
  const isZeroGps = options.staffLat === 0 && options.staffLng === 0;

  if (!isZeroGps && !options.gpsUnavailable) {
    return { allowed: true, requiresAudit: false };
  }

  // 1. Street and open residential locations cannot bypass GPS
  if (!options.isBasement) {
    return {
      allowed: false,
      error: "GPS coordinates are mandatory for street and open residential locations.",
      requiresAudit: false,
    };
  }

  // 2. Must supply an authorized reason
  const reason = options.gpsUnavailableReason;
  if (!reason || !VALID_GPS_UNAVAILABLE_REASONS.includes(reason as GpsUnavailableReason)) {
    return {
      allowed: false,
      error: `Underground completion without GPS fix requires a valid reason (${VALID_GPS_UNAVAILABLE_REASONS.join(", ")}).`,
      requiresAudit: false,
    };
  }

  // 3. Must provide photographic evidence
  if (!options.hasPhoto) {
    return {
      allowed: false,
      error: "Photo evidence is strictly mandatory for underground parking completions without GPS.",
      requiresAudit: false,
    };
  }

  // Allowed under audited condition
  return { allowed: true, requiresAudit: true };
}

export function isWithinRadius(
  staffLat: number,
  staffLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
  options?: {
    isBasement?: boolean;
    accuracy?: number | null;
    gpsUnavailable?: boolean;
    gpsUnavailableReason?: string;
  },
): boolean {
  if (!targetLat || !targetLng || (targetLat === 0 && targetLng === 0)) {
    return true;
  }

  const isZeroGps = staffLat === 0 && staffLng === 0;
  if (isZeroGps || options?.gpsUnavailable) {
    // Street/open locations cannot use zero GPS
    if (!options?.isBasement) {
      return false;
    }
    // Deep basement: allowed when reason is declared and valid
    if (options?.gpsUnavailableReason && VALID_GPS_UNAVAILABLE_REASONS.includes(options.gpsUnavailableReason as GpsUnavailableReason)) {
      return true;
    }
    return false;
  }

  let effectiveRadius = radiusMeters > 0 ? radiusMeters : DEFAULT_RADIUS_METERS;
  if (options?.isBasement) {
    effectiveRadius += BASEMENT_EXTRA_TOLERANCE_METERS;
  }
  if (options?.accuracy && options.accuracy > 0 && options.accuracy <= 250) {
    effectiveRadius += Math.min(options.accuracy, 100);
  }

  return distanceMeters(staffLat, staffLng, targetLat, targetLng) <= effectiveRadius;
}
