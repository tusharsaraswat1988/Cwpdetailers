import { Capacitor } from "@capacitor/core";

/**
 * Global API URL configuration for CWP Detailers / Kleansolar.
 *
 * Web:
 * - By default, web requests use relative paths (e.g. `/api/...`), which automatically
 *   match the current window.location.origin (or Vite dev proxy).
 *
 * Native (Capacitor Android/iOS with Bundled Assets):
 * - Because the HTML/JS bundle is loaded locally (e.g. `capacitor://localhost` or `http://localhost`),
 *   relative `/api/...` calls must be directed to the remote backend server.
 * - Configured via `VITE_API_URL` (build-time) or `window.__CWP_API_URL__` (runtime).
 */

declare global {
  interface Window {
    __CWP_API_URL__?: string;
  }
}

export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function getApiBaseUrl(): string {
  const custom =
    typeof window !== "undefined" && typeof window.__CWP_API_URL__ === "string"
      ? window.__CWP_API_URL__.trim()
      : undefined;

  const envUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  const configured = custom || envUrl || "";

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  // When running on native without a configured URL, warn in console
  if (isNativeApp() && typeof console !== "undefined") {
    console.warn(
      "[CWP Mobile] VITE_API_URL is not set. Native requests to /api may fail against localhost.",
    );
  }

  return "";
}

/**
 * Verify whether a URL points to our trusted backend API.
 * Never attach tokens or portal headers to third-party endpoints (e.g. Cloudinary, Google Maps).
 */
export function isTrustedApiUrl(input: RequestInfo | URL): boolean {
  const urlString =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  // Relative API paths: /api, /api/, /api/auth/login, etc.
  if (urlString.startsWith("/api/") || urlString === "/api") {
    return true;
  }

  try {
    const parsed = new URL(
      urlString,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );

    const isApiPath = parsed.pathname === "/api" || parsed.pathname.startsWith("/api/");
    if (!isApiPath) return false;

    // 1. Matches current window origin (standard web behavior)
    if (typeof window !== "undefined" && parsed.origin === window.location.origin) {
      return true;
    }

    // 2. Matches configured remote backend API origin
    const baseUrl = getApiBaseUrl();
    if (baseUrl) {
      const baseParsed = new URL(baseUrl);
      if (parsed.origin === baseParsed.origin) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Resolve a relative API path to an absolute URL if running on a native platform
 * with a configured remote backend base URL.
 */
export function resolveApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return input;

  if (typeof input === "string") {
    if (input.startsWith("/api/") || input === "/api") {
      return `${baseUrl}${input}`;
    }
    return input;
  }

  if (input instanceof URL) {
    if (
      typeof window !== "undefined" &&
      input.origin === window.location.origin &&
      (input.pathname === "/api" || input.pathname.startsWith("/api/"))
    ) {
      return new URL(`${baseUrl}${input.pathname}${input.search}${input.hash}`);
    }
    return input;
  }

  if (typeof Request !== "undefined" && input instanceof Request) {
    const reqUrl = input.url;
    try {
      const parsed = new URL(reqUrl);
      if (
        typeof window !== "undefined" &&
        parsed.origin === window.location.origin &&
        (parsed.pathname === "/api" || parsed.pathname.startsWith("/api/"))
      ) {
        return new Request(`${baseUrl}${parsed.pathname}${parsed.search}`, input);
      }
    } catch {
      // ignore
    }
    return input;
  }

  return input;
}
