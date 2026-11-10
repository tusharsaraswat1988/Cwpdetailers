import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { type CustomerPlan } from "@/lib/customer-plans";
import { planEligibleForSchedule } from "@/lib/schedule-entry";
import { ArrowRight, Calendar, Car, RefreshCw, AlertCircle, Sun } from "lucide-react";
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
  /** Skip outer Card chrome when already wrapped */
  embedded?: boolean;
}

export function PlanSummaryCard({
  plan,
  variant = "full",
  className,
  onSelect,
  showRenew = true,
  embedded = false,
}: PlanSummaryCardProps) {
  const hasProgress = plan.totalAllocated > 0;
  const usagePercent = hasProgress
    ? Math.min(100, Math.max(0, Math.round((plan.totalUsed / plan.totalAllocated) * 100)))
    : 0;

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

  const isSolar = plan.type.includes("solar") || Boolean(plan.solarSiteId);

  const isInactive = plan.status === "EXPIRED" || plan.status === "COMPLETED" || (hasProgress && plan.totalRemaining === 0);

  const cardContent = (
    <div className="space-y-4">
      {/* Top Header: Name, Vehicle, Status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn("font-display font-bold text-foreground leading-snug", variant === "compact" ? "text-sm" : "text-base sm:text-lg")}>
              {plan.name}
            </h3>
          </div>

          {plan.vehicleOrSite && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              {isSolar ? (
                <Sun size={13} className="text-amber-600 shrink-0" />
              ) : (
                <Car size={13} className="text-primary shrink-0" />
              )}
              <span className="truncate font-medium">{plan.vehicleOrSite}</span>
            </div>
          )}
        </div>

        <StatusBadge status={statusForBadge} label={plan.displayStatus} className="shrink-0" />
      </div>

      {/* Middle: Usage Metrics & Accurate Progress Bar */}
      {hasProgress ? (
        <div className="space-y-2 pt-1">
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <span className={cn("font-display font-bold text-2xl sm:text-3xl tabular-nums", isInactive ? "text-muted-foreground" : "text-foreground")}>
                {plan.totalRemaining}
              </span>
              <span className="text-xs font-medium text-muted-foreground ml-1.5">
                Visits Remaining
              </span>
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {plan.totalUsed} Used · {plan.totalAllocated} Total
            </span>
          </div>

          <div
            className="h-2 w-full rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={plan.totalUsed}
            aria-valuemin={0}
            aria-valuemax={plan.totalAllocated}
            aria-label={`${plan.name} usage progress`}
          >
            <div
              className={cn("h-full rounded-full transition-all duration-500 ease-out", isInactive ? "bg-slate-400" : "bg-primary")}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      ) : plan.totalRemaining > 0 ? (
        <div className="pt-1">
          <p className="font-display font-bold text-lg text-emerald-700">
            {plan.totalRemaining} services remaining
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Continuous doorstep care</p>
        </div>
      ) : (
        <div className="pt-1">
          <p className="text-xs text-muted-foreground">Continuous managed plan</p>
        </div>
      )}

      {/* Metadata row: Expiry, Next Visit, Dues */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground pt-1 border-t border-slate-100">
        {plan.expiryDate && (
          <span className="flex items-center gap-1">
            <Calendar size={12} className="text-muted-foreground" />
            Valid till <strong className="font-semibold text-foreground">{plan.expiryDate}</strong>
          </span>
        )}
        {plan.nextVisitDate && (
          <span className="flex items-center gap-1">
            <Calendar size={12} className="text-muted-foreground" />
            Next visit: <strong className="font-semibold text-foreground">{plan.nextVisitDate}</strong>
          </span>
        )}
        {plan.dueAmount > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive font-semibold">
            <AlertCircle size={12} />
            ₹{plan.dueAmount.toLocaleString("en-IN")} due
          </span>
        )}
      </div>

      {/* Action Buttons */}
      {variant !== "compact" && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onSelect ? (
            <Button size="sm" className="flex-1 min-h-11 rounded-xl cursor-pointer" onClick={() => onSelect(plan)}>
              Use Plan <ArrowRight size={14} className="ml-1" />
            </Button>
          ) : (
            <>
              {planEligibleForSchedule(plan) && !plan.isDailyCleaning && (
                <Link
                  href={CUSTOMER_ROUTES.scheduleEntry({ planId: plan.id, from: "plans" })}
                  className="flex-1 min-w-[9rem] cursor-pointer"
                >
                  <Button
                    size="sm"
                    className="w-full min-h-11 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs cursor-pointer"
                    data-testid={`btn-schedule-plan-${plan.id}`}
                  >
                    Schedule Next Visit <ArrowRight size={14} className="ml-1" />
                  </Button>
                </Link>
              )}
              <Link
                href={plan.detailHref}
                className={cn("cursor-pointer", planEligibleForSchedule(plan) && !plan.isDailyCleaning ? "w-auto" : "flex-1")}
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full min-h-11 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-xs text-foreground cursor-pointer"
                  data-testid={`btn-open-plan-${plan.id}`}
                >
                  View Details <ArrowRight size={14} className="ml-1" />
                </Button>
              </Link>
            </>
          )}

          {showRenew && plan.canRenew && (
            <Link href={CUSTOMER_ROUTES.support} className="cursor-pointer">
              <Button size="sm" variant="ghost" className="min-h-11 rounded-xl gap-1 text-muted-foreground hover:text-foreground text-xs cursor-pointer">
                <RefreshCw size={13} /> Renew
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className={cn("p-4 sm:p-5", className)} data-testid={`plan-card-${plan.id}`}>
        {cardContent}
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "rounded-2xl border transition-all duration-200 overflow-hidden",
        isInactive
          ? "border-slate-200 bg-slate-50/60 opacity-90 shadow-none"
          : "border-slate-200/90 bg-white shadow-[0_2px_8px_rgba(11,29,54,0.04)] hover:shadow-[0_4px_14px_rgba(11,29,54,0.08)]",
        onSelect && "cursor-pointer hover:border-primary/40",
        className,
      )}
      onClick={onSelect ? () => onSelect(plan) : undefined}
      data-testid={`plan-card-${plan.id}`}
    >
      <CardContent className={cn("p-4 sm:p-5", variant === "compact" && "p-3.5")}>
        {cardContent}
      </CardContent>
    </Card>
  );
}

export default PlanSummaryCard;
