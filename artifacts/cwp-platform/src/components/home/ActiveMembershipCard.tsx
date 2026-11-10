import { Link } from "wouter";
import { ArrowRight, Car, Shield, Sparkles, CheckCircle2 } from "lucide-react";
import type { CustomerPlan } from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";

interface ActiveMembershipCardProps {
  plan: CustomerPlan | null;
  loading?: boolean;
}

export function ActiveMembershipCard({ plan, loading }: ActiveMembershipCardProps) {
  if (loading) {
    return (
      <div className="customer-navy-card p-5 sm:p-6 animate-pulse space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 bg-white/20 rounded-md w-32" />
          <div className="h-5 bg-white/15 rounded-md w-16" />
        </div>
        <div className="space-y-2">
          <div className="h-6 bg-white/20 rounded-md w-3/4" />
          <div className="h-4 bg-white/15 rounded-md w-1/2" />
        </div>
        <div className="pt-4 border-t border-white/10 space-y-2">
          <div className="flex justify-between">
            <div className="h-7 bg-white/20 rounded-md w-24" />
            <div className="h-4 bg-white/15 rounded-md w-28" />
          </div>
          <div className="h-2.5 bg-white/15 rounded-full w-full" />
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div
        className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        data-testid="home-membership-empty"
      >
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center shrink-0">
            <Shield size={24} />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Membership
            </span>
            <h3 className="font-display font-bold text-base sm:text-lg text-foreground mt-0.5">
              No Active Service Plan
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md leading-relaxed">
              Subscribe to a Daily Cleaning, Full Wash, or Detailing plan for hassle-free doorstep care.
            </p>
          </div>
        </div>
        <Link
          href={CUSTOMER_ROUTES.plans}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs hover:bg-[#1264db] transition-all shrink-0 min-h-11 w-full sm:w-auto cursor-pointer"
          data-testid="home-explore-plans-cta"
        >
          View Plans <ArrowRight size={14} />
        </Link>
      </div>
    );
  }

  const hasVisitsCount = plan.totalAllocated > 0;
  const usagePercent = hasVisitsCount
    ? Math.min(100, Math.max(0, Math.round((plan.totalUsed / plan.totalAllocated) * 100)))
    : 0;

  return (
    <div
      className="customer-navy-card p-5 sm:p-6 relative overflow-hidden text-white flex flex-col justify-between"
      data-testid="home-active-membership"
    >
      {/* Decorative ambient subtle circle */}
      <div
        className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"
        aria-hidden
      />

      {/* Top row: Plan badge & Status */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/10 text-blue-200 border border-white/15">
              <Sparkles size={11} className="text-blue-300" />
              Active Membership
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
              <CheckCircle2 size={12} />
              {plan.displayStatus}
            </span>
          </div>
          <h3 className="font-display font-bold text-lg sm:text-xl text-white mt-1.5 line-clamp-2 tracking-tight leading-snug">
            {plan.name}
          </h3>
          {plan.vehicleOrSite && (
            <div className="flex items-center gap-1.5 text-xs text-slate-300 mt-1">
              <Car size={13} className="text-blue-400 shrink-0" />
              <span className="truncate">{plan.vehicleOrSite}</span>
            </div>
          )}
        </div>

        <Link
          href={plan.detailHref}
          className="shrink-0 text-xs font-semibold text-white inline-flex items-center gap-1 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition-colors cursor-pointer"
          data-testid="home-view-plan-details"
        >
          Details <ArrowRight size={13} />
        </Link>
      </div>

      {/* Middle row: Usage progress & counts */}
      <div className="mt-5 pt-4 border-t border-white/10 relative z-10">
        {hasVisitsCount ? (
          <div>
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <div>
                <span className="font-display font-bold text-2xl sm:text-3xl text-white tabular-nums">
                  {plan.totalRemaining}
                </span>
                <span className="text-xs font-medium text-slate-300 ml-1.5">
                  Visits Remaining
                </span>
              </div>
              <span className="text-xs font-medium text-slate-300 tabular-nums">
                {plan.totalUsed} Used · {plan.totalAllocated} Total
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div
              className="h-2 w-full rounded-full bg-white/15 overflow-hidden"
              role="progressbar"
              aria-valuenow={plan.totalUsed}
              aria-valuemin={0}
              aria-valuemax={plan.totalAllocated}
              aria-label="Plan visit usage progress"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-[#1677FF] transition-all duration-500 ease-out"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>
              {plan.totalRemaining > 0
                ? `${plan.totalRemaining} Services Remaining`
                : "Continuous Managed Care by CWP"}
            </span>
            {plan.nextVisitDate && (
              <span>Next Service: {plan.nextVisitDate}</span>
            )}
          </div>
        )}

        {/* Footer info & CTA */}
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 text-xs text-slate-300">
          <div>
            {plan.expiryDate ? (
              <span>Valid till <span className="text-white font-medium">{plan.expiryDate}</span></span>
            ) : plan.nextVisitDate ? (
              <span>Next scheduled: <span className="text-white font-medium">{plan.nextVisitDate}</span></span>
            ) : (
              <span>Daily doorstep maintenance</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={CUSTOMER_ROUTES.plans}
              className="text-xs text-blue-300 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
            >
              All Plans
            </Link>
            {!plan.isDailyCleaning && (
              <Link
                href={CUSTOMER_ROUTES.scheduleEntry({ planId: plan.id, from: "home" })}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1677FF] hover:bg-[#1264db] text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Schedule Visit
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ActiveMembershipCard;
