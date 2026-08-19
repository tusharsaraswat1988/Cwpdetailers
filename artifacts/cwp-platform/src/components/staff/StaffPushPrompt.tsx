import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getPushStatus,
  isPushSupported,
  isNotificationSecureContext,
  getBrowserNotificationPermission,
  subscribeToPush,
  warmUpPushInfrastructure,
  PERMISSION_HINT_MS,
  type PushSubscribeProgress,
} from "@/lib/pushNotifications";

const DISMISS_KEY = "cwp-staff-push-prompt-dismissed";
const UI_WAIT_MS = 20_000;

function progressLabel(stage: PushSubscribeProgress | null, hintVisible: boolean): string {
  if (stage === "requesting-permission") {
    return hintVisible ? "Waiting for Allow in Chrome…" : "Waiting for Allow…";
  }
  if (stage === "waiting-service-worker") return "Preparing this device…";
  if (stage === "registering") return "Saving on this device…";
  return "Enabling…";
}

export function StaffPushPrompt() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [stage, setStage] = useState<PushSubscribeProgress | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isPushSupported()) {
        setVisible(false);
        return;
      }
      if (sessionStorage.getItem(DISMISS_KEY)) {
        setVisible(false);
        return;
      }
      if (!isNotificationSecureContext()) {
        setError("Chrome only allows notifications on HTTPS or localhost. Open this app from a secure URL.");
        setVisible(true);
        return;
      }
      if (getBrowserNotificationPermission() === "denied") {
        setError("Notifications are blocked. Click the lock icon in the address bar → Site settings → Notifications → Allow, then Try again.");
        setVisible(true);
        return;
      }
      const status = await getPushStatus();
      if (!status?.pushConfigured || status.subscribed) {
        setVisible(false);
        return;
      }
      setError(null);
      setVisible(true);
      void warmUpPushInfrastructure();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabling || stage !== "requesting-permission") {
      setHintVisible(false);
      return;
    }
    const timer = window.setTimeout(() => setHintVisible(true), PERMISSION_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [enabling, stage]);

  useEffect(() => {
    if (!enabling || !("permissions" in navigator)) return;
    let permissionStatus: PermissionStatus | undefined;
    const watch = async () => {
      try {
        permissionStatus = await navigator.permissions.query({ name: "notifications" as PermissionName });
        permissionStatus.onchange = () => {
          if (permissionStatus?.state === "granted" && enabling) {
            void subscribeToPush({ skipPermissionRequest: true, onProgress: setStage });
          }
        };
      } catch {
        /* Permissions API not available for notifications in this browser */
      }
    };
    void watch();
    return () => {
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [enabling]);

  const enableAlerts = async () => {
    setEnabling(true);
    setError(null);
    setHintVisible(false);
    setStage("requesting-permission");

    const resultPromise = subscribeToPush({
      forceResync: true,
      onProgress: setStage,
    });

    let timedOutUi = false;
    const uiTimer = window.setTimeout(() => {
      timedOutUi = true;
      setHintVisible(true);
      setError("No Allow popup? Click the lock or bell icon in Chrome’s address bar, tap Allow, then Try again.");
      setEnabling(false);
      setStage(null);
    }, UI_WAIT_MS);

    try {
      const result = await resultPromise;
      if (result.ok) {
        toast({
          title: "Job alerts enabled",
          description: "You'll get vibration + notifications when admin assigns new work.",
        });
        setVisible(false);
        return;
      }
      if (!timedOutUi) {
        setError(result.error);
        toast({ title: "Could not enable alerts", description: result.error, variant: "destructive" });
      }
    } finally {
      window.clearTimeout(uiTimer);
      if (!timedOutUi) {
        setEnabling(false);
        setStage(null);
      }
    }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (loading || !visible) return null;

  const body = error
    ? error
    : enabling && hintVisible
      ? "No popup? Click the lock or bell icon in Chrome’s address bar, then Allow."
      : enabling
        ? "Chrome should ask Allow now — tap Allow in the browser popup."
        : "Tap below, then Allow in the browser prompt — vibration + notification when admin assigns work.";

  return (
    <div
      className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-4 space-y-3"
      data-testid="staff-push-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Bell size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {error && !enabling && getBrowserNotificationPermission() === "denied"
              ? "Notifications blocked"
              : "Allow job alerts"}
          </p>
          <p className={`text-xs mt-0.5 ${error && !enabling ? "text-destructive" : "text-muted-foreground"}`}>
            {body}
          </p>
        </div>
        <button type="button" onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
      <Button
        type="button"
        className="w-full h-11 font-semibold"
        onClick={() => void enableAlerts()}
        disabled={enabling}
        data-testid="btn-enable-staff-push"
      >
        {enabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
        {enabling ? progressLabel(stage, hintVisible) : error ? "Try again" : "Allow notifications"}
      </Button>
    </div>
  );
}
