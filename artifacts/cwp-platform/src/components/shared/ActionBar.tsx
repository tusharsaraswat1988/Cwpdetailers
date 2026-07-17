import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

export type ActionBarAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: ButtonProps["variant"];
  disabled?: boolean;
  testId?: string;
};

interface ActionBarProps {
  actions: ActionBarAction[];
  /** Optional leading content, e.g. a selection count ("3 selected"). */
  leading?: ReactNode;
  className?: string;
}

/**
 * The one toolbar for grouped row/bulk actions (e.g. Assign Services queue
 * rows, Job Orchestration manage actions). Keeps action buttons visually and
 * semantically consistent, and gives every destructive action a themed
 * confirmation path instead of a native confirm()/alert().
 */
export function ActionBar({ actions, leading, className }: ActionBarProps) {
  if (actions.length === 0 && !leading) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} data-testid="action-bar">
      {leading && <span className="text-sm text-muted-foreground mr-1">{leading}</span>}
      {actions.map(action => (
        <Button
          key={action.id}
          type="button"
          size="sm"
          variant={action.variant ?? "outline"}
          onClick={action.onClick}
          disabled={action.disabled}
          data-testid={action.testId ?? `action-${action.id}`}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export default ActionBar;
