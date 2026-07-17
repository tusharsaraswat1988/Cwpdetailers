import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/**
 * Standard "you're offline" placeholder — pairs with EmptyState / ErrorState
 * / PermissionDeniedState as one of the universal query-result states.
 */
export function OfflineState({
  title = "You're offline",
  description = "Check your connection and try again.",
  onRetry,
}: OfflineStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="offline-state">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3 text-muted-foreground">
        <WifiOff size={20} />
      </div>
      <h3 className="text-foreground font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm">{description}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" onClick={onRetry}>Try again</Button>
        </div>
      )}
    </div>
  );
}

export default OfflineState;
