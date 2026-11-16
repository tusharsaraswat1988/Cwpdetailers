import { Loader2, CloudOff, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConnectivity } from "@/services/ConnectivityContext";
import { getStaffLanguage } from "@/lib/staffLanguage";

type SyncStatusIndicatorProps = {
  className?: string;
  compact?: boolean;
};

export function SyncStatusIndicator({ className, compact }: SyncStatusIndicatorProps) {
  const { state, pendingQueueCount, isSyncing } = useConnectivity();
  const isHi = getStaffLanguage() === "hi";

  if (state === "online" && pendingQueueCount === 0 && !isSyncing) {
    if (compact) return null;
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs text-muted-foreground",
          className,
        )}
        data-testid="sync-status"
        data-status="synced"
      >
        <CheckCircle2 size={12} className="text-emerald-500" />
        {isHi ? "सिंक पूरा" : "Synced"}
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
        data-testid="sync-status"
        data-status="syncing"
      >
        <Loader2 size={12} className="animate-spin text-primary" />
        {isHi ? "सिंक हो रहा…" : "Syncing…"}
      </span>
    );
  }

  if (pendingQueueCount > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300",
          className,
        )}
        data-testid="sync-status"
        data-status="pending"
      >
        <CloudOff size={12} />
        {isHi
          ? `${pendingQueueCount} सिंक पेंडिंग`
          : `${pendingQueueCount} Change${pendingQueueCount === 1 ? "" : "s"} Pending`}
      </span>
    );
  }

  if (state !== "online") {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}
        data-testid="sync-status"
        data-status={state}
      >
        <CloudOff size={12} />
        {compact
          ? (isHi ? "ऑफलाइन" : "Offline")
          : (isHi ? "इंटरनेट का इंतजार…" : "Waiting for connection")}
      </span>
    );
  }

  return null;
}

export default SyncStatusIndicator;
