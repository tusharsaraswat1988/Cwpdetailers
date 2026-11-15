import { memo, useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CustomerButton } from "@/features/customer-ds";
import {
  getPushStatus,
  subscribeToPush,
  isPushSupported,
  getBrowserNotificationPermission,
  isPromptInCooldown,
  setPromptCooldown,
  clearPromptCooldown,
  type PushStatus,
} from "@/lib/pushNotifications";

interface NotificationContextualPromptProps {
  className?: string;
  onDismiss?: () => void;
  onEnabled?: () => void;
}

export const NotificationContextualPrompt = memo(function NotificationContextualPrompt({
  className = "",
  onDismiss,
  onEnabled,
}: NotificationContextualPromptProps) {
  const { toast } = useToast();
  const [visible, setVisible] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [status, setStatus] = useState<PushStatus | null>(null);

  useEffect(() => {
    // Audit check: Supported, secure, not in cooldown, permission not denied
    if (!isPushSupported()) return;
    if (isPromptInCooldown()) return;
    const perm = getBrowserNotificationPermission();
    if (perm === "denied") return;

    let mounted = true;
    void getPushStatus().then((s) => {
      if (!mounted) return;
      setStatus(s);
      // Only display if server push is configured and user is not yet subscribed
      if (s?.pushConfigured && !s.subscribed) {
        setVisible(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = useCallback(() => {
    setPromptCooldown();
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      const perm = getBrowserNotificationPermission();
      const result = await subscribeToPush({
        skipPermissionRequest: perm === "granted",
        forceResync: true,
      });

      if (result.ok) {
        clearPromptCooldown();
        setVisible(false);
        toast({
          title: "Notifications Enabled",
          description: "You'll receive real-time cleaning updates and service reminders.",
        });
        onEnabled?.();
      } else {
        // If dismissed or denied, set cooldown so user is not interrupted repeatedly
        setPromptCooldown();
        setVisible(false);
        if (result.code === "denied") {
          toast({
            title: "Notifications Blocked",
            description: "You can enable notifications anytime in your browser settings.",
            variant: "destructive",
          });
        }
      }
    } catch {
      setPromptCooldown();
      setVisible(false);
    } finally {
      setEnabling(false);
    }
  }, [toast, onEnabled]);

  if (!visible) return null;

  return (
    <div
      className={`rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-left shadow-xs transition-all ${className}`}
      data-testid="notification-contextual-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
          <BellRing className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-foreground">
            Stay Updated on Your Car Care
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            Get alerts for cleaning completion, technician updates and service reminders.
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleDismiss}
          disabled={enabling}
          className="min-h-[44px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-foreground transition-colors cursor-pointer rounded-lg"
          data-testid="notification-prompt-dismiss-btn"
        >
          Not Now
        </button>
        <CustomerButton
          variant="default"
          size="sm"
          onClick={handleEnable}
          disabled={enabling}
          className="min-h-[44px] text-xs font-bold px-4 gap-1.5 cursor-pointer shadow-xs"
          data-testid="notification-prompt-enable-btn"
        >
          {enabling ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Enabling...</span>
            </>
          ) : (
            <span>Enable Notifications</span>
          )}
        </CustomerButton>
      </div>
    </div>
  );
});
