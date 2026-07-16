import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { CustomerPlan } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface CurrentPlanWidgetProps {
  plan: CustomerPlan | null;
  loading?: boolean;
}

export function CurrentPlanWidget({ plan, loading }: CurrentPlanWidgetProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 animate-pulse min-h-[4.5rem]" data-testid="home-current-plan">
        <div className="h-3 w-24 bg-muted rounded mb-2" />
        <div className="h-4 w-full bg-muted rounded" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        className="rounded-xl border border-dashed border-border bg-card/50 px-3.5 py-3 min-h-[4.5rem]"
        data-testid="home-current-plan-empty"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Current Plan</p>
        <p className="text-sm text-muted-foreground mt-0.5">No active plan</p>
        <Link
          href={CUSTOMER_ROUTES.plans}
          className="text-primary text-xs font-medium inline-flex items-center gap-0.5 mt-2"
          data-testid="home-view-all-plans"
        >
          View All Plans <ArrowRight size={11} />
        </Link>
      </div>
    );
  }

  const remainingLabel = plan.totalAllocated > 0
    ? `${plan.totalRemaining} Visits Remaining`
    : plan.totalRemaining > 0
      ? `${plan.totalRemaining} Services Remaining`
      : "Managed by CWP";

  return (
    <div
      className="rounded-xl border border-border bg-card px-3.5 py-3 min-h-[4.5rem]"
      data-testid="home-current-plan"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Current Plan
      </p>
      <Link href={plan.detailHref} className="block mt-1 hover:opacity-90 transition-opacity">
        <p className="font-semibold text-sm truncate">{plan.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{remainingLabel}</p>
        {plan.expiryDate && (
          <p className="text-xs text-muted-foreground mt-0.5">Expires {plan.expiryDate}</p>
        )}
      </Link>
      <Link
        href={CUSTOMER_ROUTES.plans}
        className="text-primary text-xs font-medium inline-flex items-center gap-0.5 mt-2"
        data-testid="home-view-all-plans"
      >
        View All Plans <ArrowRight size={11} />
      </Link>
    </div>
  );
}

export default CurrentPlanWidget;
