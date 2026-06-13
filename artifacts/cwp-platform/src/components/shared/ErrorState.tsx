import { ReactNode } from "react";
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
  description = "We couldn't load this content. Please try again.",
  onRetry,
  action,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center" data-testid="error-state">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3 text-destructive">
        <AlertTriangle size={20} />
      </div>
      <h3 className="text-foreground font-medium">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1 max-w-sm">{description}</p>
      {(onRetry || action) && (
        <div className="mt-4">
          {action ?? (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorState;
