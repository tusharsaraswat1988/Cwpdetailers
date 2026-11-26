import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
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
 * - Manages hardware back button: intercepts Android back button to prevent app termination;
 *   dismisses open dialogs, minimizes app at root dashboard/login tabs; navigates back on child screens.
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
    // Hardware back button must be intercepted on all native Android/iOS platforms,
    // regardless of portal type or detection timing, to prevent premature app termination.
    if (!Capacitor.isNativePlatform()) return;

    let cancelled = false;
    let remove: (() => void) | undefined;

    void import("@capacitor/app").then(({ App: CapApp }) => {
      if (cancelled) return;

      const listener = CapApp.addListener("backButton", ({ canGoBack }) => {
        // 1. Dismiss active modal, drawer, or dialog if open
        const openDialogCloseBtn = document.querySelector<HTMLElement>(
          '[role="dialog"] button[aria-label="Close"], [role="alertdialog"] button[aria-label="Cancel"], [data-state="open"] button[aria-label="Close"]'
        );
        if (openDialogCloseBtn) {
          openDialogCloseBtn.click();
          return;
        }

        const path = window.location.pathname;

        // 2. If user is at a root portal screen, minimize rather than terminate
        if (isRootScreenForPortal(portal, path)) {
          void CapApp.minimizeApp();
          return;
        }

        // 3. Navigate back in history if possible
        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }

        // 4. If on child screen without history (e.g. direct deep link), navigate to home
        const home = portalHomePath(portal);
        if (path !== home) {
          setLocation(home);
          return;
        }

        // 5. Final fallback: minimize app
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
  }, [portal, setLocation]);

  return null;
}

export default AppNativeGuard;
