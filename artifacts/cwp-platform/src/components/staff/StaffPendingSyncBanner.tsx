import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectivity } from "@/services/ConnectivityContext";

/** Shows pending punch / photo / job uploads so field staff know what still needs network. */
export function StaffPendingSyncBanner() {
  const { pendingQueueCount, isSyncing, processQueue } = useConnectivity();

  if (pendingQueueCount <= 0 && !isSyncing) return null;

  return (
    <div
      className="mx-4 mt-2 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
      role="status"
      data-testid="staff-pending-sync"
    >
      <UploadCloud size={16} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-200" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
          {isSyncing
            ? "Uploads sync ho rahe hain…"
            : `${pendingQueueCount} pending upload${pendingQueueCount === 1 ? "" : "s"}`}
        </p>
        <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-100/80">
          Punch, photos, aur job actions phone pe save hain. Network aate hi server par jayenge.
        </p>
      </div>
      {!isSyncing && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={() => void processQueue()}
        >
          Retry
        </Button>
      )}
    </div>
  );
}
