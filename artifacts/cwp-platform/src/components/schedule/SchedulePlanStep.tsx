import { ClipboardList, Sparkles } from "lucide-react";
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
          "w-full text-left rounded-xl border-2 p-4 transition-colors",
          planMode === "one_time" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
        )}
        data-testid="schedule-one-time"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">One-Time Visit</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {eligiblePlans.length === 0
                ? "Schedule a single service without a plan"
                : "Pay for one visit without using plan credits"}
            </p>
          </div>
        </div>
      </button>

      {selectedPlan && planMode === "plan" && (
        <p className="text-xs text-primary bg-primary/5 rounded-md px-3 py-2 inline-flex items-center gap-1.5">
          <ClipboardList size={12} /> Using plan: {selectedPlan.name}
        </p>
      )}
    </div>
  );
}

export default SchedulePlanStep;
