import type { GpsRequestMode, StaffGpsCoords } from "./types";
import {
  GPS_ACTION_OPTIONS,
  GPS_NAVIGATION_OPTIONS,
  GPS_NAV_CACHE_MS,
} from "./constants";
import { locationStoreSnapshot, modeUsesCache } from "./locationStore";

function mapGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return "Location permission denied. Enable location for this app in your phone settings.";
    case err.POSITION_UNAVAILABLE:
      return "GPS signal unavailable. Step outside and try again.";
    case err.TIMEOUT:
      return "Location timed out. Check GPS is on and try again.";
    default:
      return "Could not get your location. Please try again.";
  }
}

export function isGeolocationSupported(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function optionsForMode(mode: GpsRequestMode): PositionOptions {
  return mode === "action" ? GPS_ACTION_OPTIONS : GPS_NAVIGATION_OPTIONS;
}

function readPosition(options: PositionOptions): Promise<StaffGpsCoords> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error("GPS is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      err => reject(new Error(mapGeoError(err))),
      options,
    );
  });
}

/**
 * Unified staff GPS read.
 * - action: always fresh high-accuracy (attendance, jobs, photos, walk-in)
 * - navigation / background: may return cache ≤30s, else low-accuracy read
 */
export async function getStaffLocation(mode: GpsRequestMode = "action"): Promise<StaffGpsCoords> {
  const store = locationStoreSnapshot();

  if (modeUsesCache(mode)) {
    const cached = store.getCachedLocation(GPS_NAV_CACHE_MS);
    if (cached) return cached;
  }

  const coords = await readPosition(optionsForMode(mode));
  store.setLocation(coords);
  return coords;
}

/** Apply a watchPosition / manual update to the shared cache. */
export function applyStaffLocationUpdate(coords: StaffGpsCoords): void {
  locationStoreSnapshot().setLocation(coords);
}

export function toLocationPayload(coords: StaffGpsCoords) {
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
  };
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export async function parseApiLocationError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string; code?: string; distanceMeters?: number };
    return body.error ?? "Location validation failed";
  } catch {
    return "Location validation failed";
  }
}
