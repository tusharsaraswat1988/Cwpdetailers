function normalizeKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type DuplicateLocationCandidate = {
  placeId?: string | null;
  houseNumber?: string | null;
  buildingName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
};

const NEAR_METERS = 40;

function hasPin(loc: DuplicateLocationCandidate): loc is DuplicateLocationCandidate & { latitude: number; longitude: number } {
  return loc.latitude != null && loc.longitude != null
    && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
    && (loc.latitude !== 0 || loc.longitude !== 0);
}

/**
 * High-confidence duplicate only:
 * same placeId + same house/flat, or very close coordinates + same house/flat.
 * Does not merge different flats in the same building.
 */
export function isDuplicateSavedLocation(
  incoming: DuplicateLocationCandidate,
  existing: DuplicateLocationCandidate,
): boolean {
  const sameHouse = normalizeKey(incoming.houseNumber) === normalizeKey(existing.houseNumber);

  if (incoming.placeId && existing.placeId && incoming.placeId === existing.placeId) {
    return sameHouse;
  }

  if (hasPin(incoming) && hasPin(existing) && sameHouse) {
    const meters = haversineMeters(incoming, existing);
    if (meters <= NEAR_METERS) {
      const sameBuilding = normalizeKey(incoming.buildingName) === normalizeKey(existing.buildingName);
      return sameBuilding;
    }
  }

  return false;
}

export function isCoordinateNearPin(
  lat: number,
  lng: number,
  pinLat: number | null | undefined,
  pinLng: number | null | undefined,
  maxKm = 35,
): boolean {
  if (pinLat == null || pinLng == null || !Number.isFinite(pinLat) || !Number.isFinite(pinLng)) {
    return true;
  }
  return haversineMeters({ latitude: lat, longitude: lng }, { latitude: pinLat, longitude: pinLng }) <= maxKm * 1000;
}
