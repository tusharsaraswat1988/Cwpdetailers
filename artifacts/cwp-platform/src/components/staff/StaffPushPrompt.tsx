import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getPushStatus,
  subscribeToPush,
  isPushSupported,
  getBrowserNotificationPermission,
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
      setVisible(Boolean(status?.pushConfigured && !status?.subscribed));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = async () => {
    setEnabling(true);
    try {
      const result = await subscribeToPush();
      if (!result.ok) {
        toast({ title: "Could not enable alerts", description: result.error, variant: "destructive" });
        return;
      }
      toast({
        title: "Job alerts enabled",
        description: "You'll get vibration + notifications when admin assigns new work.",
      });
      setVisible(false);
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
          <p className="font-semibold text-sm">Enable job alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get vibration + popup when a new job is assigned — even if the app is in the background.
          </p>
        </div>
        <button type="button" onClick={dismiss} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
      <Button className="w-full h-11 font-semibold" disabled={enabling} onClick={() => void enable()}>
        {enabling ? <Loader2 size={16} className="animate-spin mr-2" /> : <Bell size={16} className="mr-2" />}
        Turn on notifications
      </Button>
    </div>
  );
}
