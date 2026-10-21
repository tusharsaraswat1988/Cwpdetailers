import { Capacitor } from "@capacitor/core";

/**
 * Open external navigation (Google Maps / system navigator).
 * On native Android / Capacitor, dispatches via system intent (_system)
 * so Android launches the Maps app rather than trying to open inside WebView.
 * On web, opens in a new tab.
 */
export function openExternalNavigation(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string" || !url.trim()) return false;
  const targetUrl = url.trim();

  try {
    if (Capacitor.isNativePlatform()) {
      // In native Capacitor on Android, opening with _system hands off to OS intent (Google Maps)
      const win = window.open(targetUrl, "_system");
      if (!win) {
        window.location.href = targetUrl;
      }
    } else {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
    return true;
  } catch {
    try {
      window.location.href = targetUrl;
      return true;
    } catch {
      return false;
    }
  }
}
