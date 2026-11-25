import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import { PlanSummaryCard } from "@/components/plans/PlanSummaryCard";
import type { CustomerPlan } from "@/lib/customer-plans";
import type { PlanMode } from "@/lib/schedule-journey";
import { cn } from "@/lib/utils";

interface SchedulePlanStepProps {
  eligiblePlans: CustomerPlan[];
  selectedPlan: CustomerPlan | null;
  planMode: PlanMode | null;
  onSelectPlan: (plan: CustomerPlan) => void;
  onSelectOneTime: () => void;
}

export function SchedulePlanStep({
  eligiblePlans,
  selectedPlan,
  planMode,
  onSelectPlan,
  onSelectOneTime,
}: SchedulePlanStepProps) {
  return (
    <div className="space-y-3" data-testid="schedule-step-plan">
      {eligiblePlans.map(plan => (
        <PlanSummaryCard
          key={plan.id}
          plan={plan}
          variant="compact"
          onSelect={onSelectPlan}
          showRenew={false}
        />
      ))}

      <button
        type="button"
        onClick={onSelectOneTime}
        className={cn(
          "w-full text-left rounded-2xl border-2 p-4 transition-all cursor-pointer shadow-xs",
          planMode === "one_time" ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm" : "border-slate-200/90 bg-white hover:border-primary/40",
        )}
        data-testid="schedule-one-time"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
            <MaterialSymbol name="auto_awesome" size={20} />
          </div>
          <div>
            <p className="font-semibold text-sm sm:text-base text-foreground">One-Time Visit</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {eligiblePlans.length === 0
                ? "Schedule a single service without a plan"
                : "Pay for one visit without using plan credits"}
            </p>
          </div>
        </div>
      </button>

      {selectedPlan && planMode === "plan" && (
        <p className="text-xs text-primary bg-primary/5 rounded-xl px-3.5 py-2.5 inline-flex items-center gap-1.5 font-medium border border-primary/20">
          <MaterialSymbol name="assignment" size={14} /> Using plan: {selectedPlan.name}
        </p>
      )}
    </div>
  );
}

export default SchedulePlanStep;
