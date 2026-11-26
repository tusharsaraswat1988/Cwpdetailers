import { UploadCloud, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConnectivity } from "@/services/ConnectivityContext";
import { useStaffLanguage } from "@/lib/staffLanguage";

/** Shows pending punch / photo / job uploads and quarantined items so field staff know sync status. */
export function StaffPendingSyncBanner() {
  const { pendingQueueCount, quarantinedCount, isSyncing, processQueue, retryQuarantined } = useConnectivity();
  const { t, isHindi } = useStaffLanguage();

  if (pendingQueueCount <= 0 && quarantinedCount <= 0 && !isSyncing) return null;

  if (quarantinedCount > 0 && pendingQueueCount <= 0 && !isSyncing) {
    return (
      <div
        className="mx-4 mt-2 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3.5 staff-elevated"
        role="status"
        data-testid="staff-quarantined-sync"
      >
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-destructive font-display">
            {isHindi
              ? `${quarantinedCount} अपलोड में ध्यान देने की जरूरत है`
              : `${quarantinedCount} upload${quarantinedCount === 1 ? "" : "s"} need attention`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {isHindi
              ? "कुछ रिकॉर्ड सर्वर पर स्वीकार नहीं हुए। दोबारा सिंक करने के लिए प्रयास करें।"
              : "Some uploads could not be synced automatically. Tap to retry."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-10 shrink-0 px-3 text-xs font-bold border-destructive/40 bg-destructive/20 hover:bg-destructive/30 text-destructive rounded-xl"
          onClick={() => void retryQuarantined()}
          data-testid="staff-quarantine-retry-btn"
        >
          <RefreshCw size={13} className="mr-1.5" />
          {isHindi ? "दोबारा प्रयास" : "Retry All"}
        </Button>
      </div>
    );
  }

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
              ? `${pendingQueueCount} अपलोड सुरक्षित (सिंक पेंडिंग)${quarantinedCount > 0 ? ` (${quarantinedCount} ध्यान देने योग्य)` : ""}`
              : `${pendingQueueCount} pending upload${pendingQueueCount === 1 ? "" : "s"}${quarantinedCount > 0 ? ` (${quarantinedCount} need attention)` : ""}`}
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
