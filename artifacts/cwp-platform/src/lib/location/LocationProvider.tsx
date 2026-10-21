import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Capacitor } from "@capacitor/core";
import type { LocationPermissionState } from "./types";
import { GPS_RECHECK_INTERVAL_MS, GPS_WATCH_OPTIONS } from "./constants";
import {
  applyStaffLocationUpdate,
  getStaffLocation,
  isGeolocationSupported,
} from "./getStaffLocation";
import { locationStoreSnapshot, useLocationStore } from "./locationStore";
import {
  clearStaffGeolocationWatchRegistration,
  registerStaffGeolocationWatch,
} from "./geolocationCoordinator";
import { isStaffNativeApp } from "@/lib/native/staffNative";

type StaffLocationContextValue = {
  permissionState: LocationPermissionState;
  gpsReady: boolean;
  lastKnownLocation: ReturnType<typeof useLocationStore.getState>["lastKnownLocation"];
  accuracy: number | null;
  lastUpdateTime: number | null;
  isRefreshing: boolean;
  isPermanentlyDenied: boolean;
  resolutionDeclined: boolean;
  errorMessage: string | null;
  requestPermission: () => Promise<void>;
  enableDeviceLocation: () => Promise<boolean>;
  openLocationSettings: () => Promise<boolean>;
  openAppSettings: () => Promise<boolean>;
  refreshBackgroundLocation: () => Promise<void>;
};

const StaffLocationContext = createContext<StaffLocationContextValue | null>(null);

type QueryPermissionResult = {
  state: LocationPermissionState;
  permanentlyDenied?: boolean;
  locationDisabled?: boolean;
};

async function queryPermission(): Promise<QueryPermissionResult> {
  if (!isGeolocationSupported()) return { state: "unsupported" };

  if (isStaffNativeApp() || Capacitor.isNativePlatform()) {
    try {
      const {
        checkNativeLocationPermission,
        isNativeLocationServicesEnabled,
      } = await import("./nativeGeolocation");

      const [permCheck, locEnabled] = await Promise.all([
        checkNativeLocationPermission(),
        isNativeLocationServicesEnabled(),
      ]);

      if (permCheck.permission === "granted") {
        if (!locEnabled) {
          return { state: "location_off", locationDisabled: true };
        }
        return { state: "granted" };
      }

      if (permCheck.permission === "denied") {
        return {
          state: "denied",
          permanentlyDenied: permCheck.permanentlyDenied,
        };
      }

      return {
        state: "prompt",
        permanentlyDenied: false,
      };
    } catch {
      return { state: "prompt" };
    }
  }

  // Web / PWA flow
  try {
    const perm = await navigator.permissions.query({ name: "geolocation" });
    if (perm.state === "granted") return { state: "granted" };
    if (perm.state === "denied") return { state: "denied" };
    return { state: "prompt" };
  } catch {
    return { state: "prompt" };
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const permissionState = useLocationStore(s => s.permissionState);
  const gpsReady = useLocationStore(s => s.gpsReady);
  const lastKnownLocation = useLocationStore(s => s.lastKnownLocation);
  const accuracy = useLocationStore(s => s.accuracy);
  const lastUpdateTime = useLocationStore(s => s.lastUpdateTime);
  const isRefreshing = useLocationStore(s => s.isRefreshing);
  const setPermissionState = useLocationStore(s => s.setPermissionState);
  const setRefreshing = useLocationStore(s => s.setRefreshing);

  const [isPermanentlyDenied, setIsPermanentlyDenied] = useState(false);
  const [resolutionDeclined, setResolutionDeclined] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const watchIdRef = useRef<number | string | null>(null);
  const lastBackgroundRefreshRef = useRef(0);
  const permissionStateRef = useRef(permissionState);
  permissionStateRef.current = permissionState;

  const stopWatch = useCallback(() => {
    const id = watchIdRef.current;
    if (id == null) return;
    watchIdRef.current = null;
    if (typeof id === "string") {
      void import("./nativeGeolocation").then(({ clearNativeWatch }) => clearNativeWatch(id));
      return;
    }
    if (isGeolocationSupported()) {
      navigator.geolocation.clearWatch(id);
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!isGeolocationSupported() || permissionStateRef.current !== "granted") return;
    if (watchIdRef.current != null) return;

    if (isStaffNativeApp() || Capacitor.isNativePlatform()) {
      void import("./nativeGeolocation").then(async ({ watchNativePosition }) => {
        if (watchIdRef.current != null || permissionStateRef.current !== "granted") return;
        watchIdRef.current = await watchNativePosition(applyStaffLocationUpdate);
      });
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos =>
        applyStaffLocationUpdate({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => {},
      GPS_WATCH_OPTIONS,
    );
  }, []);

  const refreshBackgroundLocation = useCallback(async () => {
    if (permissionStateRef.current !== "granted") return;

    const now = Date.now();
    if (now - lastBackgroundRefreshRef.current < GPS_RECHECK_INTERVAL_MS) return;

    const cached = locationStoreSnapshot().getCachedLocation();
    if (cached) return;

    setRefreshing(true);
    try {
      await getStaffLocation("background");
      lastBackgroundRefreshRef.current = Date.now();
    } catch {
      // Background refresh is best-effort; permission state unchanged.
    } finally {
      setRefreshing(false);
    }
  }, [setRefreshing]);

  const checkPermissionOnly = useCallback(async () => {
    if (!isGeolocationSupported()) {
      setPermissionState("unsupported");
      return;
    }
    const perm = await queryPermission();
    setPermissionState(perm.state);
    if (perm.permanentlyDenied !== undefined) {
      setIsPermanentlyDenied(perm.permanentlyDenied);
    }
    if (perm.state === "granted") {
      setResolutionDeclined(false);
      setErrorMessage(null);
      void refreshBackgroundLocation();
    }
  }, [setPermissionState, refreshBackgroundLocation]);

  const openLocationSettings = useCallback(async (): Promise<boolean> => {
    try {
      const { openNativeLocationSettings } = await import("./nativeGeolocation");
      return await openNativeLocationSettings();
    } catch {
      return false;
    }
  }, []);

  const openAppSettings = useCallback(async (): Promise<boolean> => {
    try {
      const { openNativeAppSettings } = await import("./nativeGeolocation");
      return await openNativeAppSettings();
    } catch {
      return false;
    }
  }, []);

  const enableDeviceLocation = useCallback(async (): Promise<boolean> => {
    setRefreshing(true);
    setErrorMessage(null);
    try {
      const { resolveNativeDeviceLocation } = await import("./nativeGeolocation");
      const res = await resolveNativeDeviceLocation();

      if (res.enabled) {
        setResolutionDeclined(false);
        setErrorMessage(null);
        await getStaffLocation("action");
        setPermissionState("granted");
        lastBackgroundRefreshRef.current = Date.now();
        return true;
      }

      if (res.status === "declined") {
        setResolutionDeclined(true);
        setPermissionState("location_off");
        setErrorMessage("Location enable request was declined. Please enable Location in Settings.");
      } else {
        setPermissionState("location_off");
        setErrorMessage("Could not enable Location automatically. Please open Location Settings.");
      }
      return false;
    } catch (err: any) {
      setPermissionState("location_off");
      setErrorMessage(err?.message || "Location services are required.");
      return false;
    } finally {
      setRefreshing(false);
    }
  }, [setPermissionState, setRefreshing]);

  const requestPermission = useCallback(async () => {
    if (!isGeolocationSupported()) {
      setPermissionState("unsupported");
      return;
    }

    setRefreshing(true);
    setErrorMessage(null);

    try {
      if (isStaffNativeApp() || Capacitor.isNativePlatform()) {
        const {
          checkNativeLocationPermission,
          requestNativeLocationPermission,
          isNativeLocationServicesEnabled,
          resolveNativeDeviceLocation,
        } = await import("./nativeGeolocation");

        // Step 1: Ensure runtime permission is granted
        const initialPerm = await checkNativeLocationPermission();
        let currentPermission = initialPerm.permission;
        let isPermBlocked = initialPerm.permanentlyDenied;

        if (currentPermission !== "granted") {
          const requested = await requestNativeLocationPermission();
          currentPermission = requested.permission;
          isPermBlocked = requested.permanentlyDenied;
        }

        if (currentPermission !== "granted") {
          setIsPermanentlyDenied(Boolean(isPermBlocked));
          setPermissionState("denied");
          setErrorMessage(
            isPermBlocked
              ? "Location permission blocked. Open settings to allow location."
              : "Location permission denied. Please allow location to continue."
          );
          return;
        }

        setIsPermanentlyDenied(false);

        // Step 2: Ensure device Location / GPS is turned ON
        const isLocEnabled = await isNativeLocationServicesEnabled();
        if (!isLocEnabled) {
          const res = await resolveNativeDeviceLocation();
          if (!res.enabled) {
            setPermissionState("location_off");
            setResolutionDeclined(res.status === "declined");
            setErrorMessage(
              res.status === "declined"
                ? "Location enable request was declined. Please turn on Location in Settings."
                : "Device location is turned off. Please turn on Location in Settings."
            );
            return;
          }
        }

        // Step 3: Acquire fresh location fix
        await getStaffLocation("action");
        setPermissionState("granted");
        setResolutionDeclined(false);
        setErrorMessage(null);
        lastBackgroundRefreshRef.current = Date.now();
      } else {
        // Web / PWA flow
        await getStaffLocation("action");
        setPermissionState("granted");
        setErrorMessage(null);
        lastBackgroundRefreshRef.current = Date.now();
      }
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (err?.locationDisabled || msg.toLowerCase().includes("location is turned off") || msg.toLowerCase().includes("location services")) {
        setPermissionState("location_off");
        setResolutionDeclined(Boolean(err?.resolutionDeclined));
        setErrorMessage(msg);
      } else if (err?.permanentlyDenied || msg.toLowerCase().includes("permission blocked")) {
        setIsPermanentlyDenied(true);
        setPermissionState("denied");
        setErrorMessage(msg);
      } else if (msg.toLowerCase().includes("permission denied")) {
        setPermissionState("denied");
        setErrorMessage(msg);
      } else if (msg.toLowerCase().includes("timed out") || msg.toLowerCase().includes("signal unavailable")) {
        setPermissionState("granted");
        setErrorMessage(msg);
      } else {
        const perm = await queryPermission();
        setPermissionState(perm.state === "granted" ? "granted" : perm.state);
        setErrorMessage(msg || "Could not acquire location.");
      }
    } finally {
      setRefreshing(false);
    }
  }, [setPermissionState, setRefreshing]);

  useEffect(() => {
    registerStaffGeolocationWatch({ suspend: stopWatch, resume: startWatch });
    return () => clearStaffGeolocationWatchRegistration();
  }, [startWatch, stopWatch]);

  useEffect(() => {
    void checkPermissionOnly();
  }, [checkPermissionOnly]);

  // Lifecycle listeners: re-check on app resume from Android Settings / system dialogs
  useEffect(() => {
    let removeAppListener: (() => void) | undefined;

    if (isStaffNativeApp() || Capacitor.isNativePlatform()) {
      void import("@capacitor/app").then(({ App }) => {
        const handle = App.addListener("appStateChange", state => {
          if (state.isActive) {
            void checkPermissionOnly();
          }
        });
        removeAppListener = () => {
          void handle.then(h => h.remove());
        };
      }).catch(() => {});
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void checkPermissionOnly();
        if (permissionStateRef.current === "granted") {
          startWatch();
          void refreshBackgroundLocation();
        }
      } else {
        stopWatch();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (removeAppListener) removeAppListener();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkPermissionOnly, refreshBackgroundLocation, startWatch, stopWatch]);

  useEffect(
    () => () => {
      locationStoreSnapshot().reset();
    },
    [],
  );

  const value: StaffLocationContextValue = {
    permissionState,
    gpsReady,
    lastKnownLocation,
    accuracy,
    lastUpdateTime,
    isRefreshing,
    isPermanentlyDenied,
    resolutionDeclined,
    errorMessage,
    requestPermission,
    enableDeviceLocation,
    openLocationSettings,
    openAppSettings,
    refreshBackgroundLocation,
  };

  return <StaffLocationContext.Provider value={value}>{children}</StaffLocationContext.Provider>;
}

export function useStaffLocation() {
  const ctx = useContext(StaffLocationContext);
  if (!ctx) {
    throw new Error("useStaffLocation must be used within LocationProvider");
  }
  return ctx;
}
