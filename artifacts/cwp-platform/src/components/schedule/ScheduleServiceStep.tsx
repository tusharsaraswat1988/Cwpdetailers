import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
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
  onChangeLocation?: () => void;
}

export function ScheduleServiceStep({
  services,
  selectedId,
  onSelect,
  loading,
  error,
  onRetry,
  coveredByPlan,
  onChangeLocation,
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
      <div
        className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center space-y-4 shadow-[0_2px_8px_rgba(11,29,54,0.04)]"
        data-testid="schedule-error-no-services"
      >
        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center">
          <MaterialSymbol name="location_off" size={24} />
        </div>

        <div className="max-w-md mx-auto space-y-1.5">
          <h3 className="font-display font-bold text-base sm:text-lg text-foreground">
            No On-Demand Services at this Location
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            One-time appointment services (express car wash & detailing) are currently active in Varanasi and expanding to Noida. Daily Car Cleaning monthly doorstep care is available in your high-rise society!
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5 max-w-sm mx-auto">
          <Link href={CUSTOMER_ROUTES.plans} className="w-full sm:w-auto flex-1 cursor-pointer">
            <Button
              size="sm"
              className="w-full h-11 min-h-[44px] rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs gap-1.5 cursor-pointer"
            >
              <MaterialSymbol name="assignment" size={16} />
              View Daily Cleaning Plans
            </Button>
          </Link>
          {onChangeLocation && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onChangeLocation}
              className="w-full sm:w-auto h-11 min-h-[44px] rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-xs text-foreground gap-1.5 cursor-pointer"
            >
              <MaterialSymbol name="edit_location" size={16} />
              Change Location
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="schedule-step-service">
      {coveredByPlan && (
        <div className="flex items-center gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5 font-medium">
          <MaterialSymbol name="auto_awesome" size={15} className="text-emerald-600 shrink-0" />
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
                "w-full rounded-2xl border p-4 text-left transition-all flex items-start justify-between gap-3 shadow-xs cursor-pointer",
                isSelected
                  ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm"
                  : "border-slate-200/90 bg-white hover:border-primary/40 hover:shadow-sm",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm sm:text-base text-foreground">{s.name}</p>
                  {isSelected && <MaterialSymbol name="check_circle" size={18} className="text-primary shrink-0" />}
                </div>
                {s.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {s.description}
                  </p>
                )}
              </div>
              {!coveredByPlan && (
                <div className="text-right shrink-0">
                  <p className="text-sm sm:text-base font-bold text-primary tabular-nums font-mono">
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
