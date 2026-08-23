import type { StaffGpsCoords } from "./types";
import type { LocationPermissionState } from "./types";
import { GPS_WATCH_OPTIONS } from "./constants";

function mapNativePermission(state: string | undefined): LocationPermissionState {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt") return "prompt";
  return "prompt";
}

export async function checkNativeLocationPermission(): Promise<LocationPermissionState> {
  const { Geolocation } = await import("@capacitor/geolocation");
  const status = await Geolocation.checkPermissions();
  return mapNativePermission(status.location);
}

export async function requestNativeLocationPermission(): Promise<LocationPermissionState> {
  const { Geolocation } = await import("@capacitor/geolocation");
  const status = await Geolocation.requestPermissions();
  return mapNativePermission(status.location);
}

export async function readNativePosition(options: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<StaffGpsCoords> {
  const { Geolocation } = await import("@capacitor/geolocation");
  const permission = await checkNativeLocationPermission();
  if (permission !== "granted") {
    const requested = await requestNativeLocationPermission();
    if (requested !== "granted") {
      throw new Error("Location permission denied. Enable location for this app in your phone settings.");
    }
  }

  const pos = await Geolocation.getCurrentPosition({
    enableHighAccuracy: options.enableHighAccuracy ?? true,
    timeout: options.timeout ?? 20_000,
    maximumAge: options.maximumAge ?? 0,
  });

  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy ?? 999,
  };
}

export async function watchNativePosition(
  onUpdate: (coords: StaffGpsCoords) => void,
): Promise<string> {
  const { Geolocation } = await import("@capacitor/geolocation");
  return Geolocation.watchPosition(
    {
      enableHighAccuracy: GPS_WATCH_OPTIONS.enableHighAccuracy,
      timeout: GPS_WATCH_OPTIONS.timeout,
      maximumAge: GPS_WATCH_OPTIONS.maximumAge,
    },
    (pos, err) => {
      if (err || !pos) return;
      onUpdate({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? 999,
      });
    },
  );
}

export async function clearNativeWatch(id: string): Promise<void> {
  const { Geolocation } = await import("@capacitor/geolocation");
  await Geolocation.clearWatch({ id });
}
