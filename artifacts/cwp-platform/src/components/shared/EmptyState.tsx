import { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  /** What is empty and why it matters. */
  description?: string;
  /** Required for actionable empty states — primary next step (button/link). */
  action?: ReactNode;
  /** Optional secondary guidance shown when no action is provided. */
  hint?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  hint = "Use the actions above to add the first item, or adjust filters.",
}: EmptyStateProps) {
  return (
    <div
      className="admin-state flex flex-col items-center justify-center gap-1 px-6 py-14 text-center"
      data-testid="empty-state"
      role="status"
    >
      <div className="admin-icon-well mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon ?? <Inbox size={18} aria-hidden />}
      </div>
      <h3 className="admin-state-title font-medium text-foreground">{title}</h3>
      {description ? (
        <p className="admin-state-desc mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? (
        <div className="admin-state-actions mt-4 flex flex-wrap justify-center gap-2">{action}</div>
      ) : (
        <p className="admin-state-desc mt-2 max-w-sm text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default EmptyState;
