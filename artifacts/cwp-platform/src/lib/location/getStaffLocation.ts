import type { GpsRequestMode, StaffGpsCoords } from "./types";
import {
  GPS_ACTION_OPTIONS,
  GPS_NAVIGATION_OPTIONS,
  GPS_NAV_CACHE_MS,
} from "./constants";
import { locationStoreSnapshot, modeUsesCache } from "./locationStore";
import { runExclusiveGeolocationRead } from "./geolocationCoordinator";
import { waitForAccurateGps } from "./accuracyWait";
import { isStaffNativeApp } from "@/lib/native/staffNative";

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
  if (isStaffNativeApp()) return true;
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function optionsForMode(mode: GpsRequestMode): PositionOptions {
  return mode === "action" ? GPS_ACTION_OPTIONS : GPS_NAVIGATION_OPTIONS;
}

function readBrowserPosition(options: PositionOptions): Promise<StaffGpsCoords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
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

async function readPosition(options: PositionOptions): Promise<StaffGpsCoords> {
  if (isStaffNativeApp()) {
    const { readNativePosition } = await import("./nativeGeolocation");
    return readNativePosition({
      enableHighAccuracy: options.enableHighAccuracy,
      timeout: options.timeout,
      maximumAge: options.maximumAge,
    });
  }
  return readBrowserPosition(options);
}

/**
 * Unified staff GPS read.
 * - action: always fresh high-accuracy, waits until ±50m (or best ≤200m)
 * - navigation / background: may return cache ≤30s, else low-accuracy read
 */
export async function getStaffLocation(mode: GpsRequestMode = "action"): Promise<StaffGpsCoords> {
  const store = locationStoreSnapshot();

  if (modeUsesCache(mode)) {
    const cached = store.getCachedLocation(GPS_NAV_CACHE_MS);
    if (cached) return cached;
  }

  const coords = await runExclusiveGeolocationRead(async () => {
    const options = optionsForMode(mode);
    if (mode === "action") {
      return waitForAccurateGps(() => readPosition(options));
    }
    return readPosition(options);
  });
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

export { mapsViewUrl as mapsLink } from "@/lib/maps";

export async function parseApiLocationError(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string; code?: string; distanceMeters?: number };
    return body.error ?? "Location validation failed";
  } catch {
    return "Location validation failed";
  }
}
