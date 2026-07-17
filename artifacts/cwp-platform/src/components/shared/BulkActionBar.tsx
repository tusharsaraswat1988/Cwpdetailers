import { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type BulkAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
};

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
  className?: string;
}

/**
 * The one bulk-action toolbar for the admin panel. Appears when DataTable
 * rows are selected; pairs with DataTable's `selection` prop. Do not build a
 * page-specific "N selected" bar — extend this component instead.
 */
export function BulkActionBar({ selectedCount, actions, onClear, className }: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        "sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg",
        className,
      )}
      role="region"
      aria-label="Bulk actions"
      data-testid="bulk-action-bar"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <button
          type="button"
          onClick={onClear}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Clear selection"
        >
          <X size={12} />
        </button>
        {selectedCount} selected
      </div>
      <div className="flex flex-wrap items-center gap-2 ml-auto">
        {actions.map(action => (
          <Button
            key={action.id}
            type="button"
            size="sm"
            variant={action.variant ?? "outline"}
            onClick={action.onClick}
            disabled={action.disabled}
            data-testid={`bulk-action-${action.id}`}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default BulkActionBar;
