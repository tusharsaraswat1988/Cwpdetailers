import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  action?: ReactNode;
}

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this content. Retry, or check your connection and try again.",
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div
      className="admin-state flex flex-col items-center justify-center gap-1 px-6 py-14 text-center"
      data-testid="error-state"
      role="alert"
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
        <AlertTriangle size={18} aria-hidden />
      </div>
      <h3 className="admin-state-title font-medium text-foreground">{title}</h3>
      <p className="admin-state-desc mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {(onRetry || action) && (
        <div className="admin-state-actions mt-4 flex flex-wrap justify-center gap-2">
          {action ?? (
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorState;
