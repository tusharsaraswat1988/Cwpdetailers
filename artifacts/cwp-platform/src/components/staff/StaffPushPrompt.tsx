import { useCallback, useEffect, useState } from "react";
import { Bell, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getPushStatus,
  isPushSupported,
  getBrowserNotificationPermission,
  subscribeToPush,
} from "@/lib/pushNotifications";

const DISMISS_KEY = "cwp-staff-push-prompt-dismissed";

export function StaffPushPrompt() {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enableAlerts = async () => {
    setEnabling(true);
    try {
      const result = await subscribeToPush({ forceResync: true });
      if (result.ok) {
        toast({
          title: "Job alerts enabled",
          description: "You'll get vibration + notifications when admin assigns new work.",
        });
        setVisible(false);
        return;
      }
      toast({ title: "Could not enable alerts", description: result.error, variant: "destructive" });
    } finally {
      setEnabling(false);
    }
  };

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
            Tap below, then Allow in the browser prompt — vibration + notification when admin assigns work.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
      <Button
        className="w-full h-11 font-semibold"
        onClick={() => void enableAlerts()}
        disabled={enabling}
        data-testid="btn-enable-staff-push"
      >
        {enabling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
        {enabling ? "Enabling…" : "Allow notifications"}
      </Button>
    </div>
  );
}
