import { useCallback, useEffect, useRef, useState } from "react";
import type { LocationPermissionState } from "./types";
import { GPS_RECHECK_INTERVAL_MS } from "./constants";
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

type RefreshOptions = { force?: boolean };

export function useLocationPermission() {
  const [state, setState] = useState<LocationPermissionState>("checking");
  const [isVerifying, setIsVerifying] = useState(true);
  const stateRef = useRef(state);
  const lastCheckedAtRef = useRef(0);
  stateRef.current = state;

  const refresh = useCallback(async (options?: RefreshOptions) => {
    const force = options?.force ?? false;
    const now = Date.now();
    const alreadyGranted = stateRef.current === "granted";

    if (!force && alreadyGranted && now - lastCheckedAtRef.current < GPS_RECHECK_INTERVAL_MS) {
      return;
    }

    if (!alreadyGranted) {
      setState("checking");
    }
    setIsVerifying(true);

    if (!isGeolocationSupported()) {
      setState("unsupported");
      setIsVerifying(false);
      return;
    }

    try {
      await getStaffLocation();
      setState("granted");
      lastCheckedAtRef.current = Date.now();
    } catch {
      const perm = await queryPermission();
      const next = perm === "granted" ? "granted" : perm;
      setState(next);
      if (next === "granted") lastCheckedAtRef.current = Date.now();
    } finally {
      setIsVerifying(false);
    }
  }, []);

  useEffect(() => {
    void refresh({ force: true });
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  return {
    state,
    refresh: () => refresh({ force: true }),
    isReady: state === "granted",
    isVerifying,
  };
}
