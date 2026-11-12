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

export function isWithinRadius(
  staffLat: number,
  staffLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number,
  options?: { isBasement?: boolean; accuracy?: number | null },
): boolean {
  if (!targetLat || !targetLng || (targetLat === 0 && targetLng === 0)) {
    return true;
  }
  // GEO-006: In deep basement parking (B2/B3), GPS lock may fail or return (0, 0)
  if (options?.isBasement && staffLat === 0 && staffLng === 0) {
    return true;
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
