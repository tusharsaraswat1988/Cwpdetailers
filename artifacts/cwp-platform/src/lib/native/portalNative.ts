import { Capacitor } from "@capacitor/core";

export type NativePortalType = "staff" | "customer" | "none";

declare global {
  interface Window {
    __CWP_APP_PORTAL__?: NativePortalType;
  }
}

let cachedPortal: NativePortalType | null = null;

const NATIVE_PORTAL_STORAGE_KEY = "cwp_native_portal";

export function setCachedNativePortal(portal: NativePortalType | null): void {
  cachedPortal = portal;
  try {
    if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.setItem === "function") {
      if (portal && portal !== "none") {
        localStorage.setItem(NATIVE_PORTAL_STORAGE_KEY, portal);
      } else {
        localStorage.removeItem(NATIVE_PORTAL_STORAGE_KEY);
      }
    }
  } catch {
    // ignore storage exceptions
  }
}

/**
 * Synchronous portal detection for initial render.
 * Reads window override, cached state, persisted native portal, explicit env,
 * or falls back safely.
 */
export function getSyncNativePortal(): NativePortalType {
  if (cachedPortal) return cachedPortal;

  try {
    if (!Capacitor.isNativePlatform()) {
      return "none";
    }
  } catch {
    return "none";
  }

  if (typeof window !== "undefined" && window.__CWP_APP_PORTAL__) {
    cachedPortal = window.__CWP_APP_PORTAL__;
    return cachedPortal;
  }

  // Check persisted storage from previous verified native detection
  try {
    if (typeof localStorage !== "undefined" && localStorage && typeof localStorage.getItem === "function") {
      const saved = localStorage.getItem(NATIVE_PORTAL_STORAGE_KEY);
      if (saved === "staff" || saved === "customer") {
        cachedPortal = saved;
        return cachedPortal;
      }
    }
  } catch {
    // ignore
  }

  const envPortal = (import.meta.env.VITE_APP_PORTAL as string | undefined)?.toLowerCase();
  if (envPortal === "staff" || envPortal === "customer") {
    cachedPortal = envPortal;
    return cachedPortal;
  }

  // Fallback heuristic based on initial URL pathname
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/staff")) {
    return "staff";
  }

  return "none";
}

/**
 * Asynchronous detection verifying the actual native bundle ID via @capacitor/app.
 * Persists the result for immediate synchronous access on subsequent boots.
 */
export async function getNativePortal(): Promise<NativePortalType> {
  if (cachedPortal && cachedPortal !== "none") return cachedPortal;

  try {
    if (!Capacitor.isNativePlatform()) {
      cachedPortal = "none";
      return "none";
    }

    const { App } = await import("@capacitor/app");
    const info = await App.getInfo();
    const id = info.id.toLowerCase();

    if (id.includes("staff")) {
      setCachedNativePortal("staff");
      return "staff";
    }
    if (id.includes("customer")) {
      setCachedNativePortal("customer");
      return "customer";
    }
  } catch {
    // Fall back to synchronous detection
  }

  return getSyncNativePortal();
}

export function isStaffNativeApp(): boolean {
  return getSyncNativePortal() === "staff";
}

export function isCustomerNativeApp(): boolean {
  return getSyncNativePortal() === "customer";
}

export function isAnyNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const COMMON_LEGAL_PREFIXES = [
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-policy",
  "/data-deletion",
  "/about-us",
  "/contact-us",
];

const STAFF_ALLOWED_PREFIXES = [
  "/staff",
  ...COMMON_LEGAL_PREFIXES,
];

const CUSTOMER_ALLOWED_PREFIXES = [
  "/customer",
  "/login",
  "/register",
  "/verify-otp",
  "/forgot-password",
  "/vehicle",
  "/solar",
  ...COMMON_LEGAL_PREFIXES,
];

const CUSTOMER_FORBIDDEN_PREFIXES = [
  "/staff",
  "/admin",
  "/franchisee",
];

export function isPortalAllowedPath(portal: NativePortalType, pathname: string): boolean {
  if (portal === "none") return true;

  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (portal === "staff") {
    return STAFF_ALLOWED_PREFIXES.some(
      prefix => clean === prefix || clean.startsWith(`${prefix}/`),
    );
  }

  if (portal === "customer") {
    // Strictly forbidden for customer app
    if (CUSTOMER_FORBIDDEN_PREFIXES.some(prefix => clean === prefix || clean.startsWith(`${prefix}/`))) {
      return false;
    }
    // Landing root
    if (clean === "/") return true;
    // Known allowed customer prefixes
    if (CUSTOMER_ALLOWED_PREFIXES.some(prefix => clean === prefix || clean.startsWith(`${prefix}/`))) {
      return true;
    }
    // City SEO routes like /varanasi/daily-car-cleaning
    const segments = clean.split("/").filter(Boolean);
    if (segments.length === 2 && !CUSTOMER_FORBIDDEN_PREFIXES.includes(`/${segments[0]}`)) {
      return true;
    }
    return false;
  }

  return true;
}

export function portalHomePath(portal: NativePortalType): string {
  if (portal === "staff") {
    try {
      if (typeof localStorage !== "undefined") {
        const hasStaffSession = Boolean(
          localStorage.getItem("cwp_token_staff") || localStorage.getItem("cwp_user_staff")
        );
        if (hasStaffSession) return "/staff/dashboard";
      }
    } catch {
      // fallback to login if storage is inaccessible
    }
    return "/staff/login";
  }
  if (portal === "customer") return "/customer/dashboard";
  return "/";
}

export function isRootScreenForPortal(portal: NativePortalType, pathname: string): boolean {
  const clean = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (portal === "staff") {
    return clean === "/staff/login" || clean === "/staff/dashboard" || clean === "/staff" || clean === "/";
  }

  if (portal === "customer") {
    return (
      clean === "/customer/dashboard" ||
      clean === "/customer" ||
      clean === "/login" ||
      clean === "/register" ||
      clean === "/vehicle" ||
      clean === "/solar" ||
      clean === "/"
    );
  }

  return clean === "/";
}
