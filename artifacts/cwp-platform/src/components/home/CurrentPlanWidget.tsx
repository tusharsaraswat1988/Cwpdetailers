import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import type { CustomerPlan } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CustomerSkeleton } from "@/features/customer-ds";

interface CurrentPlanWidgetProps {
  plan: CustomerPlan | null;
  loading?: boolean;
}

export function CurrentPlanWidget({ plan, loading }: CurrentPlanWidgetProps) {
  if (loading) {
    return (
      <div data-testid="home-current-plan">
        <CustomerSkeleton className="h-[5rem] w-full" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        className="customer-card customer-elevated border-dashed px-4 py-3.5 min-h-[5rem]"
        data-testid="home-current-plan-empty"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Current Plan</p>
        <p className="text-sm text-muted-foreground mt-1">No active plan</p>
        <Link
          href={CUSTOMER_ROUTES.plans}
          className="text-primary text-sm font-medium inline-flex items-center gap-0.5 mt-2 min-h-9"
          data-testid="home-view-all-plans"
        >
          View All Plans <ArrowRight size={14} />
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
      className="customer-card customer-elevated px-4 py-3.5 min-h-[5rem]"
      data-testid="home-current-plan"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Current Plan
      </p>
      <Link href={plan.detailHref} className="customer-transition block mt-1.5 hover:opacity-90">
        <p className="font-semibold text-base truncate">{plan.name}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{remainingLabel}</p>
        {plan.expiryDate && (
          <p className="text-xs text-muted-foreground mt-0.5">Expires {plan.expiryDate}</p>
        )}
      </Link>
      <Link
        href={CUSTOMER_ROUTES.plans}
        className="text-primary text-sm font-medium inline-flex items-center gap-0.5 mt-2 min-h-9"
        data-testid="home-view-all-plans"
      >
        View All Plans <ArrowRight size={14} />
      </Link>
    </div>
  );
}

export default CurrentPlanWidget;
