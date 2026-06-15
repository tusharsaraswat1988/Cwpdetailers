import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  isPushSupported,
  getBrowserNotificationPermission,
  type PushStatus,
} from "@/lib/pushNotifications";

export function PushNotificationSettings({ variant = "default" }: { variant?: "default" | "staff" }) {
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
        const result = await subscribeToPush();
        if (!result.ok) {
          toast({ title: "Could not enable notifications", description: result.error, variant: "destructive" });
          return;
        }
        toast({ title: variant === "staff" ? "Job alerts enabled" : "Notifications enabled" });
      } else {
        await unsubscribeFromPush();
        toast({ title: "Notifications disabled" });
      }
      await refresh();
    } finally {
      setToggling(false);
    }
  };

  const statusLabel = !supported
    ? "Not supported"
    : !status?.pushConfigured
      ? "Server not configured"
      : permission === "denied"
        ? "Blocked in browser"
        : status?.subscribed
          ? "Enabled"
          : "Disabled";

  const statusVariant = status?.subscribed ? "default" : "secondary";

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            {status?.subscribed ? (
              <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {variant === "staff"
                  ? "Vibration + popup when admin assigns a new job to you"
                  : "Browser alerts for visits, routes, and account updates"}
              </p>
            </div>
          </div>
          <Badge variant={statusVariant}>{statusLabel}</Badge>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading status…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="push-enabled" className="text-sm cursor-pointer">
                Enable notifications
              </Label>
              <Switch
                id="push-enabled"
                checked={Boolean(status?.subscribed)}
                disabled={!supported || !status?.pushConfigured || permission === "denied" || toggling}
                onCheckedChange={v => void handleToggle(Boolean(v))}
              />
            </div>

            {permission === "denied" && (
              <p className="text-xs text-destructive">
                Notifications are blocked. Enable them in your browser site settings.
              </p>
            )}

            {!status?.pushConfigured && (
              <div className="text-xs text-muted-foreground space-y-1 rounded-lg border border-dashed p-3">
                <p>Server push is not configured yet (VAPID keys required).</p>
                {variant === "staff" ? (
                  <p>
                    Dev setup: run{" "}
                    <code className="text-[11px] bg-muted px-1 py-0.5 rounded">
                      pnpm --filter @workspace/scripts run setup:vapid
                    </code>{" "}
                    then restart the API server. In-app job popups still work while the app is open.
                  </p>
                ) : (
                  <p>Ask your administrator to configure VAPID keys on the server.</p>
                )}
              </div>
            )}

            <div className="text-xs space-y-1 pt-1 border-t">
              <p className="text-muted-foreground">Notification status</p>
              <p>{statusLabel}</p>
              {status?.subscriptionCount != null && status.subscribed && (
                <p className="text-muted-foreground">{status.subscriptionCount} device(s) registered</p>
              )}
            </div>

            <div className="text-xs space-y-1">
              <p className="text-muted-foreground">Last notification received</p>
              {status?.lastNotification ? (
                <div className="rounded bg-muted/60 p-2 space-y-0.5">
                  <p className="font-medium">{status.lastNotification.title}</p>
                  <p>{status.lastNotification.body}</p>
                  <p className="text-muted-foreground">
                    {format(new Date(status.lastNotification.receivedAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              ) : (
                <p>No notifications delivered yet</p>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              Refresh status
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
