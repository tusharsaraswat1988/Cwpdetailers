import { useEffect, useRef } from "react";
import {
  autoSubscribeStaffPushIfNeeded,
  getBrowserNotificationPermission,
  isPushSupported,
} from "@/lib/pushNotifications";

/** Attempts to register staff for push job alerts once per session (and on permission grant). */
export function useStaffPushAutoSubscribe(active: boolean) {
  const running = useRef(false);

  useEffect(() => {
    if (!active || running.current) return;
    if (!isPushSupported() || getBrowserNotificationPermission() === "denied") return;

    running.current = true;
    void autoSubscribeStaffPushIfNeeded().finally(() => {
      running.current = false;
    });
  }, [active]);

  // Retry when user returns to the tab after granting permission in browser settings.
  useEffect(() => {
    if (!active || !isPushSupported()) return;

    const onFocus = () => {
      if (getBrowserNotificationPermission() === "denied") return;
      void autoSubscribeStaffPushIfNeeded();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [active]);
}
