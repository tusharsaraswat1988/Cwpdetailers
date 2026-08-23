import { useEffect } from "react";
import { useLocation } from "wouter";
import {
  isStaffNativeAllowedPath,
  isStaffNativeApp,
  staffNativeHomePath,
} from "./staffNative";

/**
 * Keep the Android staff APK on /staff/* (plus legal pages).
 * Hardware back: history back, or minimize if at login.
 */
export function StaffNativeGuard() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isStaffNativeApp()) return;
    if (!isStaffNativeAllowedPath(location.split("?")[0] ?? location)) {
      setLocation(staffNativeHomePath());
    }
  }, [location, setLocation]);

  useEffect(() => {
    if (!isStaffNativeApp()) return;
    let cancelled = false;
    let remove: (() => void) | undefined;

    void import("@capacitor/app").then(({ App: CapApp }) => {
      if (cancelled) return;
      const listener = CapApp.addListener("backButton", ({ canGoBack }) => {
        const path = window.location.pathname;
        if (path === "/staff/login" || path === "/staff" || path === "/") {
          void CapApp.minimizeApp();
          return;
        }
        if (canGoBack || window.history.length > 1) {
          window.history.back();
          return;
        }
        void CapApp.minimizeApp();
      });
      void listener.then(handle => {
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
  }, []);

  return null;
}
