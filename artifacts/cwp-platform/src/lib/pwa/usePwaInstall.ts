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

/** @deprecated Use sessionDismissKey for "Not now" — kept for clearing old dismissals. */
function legacyDismissKey(portalKey: string) {
  return `cwp-pwa-install-dismissed-${portalKey}`;
}

function sessionDismissKey(portalKey: string) {
  return `cwp-pwa-install-dismissed-session-${portalKey}`;
}

export function usePwaInstall(portalKey: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneMode);
  const [dismissed, setDismissed] = useState(false);
  const [platform] = useState(detectInstallPlatform);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (localStorage.getItem(legacyDismissKey(portalKey)) === "1") {
        localStorage.removeItem(legacyDismissKey(portalKey));
      }
    } catch {
      /* ignore */
    }

    try {
      setDismissed(sessionStorage.getItem(sessionDismissKey(portalKey)) === "1");
    } catch {
      setDismissed(false);
    }

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
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
    };
  }, [portalKey]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      sessionStorage.setItem(sessionDismissKey(portalKey), "1");
    } catch {
      /* ignore */
    }
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

  const shouldShowBanner = !isStandalone && !dismissed;
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
