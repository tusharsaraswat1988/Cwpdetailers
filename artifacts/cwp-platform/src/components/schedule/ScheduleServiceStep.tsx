import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
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
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 size={18} className="animate-spin text-primary" /> Checking available services…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm space-y-3" data-testid="schedule-error-coverage">
        <p className="font-semibold text-destructive">{error}</p>
        {onRetry && (
          <Button size="sm" variant="outline" className="rounded-xl" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-muted-foreground bg-slate-50/50" data-testid="schedule-error-no-services">
        No services are currently available at this location.
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="schedule-step-service">
      {coveredByPlan && (
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 font-medium">
          <Sparkles size={14} className="text-emerald-600 shrink-0" />
          <span>Covered by your active plan membership credits</span>
        </div>
      )}
      <div className="space-y-2.5">
        {services.map(s => {
          const isSelected = selectedId === String(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(String(s.id))}
              data-testid={`schedule-service-${s.id}`}
              className={cn(
                "w-full rounded-2xl border p-4 text-left transition-all flex items-start justify-between gap-3 shadow-xs",
                isSelected
                  ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm"
                  : "border-slate-200/90 bg-white hover:border-primary/40 hover:shadow-sm",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm sm:text-base text-foreground">{s.name}</p>
                  {isSelected && <CheckCircle2 size={16} className="text-primary shrink-0" />}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {s.description}
                  </p>
                )}
              </div>
              {!coveredByPlan && (
                <div className="text-right shrink-0">
                  <p className="text-sm sm:text-base font-bold text-primary">
                    ₹{Number(s.basePrice).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-muted-foreground">one-time</p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleServiceStep;
