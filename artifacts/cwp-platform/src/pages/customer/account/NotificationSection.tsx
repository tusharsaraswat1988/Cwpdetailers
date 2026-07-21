import { memo, useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getBrowserNotificationPermission,
  type PushStatus,
} from "@/lib/pushNotifications";
import { AccountSection } from "./AccountSection";

export const NotificationSection = memo(function NotificationSection() {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const supported = isPushSupported();
  const permission = getBrowserNotificationPermission();

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
          return;
        }
        toast({ title: "Notifications enabled" });
      } else {
        await unsubscribeFromPush();
        toast({ title: "Notifications disabled" });
      }
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  const disabled =
    loading ||
    !supported ||
    !status?.pushConfigured ||
    permission === "denied" ||
    toggling;

  return (
    <AccountSection title="Notifications" testId="account-notifications-section">
      <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Push Notifications</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Reminders for scheduled washes
          </p>
          {permission === "denied" ? (
            <p className="mt-1 text-xs text-destructive">
              Blocked in browser settings — enable to receive alerts.
            </p>
          ) : null}
          {!loading && supported && !status?.pushConfigured ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Push not configured yet.
            </p>
          ) : null}
          {!supported ? (
            <p className="mt-1 text-xs text-muted-foreground">Not supported in this browser.</p>
          ) : null}
        </div>
        <Switch
          id="account-push-enabled"
          checked={Boolean(status?.subscribed)}
          disabled={disabled}
          onCheckedChange={v => void handleToggle(Boolean(v))}
          aria-label="Push notifications"
          data-testid="account-push-toggle"
        />
      </div>
    </AccountSection>
  );
});
