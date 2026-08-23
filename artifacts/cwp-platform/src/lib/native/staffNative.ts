import { Capacitor } from "@capacitor/core";

/** True only inside the CWP Staff Android/iOS shell — not the browser PWA. */
export function isStaffNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

const STAFF_NATIVE_PATHS = ["/staff"];
const STAFF_NATIVE_ALLOWED_PREFIXES = [
  "/staff",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-policy",
  "/data-deletion",
];

export function isStaffNativeAllowedPath(pathname: string): boolean {
  return STAFF_NATIVE_ALLOWED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function staffNativeHomePath(): string {
  return "/staff/login";
}

export { STAFF_NATIVE_PATHS };
