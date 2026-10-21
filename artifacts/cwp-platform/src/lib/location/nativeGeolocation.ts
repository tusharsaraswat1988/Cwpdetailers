import { registerPlugin, Capacitor } from "@capacitor/core";
import type { StaffGpsCoords, LocationPermissionState } from "./types";
import { GPS_WATCH_OPTIONS } from "./constants";

export interface NativeLocationBridgePlugin {
  isLocationEnabled(): Promise<{
    enabled: boolean;
    gpsEnabled?: boolean;
    networkEnabled?: boolean;
  }>;
  checkLocationPermission(): Promise<{
    permission: LocationPermissionState;
    fine: boolean;
    coarse: boolean;
    permanentlyDenied?: boolean;
    shouldShowRationale?: boolean;
  }>;
  requestLocationPermission(): Promise<{
    permission: LocationPermissionState;
    fine: boolean;
    coarse: boolean;
    permanentlyDenied?: boolean;
  }>;
  enableLocation(): Promise<{
    enabled: boolean;
    status: "already_enabled" | "resolved" | "declined" | "unresolvable" | "cannot_resolve";
    error?: string;
  }>;
  openLocationSettings(): Promise<{ success: boolean }>;
  openAppSettings(): Promise<{ success: boolean }>;
}

export const NativeLocationBridge = registerPlugin<NativeLocationBridgePlugin>("NativeLocationBridge");

export function isNativeLocationBridgeAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("NativeLocationBridge");
  } catch {
    return false;
  }
}

function mapNativePermission(state: string | undefined): LocationPermissionState {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt") return "prompt";
  return "prompt";
}

export async function isNativeLocationServicesEnabled(): Promise<boolean> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      const res = await NativeLocationBridge.isLocationEnabled();
      return Boolean(res.enabled);
    } catch {
      // Fallback
    }
  }

  // Fallback via Capacitor Geolocation
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    await Geolocation.checkPermissions();
    return true;
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("location services are not enabled") || err?.code === "OS-PLUG-GLOC-0007") {
      return false;
    }
    return true;
  }
}

export async function checkNativeLocationPermission(): Promise<{
  permission: LocationPermissionState;
  permanentlyDenied: boolean;
  locationServicesEnabled?: boolean;
}> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      const permRes = await NativeLocationBridge.checkLocationPermission();
      return {
        permission: permRes.permission,
        permanentlyDenied: permRes.permission === "prompt" ? false : Boolean(permRes.permanentlyDenied),
      };
    } catch {
      // Fallback
    }
  }

  // Fallback via @capacitor/geolocation with graceful error handling
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.checkPermissions();
    return {
      permission: mapNativePermission(status.location),
      permanentlyDenied: false,
    };
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("location services are not enabled") || err?.code === "OS-PLUG-GLOC-0007") {
      // Location services disabled, but permission state could not be read directly
      return {
        permission: "prompt",
        permanentlyDenied: false,
        locationServicesEnabled: false,
      };
    }
    return {
      permission: "prompt",
      permanentlyDenied: false,
    };
  }
}

export async function requestNativeLocationPermission(): Promise<{
  permission: LocationPermissionState;
  permanentlyDenied: boolean;
}> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      const res = await NativeLocationBridge.requestLocationPermission();
      return {
        permission: res.permission,
        permanentlyDenied: Boolean(res.permanentlyDenied),
      };
    } catch {
      // Fallback
    }
  }

  // Fallback via @capacitor/geolocation
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const status = await Geolocation.requestPermissions();
    return {
      permission: mapNativePermission(status.location),
      permanentlyDenied: false,
    };
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("location services are not enabled") || err?.code === "OS-PLUG-GLOC-0007") {
      return {
        permission: "prompt",
        permanentlyDenied: false,
      };
    }
    return {
      permission: "denied",
      permanentlyDenied: false,
    };
  }
}

export async function resolveNativeDeviceLocation(): Promise<{
  enabled: boolean;
  status: "already_enabled" | "resolved" | "declined" | "unresolvable" | "cannot_resolve" | "unsupported";
}> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      return await NativeLocationBridge.enableLocation();
    } catch {
      return { enabled: false, status: "unsupported" };
    }
  }
  return { enabled: false, status: "unsupported" };
}

export async function openNativeLocationSettings(): Promise<boolean> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      const res = await NativeLocationBridge.openLocationSettings();
      return Boolean(res.success);
    } catch {
      return false;
    }
  }
  return false;
}

export async function openNativeAppSettings(): Promise<boolean> {
  if (isNativeLocationBridgeAvailable()) {
    try {
      const res = await NativeLocationBridge.openAppSettings();
      return Boolean(res.success);
    } catch {
      return false;
    }
  }
  return false;
}

export async function readNativePosition(options: {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}): Promise<StaffGpsCoords> {
  // 1. Verify runtime permission
  const permCheck = await checkNativeLocationPermission();
  if (permCheck.permission !== "granted") {
    const requested = await requestNativeLocationPermission();
    if (requested.permission !== "granted") {
      const isBlocked = requested.permission === "denied" && Boolean(requested.permanentlyDenied);
      const err = new Error(
        isBlocked
          ? "Location permission blocked. Open settings to allow location."
          : "Location permission denied. Enable location for this app in your phone settings."
      );
      (err as any).permanentlyDenied = isBlocked;
      throw err;
    }
  }

  // 2. Verify device location services (GPS)
  const locEnabled = await isNativeLocationServicesEnabled();
  if (!locEnabled) {
    // Attempt resolution dialog
    const res = await resolveNativeDeviceLocation();
    if (!res.enabled) {
      const err = new Error(
        res.status === "declined"
          ? "Location services request declined. Please turn on GPS."
          : "Device location is turned off. Please enable Location in Settings."
      );
      (err as any).locationDisabled = true;
      (err as any).resolutionDeclined = res.status === "declined";
      throw err;
    }
  }

  // 3. Acquire fresh position
  const { Geolocation } = await import("@capacitor/geolocation");
  try {
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
  } catch (err: any) {
    const msg = String(err?.message || "").toLowerCase();
    if (msg.includes("timeout") || err?.code === "OS-PLUG-GLOC-0010") {
      throw new Error("Location timed out. Check GPS is on and try again.");
    }
    if (msg.includes("location services are not enabled") || err?.code === "OS-PLUG-GLOC-0007") {
      const error = new Error("Device location is turned off. Please enable Location in Settings.");
      (error as any).locationDisabled = true;
      throw error;
    }
    if (msg.includes("permission") || err?.code === "OS-PLUG-GLOC-0003") {
      throw new Error("Location permission denied. Enable location for this app in your phone settings.");
    }
    throw new Error(err?.message || "Could not get your location. Please try again.");
  }
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
