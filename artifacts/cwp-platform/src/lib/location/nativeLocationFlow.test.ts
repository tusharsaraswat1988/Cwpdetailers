import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const { mockBridge, mockGeolocation } = vi.hoisted(() => ({
  mockBridge: {
    isLocationEnabled: vi.fn(),
    checkLocationPermission: vi.fn(),
    requestLocationPermission: vi.fn(),
    enableLocation: vi.fn(),
    openLocationSettings: vi.fn(),
    openAppSettings: vi.fn(),
  },
  mockGeolocation: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    getCurrentPosition: vi.fn(),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  },
}));

vi.mock("@capacitor/core", async () => {
  const actual = await vi.importActual<typeof import("@capacitor/core")>("@capacitor/core");
  return {
    ...actual,
    registerPlugin: (name: string) => {
      if (name === "NativeLocationBridge") {
        return mockBridge;
      }
      return actual.registerPlugin(name);
    },
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => true,
      isPluginAvailable: (name: string) => name === "NativeLocationBridge",
    },
  };
});

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: mockGeolocation,
}));

import {
  checkNativeLocationPermission,
  requestNativeLocationPermission,
  isNativeLocationServicesEnabled,
  resolveNativeDeviceLocation,
  readNativePosition,
  openNativeLocationSettings,
  openNativeAppSettings,
} from "./nativeGeolocation";
import { useLocationStore } from "./locationStore";

describe("Native Location Flow", () => {
  beforeEach(() => {
    useLocationStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles Scenario A: Permission granted and retrieves fresh fix", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockResolvedValue({
      enabled: true,
      gpsEnabled: true,
    });
    mockGeolocation.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 28.6139, longitude: 77.209, accuracy: 15 },
    });

    const permStatus = await checkNativeLocationPermission();
    expect(permStatus.permission).toBe("granted");

    const locEnabled = await isNativeLocationServicesEnabled();
    expect(locEnabled).toBe(true);

    const coords = await readNativePosition({ enableHighAccuracy: true });
    expect(coords.latitude).toBe(28.6139);
    expect(coords.longitude).toBe(77.209);
    expect(coords.accuracy).toBe(15);
  });

  it("handles Scenario A: Permission denied (standard and permanently denied)", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "prompt",
      fine: false,
      coarse: false,
      permanentlyDenied: false,
    });
    mockBridge.requestLocationPermission.mockResolvedValue({
      permission: "denied",
      fine: false,
      coarse: false,
      permanentlyDenied: true,
    });

    const permStatus = await checkNativeLocationPermission();
    expect(permStatus.permission).toBe("prompt");

    const reqStatus = await requestNativeLocationPermission();
    expect(reqStatus.permission).toBe("denied");
    expect(reqStatus.permanentlyDenied).toBe(true);

    await expect(readNativePosition({})).rejects.toThrow(/Location permission blocked/);
  });

  it("handles Scenario B: Location services disabled detection", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockResolvedValue({
      enabled: false,
      gpsEnabled: false,
    });

    const isEnabled = await isNativeLocationServicesEnabled();
    expect(isEnabled).toBe(false);
  });

  it("handles Scenario B: Successful system resolution dialogue and location retrieval", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });

    let enabledState = false;
    mockBridge.isLocationEnabled.mockImplementation(async () => ({
      enabled: enabledState,
      gpsEnabled: enabledState,
    }));
    mockBridge.enableLocation.mockImplementation(async () => {
      enabledState = true;
      return { enabled: true, status: "resolved" };
    });

    mockGeolocation.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 25.3176, longitude: 82.9739, accuracy: 12 },
    });

    const res = await resolveNativeDeviceLocation();
    expect(res.enabled).toBe(true);
    expect(res.status).toBe("resolved");

    const coords = await readNativePosition({});
    expect(coords.latitude).toBe(25.3176);
    expect(coords.accuracy).toBe(12);
  });

  it("handles Scenario B: User cancelling / declining system dialogue", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockResolvedValue({
      enabled: false,
      gpsEnabled: false,
    });
    mockBridge.enableLocation.mockResolvedValue({
      enabled: false,
      status: "declined",
    });

    const res = await resolveNativeDeviceLocation();
    expect(res.enabled).toBe(false);
    expect(res.status).toBe("declined");

    await expect(readNativePosition({})).rejects.toThrow(/request declined/i);
  });

  it("handles Opening Settings fallbacks (Location Settings and App Settings)", async () => {
    mockBridge.openLocationSettings.mockResolvedValue({ success: true });
    mockBridge.openAppSettings.mockResolvedValue({ success: true });

    const locSuccess = await openNativeLocationSettings();
    expect(locSuccess).toBe(true);
    expect(mockBridge.openLocationSettings).toHaveBeenCalledTimes(1);

    const appSuccess = await openNativeAppSettings();
    expect(appSuccess).toBe(true);
    expect(mockBridge.openAppSettings).toHaveBeenCalledTimes(1);
  });

  it("handles Scenario C: Location timeout error mapping", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockResolvedValue({
      enabled: true,
      gpsEnabled: true,
    });
    mockGeolocation.getCurrentPosition.mockRejectedValue({
      code: "OS-PLUG-GLOC-0010",
      message: "Could not obtain location in time. Try with a higher timeout.",
    });

    await expect(readNativePosition({})).rejects.toThrow(/Location timed out/);
  });

  it("handles Scenario C: Location unavailable error mapping", async () => {
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockResolvedValue({
      enabled: true,
      gpsEnabled: true,
    });
    mockGeolocation.getCurrentPosition.mockRejectedValue({
      code: "OS-PLUG-GLOC-0002",
      message: "There was an error trying to obtain the location.",
    });

    await expect(readNativePosition({})).rejects.toThrow(/trying to obtain the location/);
  });

  it("handles Lifecycle recovery: automatically detects GPS enabled after returning from Settings", async () => {
    let locationServicesOn = false;
    mockBridge.checkLocationPermission.mockResolvedValue({
      permission: "granted",
      fine: true,
      coarse: true,
      permanentlyDenied: false,
    });
    mockBridge.isLocationEnabled.mockImplementation(async () => ({
      enabled: locationServicesOn,
      gpsEnabled: locationServicesOn,
    }));

    // Step 1: Before visiting settings, GPS is OFF
    expect(await isNativeLocationServicesEnabled()).toBe(false);

    // Step 2: User toggles GPS in Settings, app resumes
    locationServicesOn = true;

    // Step 3: Re-checking on resume detects GPS is now enabled
    const resumedStatus = await isNativeLocationServicesEnabled();
    expect(resumedStatus).toBe(true);

    const permStatus = await checkNativeLocationPermission();
    expect(permStatus.permission).toBe("granted");
  });
});
