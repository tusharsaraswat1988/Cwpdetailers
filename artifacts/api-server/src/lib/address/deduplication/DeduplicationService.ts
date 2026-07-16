import { createHash } from "node:crypto";
import type { DuplicateCandidate } from "../types";
import { DEFAULT_DEDUP_DISTANCE_METERS } from "../types";
import { buildNormalizedAddressKey } from "../normalization/AddressNormalizer";

export function roundCoordinate(value: number, precision = 5): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function buildAddressFingerprint(input: {
  placeId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  normalizedAddress?: string | null;
}): string {
  if (input.placeId?.trim()) {
    return createHash("sha256").update(`place:${input.placeId.trim()}`).digest("hex");
  }

  const lat = input.latitude != null ? roundCoordinate(input.latitude) : null;
  const lng = input.longitude != null ? roundCoordinate(input.longitude) : null;
  const normalized = input.normalizedAddress?.toLowerCase().trim() ?? "";

  const key = [normalized, lat, lng].filter(v => v != null && v !== "").join("|");
  return createHash("sha256").update(key || "empty").digest("hex");
}

/** Haversine distance in meters. */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function findDuplicateCandidates(
  input: {
    customerId: number;
    placeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    normalizedFields: Parameters<typeof buildNormalizedAddressKey>[0];
  },
  existing: Array<{
    identityId: number;
    addressId: number;
    placeId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    normalizedAddress?: string | null;
    fingerprint: string;
  }>,
  thresholdMeters = DEFAULT_DEDUP_DISTANCE_METERS,
): DuplicateCandidate[] {
  const candidates: DuplicateCandidate[] = [];
  const normalizedKey = buildNormalizedAddressKey(input.normalizedFields);
  const fingerprint = buildAddressFingerprint({
    placeId: input.placeId,
    latitude: input.latitude,
    longitude: input.longitude,
    normalizedAddress: normalizedKey,
  });

  for (const row of existing) {
    if (input.placeId && row.placeId && input.placeId === row.placeId) {
      candidates.push({
        identityId: row.identityId,
        addressId: row.addressId,
        reason: "place_id",
      });
      continue;
    }

    if (row.fingerprint === fingerprint) {
      candidates.push({
        identityId: row.identityId,
        addressId: row.addressId,
        reason: "fingerprint",
      });
      continue;
    }

    if (
      input.latitude != null
      && input.longitude != null
      && row.latitude != null
      && row.longitude != null
      && row.normalizedAddress
      && normalizedKey
      && row.normalizedAddress.toLowerCase() === normalizedKey.toLowerCase()
    ) {
      const dist = distanceMeters(input.latitude, input.longitude, row.latitude, row.longitude);
      if (dist <= thresholdMeters) {
        candidates.push({
          identityId: row.identityId,
          addressId: row.addressId,
          reason: "proximity",
          distanceMeters: Math.round(dist),
        });
      }
    }
  }

  const seen = new Set<number>();
  return candidates.filter(c => {
    if (seen.has(c.identityId)) return false;
    seen.add(c.identityId);
    return true;
  });
}
