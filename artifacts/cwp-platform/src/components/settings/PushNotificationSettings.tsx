import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bell, BellRing, Loader2, RotateCw, Vibrate, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  resyncPushSubscription,
  isPushSupported,
  getBrowserNotificationPermission,
  type PushStatus,
} from "@/lib/pushNotifications";
import { vibrateStaffJobAlert } from "@/lib/staff-vibration";

const VIBRATION_STORAGE_KEY = "cwp_staff_vibration_enabled";

export function PushNotificationSettings({ variant = "default" }: { variant?: "default" | "staff" }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const supported = isPushSupported();
  const permission = getBrowserNotificationPermission();

  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    try {
      return localStorage.getItem(VIBRATION_STORAGE_KEY) !== "false";
    } catch {
      return true;
    }
  });

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

  const handleVibrationToggle = (enabled: boolean) => {
    setVibrationEnabled(enabled);
    try {
      localStorage.setItem(VIBRATION_STORAGE_KEY, enabled ? "true" : "false");
    } catch {
      // ignore
    }
    if (enabled) {
      vibrateStaffJobAlert();
      toast({ title: "Alert vibration enabled" });
    } else {
      toast({ title: "Alert vibration muted" });
    }
  };

  const handleBrowserPushToggle = async (enabled: boolean) => {
    if (!supported) return;
    setToggling(true);
    try {
      if (enabled) {
        const result = await subscribeToPush({ forceResync: true });
        if (!result.ok) {
          toast({ title: "Could not enable notifications", description: result.error, variant: "destructive" });
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

  const handleTestVibration = () => {
    vibrateStaffJobAlert();
    toast({
      title: "Vibration alert tested",
      description: "Haptic alert pattern triggered for job notifications.",
    });
  };

  // Staff mobile UI view
  if (variant === "staff") {
    return (
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm sm:text-base text-foreground">
                  Job Alerts & Notifications
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  Real-time alerts for new job assignments, schedule changes, and route updates.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          </div>

          {/* Alert Options */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <Vibrate className="h-4 w-4 text-primary shrink-0" />
              <div>
                <Label htmlFor="staff-vibration" className="text-sm font-medium cursor-pointer">
                  Vibration & Sound Alert
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Vibrate phone when a new job is assigned
                </p>
              </div>
            </div>
            <Switch
              id="staff-vibration"
              checked={vibrationEnabled}
              onCheckedChange={handleVibrationToggle}
            />
          </div>

          {/* Last notification received - Spacious, readable card */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>Last Notification Received</span>
              </div>
              {status?.lastNotification && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  Delivered
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Checking latest notifications…</span>
              </div>
            ) : status?.lastNotification ? (
              <div className="space-y-2.5">
                <p className="text-sm font-bold text-foreground leading-snug">
                  {status.lastNotification.title}
                </p>
                <div className="rounded-lg bg-card border border-border/60 p-3 text-xs sm:text-sm text-foreground/90 font-medium leading-relaxed">
                  {status.lastNotification.body}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(new Date(status.lastNotification.receivedAt), "dd MMMM yyyy, hh:mm a")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center space-y-1">
                <p className="text-xs font-medium text-foreground">No notifications received yet</p>
                <p className="text-[11px] text-muted-foreground">
                  When new jobs or route updates are assigned, full details will appear here.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs font-medium gap-1.5"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh status
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-xs font-medium gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleTestVibration}
            >
              <Vibrate className="h-3.5 w-3.5" />
              Test vibration
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default browser push notification settings view (admin / customer)
  const statusLabel = !supported
    ? "Not supported in this browser"
    : !status?.pushConfigured
      ? "Server not configured"
      : permission === "denied"
        ? "Blocked in browser"
        : status?.subscribed
          ? "Enabled"
          : "Disabled";

  const statusVariant = supported && status?.subscribed ? "default" : "secondary";
  const isChecked = supported && Boolean(status?.subscribed);

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Web Push Notifications</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Browser alerts for bookings, visits, routes, and account updates.
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
                Enable browser notifications
              </Label>
              <Switch
                id="push-enabled"
                checked={isChecked}
                disabled={!supported || !status?.pushConfigured || permission === "denied" || toggling}
                onCheckedChange={v => void handleBrowserPushToggle(Boolean(v))}
              />
            </div>

            {supported && permission === "denied" && (
              <p className="text-xs text-destructive">
                Notifications are blocked. Please enable them in your browser site permissions.
              </p>
            )}

            {/* Last notification received - Clean layout */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Last Notification Received
              </p>
              {status?.lastNotification ? (
                <div className="rounded-lg bg-card border border-border/60 p-3 space-y-1">
                  <p className="text-sm font-semibold">{status.lastNotification.title}</p>
                  <p className="text-xs text-muted-foreground">{status.lastNotification.body}</p>
                  <p className="text-[11px] text-muted-foreground pt-1">
                    {format(new Date(status.lastNotification.receivedAt), "dd MMM yyyy, hh:mm a")}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No notifications delivered yet</p>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
              <RotateCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh status
            </Button>

            {supported && status?.subscribed && status?.pushConfigured && (
              <Button
                variant="outline"
                size="sm"
                disabled={toggling}
                onClick={() => {
                  setToggling(true);
                  void resyncPushSubscription()
                    .then(async result => {
                      if (!result.ok) {
                        toast({ title: "Re-sync failed", description: result.error, variant: "destructive" });
                        return;
                      }
                      toast({ title: "Device re-synced", description: "Push notifications refreshed for this device." });
                      await refresh();
                    })
                    .finally(() => setToggling(false));
                }}
              >
                Re-sync this device
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
