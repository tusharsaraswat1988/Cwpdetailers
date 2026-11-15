import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, Loader2, Send } from "lucide-react";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  isPushSupported,
  getBrowserNotificationPermission,
  ensureServiceWorkerRegistration,
  isPromptInCooldown,
  setPromptCooldown,
  clearPromptCooldown,
  type PushStatus,
} from "@/lib/pushNotifications";
import { AccountSection } from "./AccountSection";

export const NotificationSection = memo(function NotificationSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    getBrowserNotificationPermission(),
  );
  const supported = isPushSupported();
  const autoRegisteredRef = useRef(false);

  const checkPermission = useCallback(() => {
    const current = getBrowserNotificationPermission();
    setPermission(current);
    return current;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getPushStatus();
      setStatus(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Listen for permission changes or tab refocussing
  useEffect(() => {
    const onFocusOrVisible = () => {
      checkPermission();
      void refresh();
    };

    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    let permStatus: PermissionStatus | undefined;
    if (typeof navigator !== "undefined" && "permissions" in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((p) => {
          permStatus = p;
          p.onchange = () => {
            checkPermission();
            void refresh();
          };
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [checkPermission, refresh]);

  // If already granted, sync device subscription silently without showing any prompt
  useEffect(() => {
    if (
      permission === "granted" &&
      status &&
      !status.subscribed &&
      status.pushConfigured &&
      !autoRegisteredRef.current &&
      !toggling &&
      !isPromptInCooldown()
    ) {
      autoRegisteredRef.current = true;
      void (async () => {
        try {
          const result = await subscribeToPush({ skipPermissionRequest: true });
          if (result.ok) {
            clearPromptCooldown();
            await refresh();
          }
        } catch {
          // Keep manual toggle ready
        }
      })();
    }
  }, [permission, status, toggling, refresh]);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      if (enabled) {
        const result = await subscribeToPush({ forceResync: true });
        if (!result.ok) {
          setPromptCooldown();
          toast({
            title: "Could not enable notifications",
            description: result.error,
            variant: "destructive",
          });
          checkPermission();
          return;
        }
        clearPromptCooldown();
        checkPermission();
        toast({ title: "Notifications enabled" });
      } else {
        await unsubscribeFromPush();
        checkPermission();
        toast({ title: "Notifications disabled" });
      }
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  const handleSendTest = async () => {
    setTestingPush(true);
    try {
      const res = await sendTestPush();
      if (res.ok) {
        toast({
          title: "Test notification sent",
          description: "Check your screen or notification drawer.",
        });
      } else {
        const reg = await ensureServiceWorkerRegistration().catch(() => null);
        if (reg && "showNotification" in reg) {
          await reg.showNotification("CWP Detailers", {
            body: "Your daily vehicle cleaning was completed successfully! 🚗✨",
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: "cwp-test-push",
          });
          toast({
            title: "Test notification displayed",
            description: "Notification delivered via browser service worker.",
          });
        } else if ("Notification" in window && Notification.permission === "granted") {
          new Notification("CWP Detailers", {
            body: "Your daily vehicle cleaning was completed successfully! 🚗✨",
            icon: "/favicon.ico",
          });
          toast({
            title: "Test notification displayed",
            description: "Notification alert delivered successfully.",
          });
        } else {
          toast({
            title: "Could not send test alert",
            description: res.error || "Please check browser permissions.",
            variant: "destructive",
          });
        }
      }
    } catch (err) {
      toast({
        title: "Error sending test alert",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    } finally {
      setTestingPush(false);
    }
  };

  const isSubscribed = Boolean(status?.subscribed);
  const disabled =
    loading ||
    !supported ||
    !status?.pushConfigured ||
    permission === "denied" ||
    toggling;

  return (
    <AccountSection title="Notifications" testId="account-notifications-section">
      <div className="px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {isSubscribed ? <BellRing className="h-4.5 w-4.5" /> : <Bell className="h-4.5 w-4.5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="account-push-enabled"
                  className="text-sm font-semibold text-foreground cursor-pointer select-none"
                >
                  Push Notifications
                </label>
                {isSubscribed ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                    Off
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Service updates and completion alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSubscribed ? (
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={testingPush || toggling}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 transition-colors"
                title="Send test alert"
                aria-label="Send test alert"
                data-testid="account-push-test-btn"
              >
                {testingPush ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            ) : null}
            <Switch
              id="account-push-enabled"
              checked={isSubscribed}
              disabled={disabled}
              onCheckedChange={v => void handleToggle(Boolean(v))}
              aria-label="Push notifications toggle"
              data-testid="account-push-toggle"
              className="cursor-pointer"
            />
          </div>
        </div>

        {permission === "denied" && (
          <p className="mt-2 text-xs text-destructive font-medium">
            Notifications are blocked in browser settings. Please enable them in your address bar to receive alerts.
          </p>
        )}
        {!supported && (
          <p className="mt-2 text-xs text-muted-foreground">
            Push notifications are not supported on this browser.
          </p>
        )}
      </div>
    </AccountSection>
  );
});
