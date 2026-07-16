import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CompletionRing } from "@/components/shared/CompletionRing";
import { PlanProgressBar } from "./PlanProgressBar";
import { type CustomerPlan } from "@/lib/customer-plans";
import { planEligibleForSchedule } from "@/lib/schedule-entry";
import { ArrowRight, Calendar, Car, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { cn } from "@/lib/utils";

export type PlanSummaryVariant = "compact" | "full" | "dashboard";

interface PlanSummaryCardProps {
  plan: CustomerPlan;
  variant?: PlanSummaryVariant;
  className?: string;
  onSelect?: (plan: CustomerPlan) => void;
  showRenew?: boolean;
}

export function PlanSummaryCard({
  plan,
  variant = "full",
  className,
  onSelect,
  showRenew = true,
}: PlanSummaryCardProps) {
  const hasProgress = plan.totalAllocated > 0;
  const statusForBadge = (() => {
    const map: Record<string, string> = {
      ACTIVE: "active",
      PAUSED: "paused",
      EXPIRED: "cancelled",
      COMPLETED: "completed",
      RENEWAL_DUE: "scheduled",
      PENDING_ACTIVATION: "scheduled",
    };
    return map[plan.status] ?? "active";
  })();

  const content = (
    <CardContent className={cn("p-4", variant === "compact" && "p-3")}>
      <div className="flex items-start gap-3">
        {hasProgress && variant !== "compact" ? (
          <CompletionRing
            value={plan.totalUsed}
            max={plan.totalAllocated}
            size={variant === "dashboard" ? 48 : 56}
            label="used"
          />
        ) : null}

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={cn("font-semibold capitalize truncate", variant === "compact" ? "text-sm" : "text-base")}>
                {plan.name}
              </p>
              {variant === "full" && (
                <p className="text-xs text-muted-foreground capitalize">{plan.type.replace(/_/g, " ")}</p>
              )}
            </div>
            <StatusBadge status={statusForBadge} label={plan.displayStatus} className="shrink-0" />
          </div>

          {hasProgress && (
            <PlanProgressBar
              used={plan.totalUsed}
              total={plan.totalAllocated}
              label={variant === "full" ? "Usage Progress" : undefined}
              showCounts={variant !== "dashboard"}
            />
          )}

          {!hasProgress && plan.totalRemaining > 0 && (
            <p className="text-sm text-green-700 font-medium">
              {plan.totalRemaining} services remaining
            </p>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {plan.expiryDate && (
              <span>Expires {plan.expiryDate}</span>
            )}
            {plan.nextVisitDate && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={11} /> Next: {plan.nextVisitDate}
              </span>
            )}
            {plan.vehicleOrSite && (
              <span className="inline-flex items-center gap-1 truncate max-w-full">
                <Car size={11} /> {plan.vehicleOrSite}
              </span>
            )}
          </div>

          {plan.dueAmount > 0 && (
            <p className="text-xs text-destructive font-medium">
              ₹{plan.dueAmount.toLocaleString("en-IN")} due
            </p>
          )}

          {variant !== "compact" && (
            <div className="flex flex-wrap gap-2 pt-1">
              {onSelect ? (
                <Button size="sm" className="flex-1 h-9" onClick={() => onSelect(plan)}>
                  Use Plan <ArrowRight size={13} className="ml-1" />
                </Button>
              ) : (
                <>
                  {planEligibleForSchedule(plan) && !plan.isDailyCleaning && (
                    <Link
                      href={CUSTOMER_ROUTES.scheduleEntry({ planId: plan.id, from: "plans" })}
                      className="flex-1 min-w-[8rem]"
                    >
                      <Button
                        size="sm"
                        className="w-full h-9"
                        data-testid={`btn-schedule-plan-${plan.id}`}
                      >
                        Schedule Next Visit <ArrowRight size={13} className="ml-1" />
                      </Button>
                    </Link>
                  )}
                  <Link
                    href={plan.detailHref}
                    className={planEligibleForSchedule(plan) && !plan.isDailyCleaning ? "" : "flex-1"}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full h-9"
                      data-testid={`btn-open-plan-${plan.id}`}
                    >
                      Open Plan <ArrowRight size={13} className="ml-1" />
                    </Button>
                  </Link>
                </>
              )}
              {showRenew && plan.canRenew && (
                <Link href={CUSTOMER_ROUTES.support}>
                  <Button size="sm" variant="ghost" className="h-9 gap-1 text-muted-foreground">
                    <RefreshCw size={13} /> Renew
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </CardContent>
  );

  if (onSelect) {
    return (
      <Card className={cn("hover:border-primary/40 transition-colors cursor-pointer", className)} data-testid={`plan-card-${plan.id}`}>
        {content}
      </Card>
    );
  }

  return (
    <Card className={cn(className)} data-testid={`plan-card-${plan.id}`}>
      {content}
    </Card>
  );
}

export default PlanSummaryCard;
