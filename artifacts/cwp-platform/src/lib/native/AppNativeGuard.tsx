import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  getSyncNativePortal,
  getNativePortal,
  isPortalAllowedPath,
  portalHomePath,
  isRootScreenForPortal,
  type NativePortalType,
} from "./portalNative";

/**
 * Multi-portal native guard for Android/iOS Capacitor apps.
 * - In CWP Staff APK (in.cwpdetailers.staff): restricts navigation to /staff/* and legal pages.
 * - In CWP Customer APK (in.cwpdetailers.customer): restricts navigation to /customer/*, onboarding, and legal pages.
 * - In Web Browser: completely inactive (no-op).
 * - Manages hardware back button: minimizes app at root dashboard/login tabs; goes back on child screens.
 */
export function AppNativeGuard() {
  const [location, setLocation] = useLocation();
  const [portal, setPortal] = useState<NativePortalType>(getSyncNativePortal);

  useEffect(() => {
    let cancelled = false;
    void getNativePortal().then((detected) => {
      if (!cancelled && detected !== portal) {
        setPortal(detected);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [portal]);

  useEffect(() => {
    if (portal === "none") return;

    const currentPath = location.split("?")[0] ?? location;
    if (!isPortalAllowedPath(portal, currentPath)) {
      setLocation(portalHomePath(portal));
    }
  }, [location, setLocation, portal]);

  useEffect(() => {
    if (portal === "none") return;

    let cancelled = false;
    let remove: (() => void) | undefined;

    void import("@capacitor/app").then(({ App: CapApp }) => {
      if (cancelled) return;

      const listener = CapApp.addListener("backButton", ({ canGoBack }) => {
        const path = window.location.pathname;

        if (isRootScreenForPortal(portal, path)) {
          void CapApp.minimizeApp();
          return;
        }

        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }

        void CapApp.minimizeApp();
      });

      void listener.then((handle) => {
        if (cancelled) {
          void handle.remove();
          return;
        }
        remove = () => {
          void handle.remove();
        };
      });
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [portal]);

  return null;
}

export default AppNativeGuard;
