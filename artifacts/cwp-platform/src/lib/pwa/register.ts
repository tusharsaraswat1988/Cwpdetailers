import { registerSW } from "virtual:pwa-register";
import { setPushServiceWorkerRegistration } from "@/lib/pushNotifications";
import { isStaffNativeApp } from "@/lib/native/staffNative";

let settleRegistration: (registration: ServiceWorkerRegistration | null) => void;
const registrationPromise = new Promise<ServiceWorkerRegistration | null>((resolve) => {
  settleRegistration = resolve;
});

let settled = false;
function settle(registration: ServiceWorkerRegistration | null) {
  if (settled) return;
  settled = true;
  settleRegistration(registration);
}

/**
 * Register the Vite PWA service worker and expose the registration to push subscribe.
 * Must run at app boot (main.tsx) so SW is active before staff taps Allow.
 */
export function initPwa(): void {
  setPushServiceWorkerRegistration(registrationPromise);

  if (isStaffNativeApp()) {
    settle(null);
    return;
  }

  if (!("serviceWorker" in navigator)) {
    settle(null);
    return;
  }

  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        settle(registration ?? null);
      },
      onRegisterError(error) {
        console.error("Service worker registration failed", error);
        settle(null);
      },
    });
  } catch (error) {
    console.error("Service worker registration threw", error);
    settle(null);
  }

  window.setTimeout(() => {
    void navigator.serviceWorker.getRegistration().then((registration) => {
      settle(registration ?? null);
    });
  }, 4000);
}
