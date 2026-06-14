import type { StaffGpsCoords } from "./types";
import { GPS_OPTIONS } from "./constants";

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

/** High-accuracy one-shot GPS read for staff field actions. */
export function getStaffLocation(): Promise<StaffGpsCoords> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) {
      reject(new Error("GPS is not available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => reject(new Error(mapGeoError(err))),
      GPS_OPTIONS,
    );
  });
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
