import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

export function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean(navigator.standalone)
  );
}

export function usePwaInstall(portalKey: string) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [userInteracted, setUserInteracted] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(`cwp-pwa-install-dismissed-${portalKey}`) === "1";
    } catch {
      return false;
    }
  });
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const onInteract = () => setUserInteracted(true);
    document.addEventListener("pointerdown", onInteract, { once: true });
    document.addEventListener("keydown", onInteract, { once: true });
    return () => {
      document.removeEventListener("pointerdown", onInteract);
      document.removeEventListener("keydown", onInteract);
    };
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
    };

    const displayQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayChange = () => setIsStandalone(isStandaloneDisplay());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    displayQuery.addEventListener("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
      displayQuery.removeEventListener("change", onDisplayChange);
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(`cwp-pwa-install-dismissed-${portalKey}`, "1");
    } catch {
      // ignore storage errors
    }
  }, [portalKey]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === "accepted") {
      dismiss();
      return true;
    }
    return false;
  }, [deferredPrompt, dismiss]);

  const canInstall = Boolean(deferredPrompt) && !isStandalone && !dismissed && userInteracted;

  return {
    canInstall,
    isStandalone,
    install,
    dismiss,
    userInteracted,
  };
}
