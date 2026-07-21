import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function OfflineState({
  title = "You're offline",
  description = "Reconnect to the network, then retry. Unsaved changes may need to be re-entered.",
  onRetry,
}: OfflineStateProps) {
  return (
    <div
      className="admin-state flex flex-col items-center justify-center gap-1 px-6 py-14 text-center"
      data-testid="offline-state"
      role="status"
    >
      <div className="admin-icon-well mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <WifiOff size={18} aria-hidden />
      </div>
      <h3 className="admin-state-title font-medium text-foreground">{title}</h3>
      <p className="admin-state-desc mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <div className="admin-state-actions mt-4 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="admin-state-desc mt-2 max-w-sm text-xs text-muted-foreground">
          Restore connectivity, then refresh this page.
        </p>
      )}
    </div>
  );
}

export default OfflineState;
