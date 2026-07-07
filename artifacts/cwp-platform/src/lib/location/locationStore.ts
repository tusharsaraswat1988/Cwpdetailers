import { create } from "zustand";
import type { GpsRequestMode, LocationPermissionState, StaffGpsCoords } from "./types";
import { GPS_NAV_CACHE_MS } from "./constants";

export type StaffLocationState = {
  permissionState: LocationPermissionState;
  gpsReady: boolean;
  lastKnownLocation: StaffGpsCoords | null;
  accuracy: number | null;
  lastUpdateTime: number | null;
  isRefreshing: boolean;
};

type StaffLocationActions = {
  setPermissionState: (state: LocationPermissionState) => void;
  setLocation: (coords: StaffGpsCoords) => void;
  setRefreshing: (value: boolean) => void;
  getCachedLocation: (maxAgeMs?: number) => StaffGpsCoords | null;
  reset: () => void;
};

const initialState: StaffLocationState = {
  permissionState: "checking",
  gpsReady: false,
  lastKnownLocation: null,
  accuracy: null,
  lastUpdateTime: null,
  isRefreshing: false,
};

export const useLocationStore = create<StaffLocationState & StaffLocationActions>((set, get) => ({
  ...initialState,

  setPermissionState: permissionState => set({ permissionState }),

  setLocation: coords =>
    set({
      lastKnownLocation: coords,
      accuracy: coords.accuracy,
      lastUpdateTime: Date.now(),
      gpsReady: true,
    }),

  setRefreshing: isRefreshing => set({ isRefreshing }),

  getCachedLocation: (maxAgeMs = GPS_NAV_CACHE_MS) => {
    const { lastKnownLocation, lastUpdateTime } = get();
    if (!lastKnownLocation || lastUpdateTime == null) return null;
    if (Date.now() - lastUpdateTime > maxAgeMs) return null;
    return lastKnownLocation;
  },

  reset: () => set(initialState),
}));

export function locationStoreSnapshot() {
  return useLocationStore.getState();
}

export function modeUsesCache(mode: GpsRequestMode): boolean {
  return mode === "navigation" || mode === "background";
}
