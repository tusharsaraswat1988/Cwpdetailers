import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import type { LocationPermissionState } from "./types";
import { GPS_RECHECK_INTERVAL_MS, GPS_WATCH_OPTIONS } from "./constants";
import { applyStaffLocationUpdate, getStaffLocation, isGeolocationSupported } from "./getStaffLocation";
import { locationStoreSnapshot, useLocationStore } from "./locationStore";

type StaffLocationContextValue = {
  permissionState: LocationPermissionState;
  gpsReady: boolean;
  lastKnownLocation: ReturnType<typeof useLocationStore.getState>["lastKnownLocation"];
  accuracy: number | null;
  lastUpdateTime: number | null;
  isRefreshing: boolean;
  requestPermission: () => Promise<void>;
  refreshBackgroundLocation: () => Promise<void>;
};

const StaffLocationContext = createContext<StaffLocationContextValue | null>(null);

async function queryPermission(): Promise<LocationPermissionState> {
  if (!isGeolocationSupported()) return "unsupported";
  try {
    const perm = await navigator.permissions.query({ name: "geolocation" });
    if (perm.state === "granted") return "granted";
    if (perm.state === "denied") return "denied";
    return "prompt";
  } catch {
    return "prompt";
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

  const watchIdRef = useRef<number | null>(null);
  const lastBackgroundRefreshRef = useRef(0);
  const permissionStateRef = useRef(permissionState);
  permissionStateRef.current = permissionState;

  const stopWatch = useCallback(() => {
    if (watchIdRef.current != null && isGeolocationSupported()) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatch = useCallback(() => {
    if (!isGeolocationSupported() || permissionStateRef.current !== "granted") return;
    if (watchIdRef.current != null) return;

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
    setPermissionState(perm);
  }, [setPermissionState]);

  const requestPermission = useCallback(async () => {
    if (!isGeolocationSupported()) {
      setPermissionState("unsupported");
      return;
    }

    setRefreshing(true);
    try {
      await getStaffLocation("action");
      setPermissionState("granted");
      lastBackgroundRefreshRef.current = Date.now();
    } catch {
      const perm = await queryPermission();
      setPermissionState(perm === "granted" ? "granted" : perm);
    } finally {
      setRefreshing(false);
    }
  }, [setPermissionState, setRefreshing]);

  useEffect(() => {
    void checkPermissionOnly();
  }, [checkPermissionOnly]);

  useEffect(() => {
    if (permissionState !== "granted") {
      stopWatch();
      return;
    }

    void refreshBackgroundLocation();

    if (document.visibilityState === "visible") {
      startWatch();
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startWatch();
        void refreshBackgroundLocation();
      } else {
        stopWatch();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      stopWatch();
    };
  }, [permissionState, refreshBackgroundLocation, startWatch, stopWatch]);

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
    requestPermission,
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
