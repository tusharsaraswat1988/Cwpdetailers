import { UploadCloud, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectivity } from "@/services/ConnectivityContext";
import { useStaffLanguage } from "@/lib/staffLanguage";

/** Shows pending punch / photo / job uploads so field staff know what still needs network. */
export function StaffPendingSyncBanner() {
  const { pendingQueueCount, isSyncing, processQueue } = useConnectivity();
  const { t, isHindi } = useStaffLanguage();

  if (pendingQueueCount <= 0 && !isSyncing) return null;

  return (
    <div
      className="mx-4 mt-2 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3.5 staff-elevated"
      role="status"
      data-testid="staff-pending-sync"
    >
      <UploadCloud size={18} className="mt-0.5 shrink-0 text-amber-800 dark:text-amber-200" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-amber-950 dark:text-amber-100 font-display">
          {isSyncing
            ? (isHindi ? "अपलोड सिंक हो रहे हैं…" : "Syncing uploads with server…")
            : isHindi
              ? `${pendingQueueCount} अपलोड सुरक्षित (सिंक पेंडिंग)`
              : `${pendingQueueCount} pending upload${pendingQueueCount === 1 ? "" : "s"}`}
        </p>
        <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
          {isHindi
            ? "हाजिरी, फोटो और काम के रिकॉर्ड फोन पर सुरक्षित हैं। नेटवर्क आते ही सर्वर पर भेज दिए जाएंगे।"
            : "Attendance, photos, and job actions are saved on this phone and will automatically upload once network is restored."}
        </p>
      </div>
      {!isSyncing && (
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 px-3 text-xs font-bold border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 text-amber-950 dark:text-amber-100 rounded-xl"
          onClick={() => void processQueue()}
          data-testid="staff-sync-retry-btn"
        >
          <RefreshCw size={13} className="mr-1.5" />
          {isHindi ? "सिंक करें" : "Retry"}
        </Button>
      )}
    </div>
  );
}
