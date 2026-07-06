import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  autoSubscribeStaffPushIfNeeded,
  getPushStatus,
  isPushSupported,
  getBrowserNotificationPermission,
} from "@/lib/pushNotifications";

const DISMISS_KEY = "cwp-staff-push-prompt-dismissed";

export function StaffPushPrompt() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isPushSupported()) {
        setVisible(false);
        return;
      }
      if (getBrowserNotificationPermission() === "denied") {
        setVisible(false);
        return;
      }
      if (sessionStorage.getItem(DISMISS_KEY)) {
        setVisible(false);
        return;
      }
      const status = await getPushStatus();
      if (!status?.pushConfigured || status.subscribed) {
        setVisible(false);
        return;
      }
      setVisible(true);
      const result = await autoSubscribeStaffPushIfNeeded();
      if (result.ok) {
        toast({
          title: "Job alerts enabled",
          description: "You'll get vibration + notifications when admin assigns new work.",
        });
        setVisible(false);
        return;
      }
      if (result.error && result.error !== "denied" && result.error !== "unsupported") {
        toast({ title: "Could not enable alerts", description: result.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (loading || !visible) return null;

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
          <p className="font-semibold text-sm">Allow job alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tap Allow in the browser prompt so we can vibrate and notify you when a new job is assigned.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
