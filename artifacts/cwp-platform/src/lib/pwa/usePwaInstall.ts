import { useCallback, useEffect, useState } from "react";

export type PwaInstallPlatform = "ios" | "android" | "desktop" | "unknown";

function detectInstallPlatform(): PwaInstallPlatform {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function seenKey(portalKey: string) {
  return `cwp-pwa-install-seen-${portalKey}`;
}

/** @deprecated Use seenKey — kept for clearing old dismissals. */
function legacyDismissKey(portalKey: string) {
  return `cwp-pwa-install-dismissed-${portalKey}`;
}

function sessionDismissKey(portalKey: string) {
  return `cwp-pwa-install-dismissed-session-${portalKey}`;
}

function readSeen(portalKey: string): boolean {
  try {
    if (localStorage.getItem(seenKey(portalKey)) === "1") return true;
    if (localStorage.getItem(legacyDismissKey(portalKey)) === "1") return true;
    if (sessionStorage.getItem(sessionDismissKey(portalKey)) === "1") return true;
  } catch {
    /* ignore */
  }
  return false;
}

function markSeen(portalKey: string) {
  try {
    localStorage.setItem(seenKey(portalKey), "1");
    localStorage.removeItem(legacyDismissKey(portalKey));
    sessionStorage.removeItem(sessionDismissKey(portalKey));
  } catch {
    /* ignore */
  }
}

export function usePwaInstall(portalKey: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode);
  const [seen, setSeen] = useState(() => readSeen(portalKey));
  const [platform] = useState(detectInstallPlatform);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      markSeen(portalKey);
      setSeen(true);
    };

    const mq = window.matchMedia("(display-mode: standalone)");
    const onDisplayMode = () => setIsStandalone(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener("change", onDisplayMode);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener("change", onDisplayMode);
      if (!isStandaloneMode()) {
        markSeen(portalKey);
      }
    };
  }, [portalKey]);

  const dismiss = useCallback(() => {
    markSeen(portalKey);
    setSeen(true);
  }, [portalKey]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      setIsStandalone(true);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const shouldShowBanner = !isStandalone && !seen;
  const hasNativePrompt = Boolean(deferredPrompt);

  return {
    canInstall: shouldShowBanner,
    hasNativePrompt,
    platform,
    isStandalone,
    install,
    dismiss,
  };
}
