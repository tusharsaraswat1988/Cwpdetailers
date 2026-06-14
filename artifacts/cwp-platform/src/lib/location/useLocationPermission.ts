import { useCallback, useEffect, useState } from "react";
import type { LocationPermissionState } from "./types";
import { getStaffLocation, isGeolocationSupported } from "./getStaffLocation";

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

export function useLocationPermission() {
  const [state, setState] = useState<LocationPermissionState>("checking");

  const refresh = useCallback(async () => {
    setState("checking");
    if (!isGeolocationSupported()) {
      setState("unsupported");
      return;
    }
    try {
      await getStaffLocation();
      setState("granted");
    } catch {
      const perm = await queryPermission();
      setState(perm === "granted" ? "granted" : perm);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return { state, refresh, isReady: state === "granted" };
}
