import { ShieldAlert } from "lucide-react";

interface PermissionDeniedStateProps {
  title?: string;
  description?: string;
}

/**
 * Standard "you don't have access" placeholder — pairs with EmptyState /
 * ErrorState / OfflineState as one of the universal query-result states.
 */
export function PermissionDeniedState({
  title = "You don't have access to this",
  description = "Ask an administrator to grant you permission for this section.",
}: PermissionDeniedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="permission-denied-state">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3 text-amber-600">
        <ShieldAlert size={20} />
      </div>
      <h3 className="text-foreground font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm">{description}</p>
    </div>
  );
}

export default PermissionDeniedState;
