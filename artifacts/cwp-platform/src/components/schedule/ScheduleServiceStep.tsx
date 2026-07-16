import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CatalogService } from "@/features/master-data/api";
import { cn } from "@/lib/utils";

interface ScheduleServiceStepProps {
  services: CatalogService[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  coveredByPlan?: boolean;
}

export function ScheduleServiceStep({
  services,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  coveredByPlan,
}: ScheduleServiceStepProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Checking available services…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm space-y-3" data-testid="schedule-error-coverage">
        <p className="font-medium text-destructive">{error}</p>
        {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground" data-testid="schedule-error-no-services">
        No services are available at this address right now.
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="schedule-step-service">
      {coveredByPlan && (
        <p className="text-xs text-green-800 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
          Included in your active plan
        </p>
      )}
      {services.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(String(s.id))}
          data-testid={`schedule-service-${s.id}`}
          className={cn(
            "w-full rounded-xl border p-4 text-left transition-all",
            selectedId === String(s.id) ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-sm">{s.name}</p>
              {s.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
              )}
            </div>
            {!coveredByPlan && (
              <p className="text-sm font-semibold text-primary shrink-0">
                ₹{Number(s.basePrice).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default ScheduleServiceStep;
