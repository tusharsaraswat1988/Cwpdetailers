import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, CheckCircle2, Loader2, Send } from "lucide-react";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  isPushSupported,
  getBrowserNotificationPermission,
  ensureServiceWorkerRegistration,
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

  // Listen for permission changes or tab refocussing (e.g. user allowed notifications in browser bar)
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

  // If the user already allowed permission in their browser and status is configured but not yet subscribed,
  // automatically sync device subscription seamlessly.
  useEffect(() => {
    if (
      permission === "granted" &&
      status &&
      !status.subscribed &&
      status.pushConfigured &&
      !autoRegisteredRef.current &&
      !toggling
    ) {
      autoRegisteredRef.current = true;
      void (async () => {
        try {
          const result = await subscribeToPush({ skipPermissionRequest: true });
          if (result.ok) {
            toast({
              title: "Push notifications connected",
              description: "This device is registered for real-time service updates.",
            });
            await refresh();
          }
        } catch {
          // Keep manual toggle ready
        }
      })();
    }
  }, [permission, status, toggling, refresh, toast]);

  const handleToggle = async (enabled: boolean) => {
    setToggling(true);
    try {
      if (enabled) {
        const result = await subscribeToPush({ forceResync: true });
        if (!result.ok) {
          toast({
            title: "Could not enable notifications",
            description: result.error,
            variant: "destructive",
          });
          checkPermission();
          return;
        }
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
          title: "Test notification sent!",
          description: "Check your screen or notification drawer.",
        });
      } else {
        // Fallback to local notification via Service Worker if server push is queued or unavailable
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
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
              {isSubscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="account-push-enabled"
                  className="text-sm font-semibold text-foreground cursor-pointer"
                >
                  Push Notifications
                </label>
                {isSubscribed ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                Instant alerts for technician arrival, cleaning progress & wash completion
              </p>

              {permission === "denied" ? (
                <p className="mt-1.5 text-xs text-destructive font-medium">
                  Blocked in browser settings — click the lock/settings icon in your address bar and set Notifications to Allow.
                </p>
              ) : null}

              {permission === "granted" && !isSubscribed && !loading ? (
                <p className="mt-1.5 text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Browser permission allowed. Toggle on to receive alerts on this device.
                </p>
              ) : null}

              {!loading && supported && !status?.pushConfigured ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Push notification service is initializing.
                </p>
              ) : null}

              {!supported ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Push notifications are not supported on this device/browser.
                </p>
              ) : null}
            </div>
          </div>

          <Switch
            id="account-push-enabled"
            checked={isSubscribed}
            disabled={disabled}
            onCheckedChange={v => void handleToggle(Boolean(v))}
            aria-label="Push notifications toggle"
            data-testid="account-push-toggle"
            className="shrink-0 cursor-pointer mt-1"
          />
        </div>

        {/* Action button to test notifications when active or permitted */}
        {isSubscribed || permission === "granted" ? (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              Verify notifications are working on this device
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleSendTest()}
              disabled={testingPush || toggling}
              className="h-8 px-3 text-xs font-medium gap-1.5 shrink-0 hover:bg-slate-50"
            >
              {testingPush ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Send className="h-3.5 w-3.5 text-primary" />
              )}
              Send Test Alert
            </Button>
          </div>
        ) : null}
      </div>
    </AccountSection>
  );
});
