import { memo } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CustomerSkeleton } from "@/features/customer-ds";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { ArrowRight } from "lucide-react";
import type { AccountSummaryMetrics } from "./useAccountSummary";

type Props = {
  metrics: AccountSummaryMetrics;
  className?: string;
};

function SummaryCell({
  label,
  value,
  emphasize,
  testId,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  testId: string;
}) {
  return (
    <div className="min-w-0 p-3 rounded-xl bg-slate-50/70 border border-slate-100" data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-display text-base font-bold leading-tight tabular-nums text-foreground sm:text-lg",
          emphasize && "text-amber-600",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export const AccountSummary = memo(function AccountSummary({ metrics, className }: Props) {
  const { activePlan, vehicleCount, nextWash, outstanding, outstandingAmount, loading } = metrics;

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(11,29,54,0.04)] space-y-3.5",
        className,
      )}
      data-testid="account-summary"
      aria-label="Account overview"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
          Account Overview
        </h2>
        <Link
          href={CUSTOMER_ROUTES.plans}
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
        >
          My Plans <ArrowRight size={12} />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          <CustomerSkeleton className="h-14 w-full rounded-xl" />
          <CustomerSkeleton className="h-14 w-full rounded-xl" />
          <CustomerSkeleton className="h-14 w-full rounded-xl" />
          <CustomerSkeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCell label="Primary Plan" value={activePlan} testId="account-summary-plan" />
          <SummaryCell
            label="Vehicles & Sites"
            value={String(vehicleCount)}
            testId="account-summary-vehicles"
          />
          <SummaryCell label="Next Scheduled" value={nextWash} testId="account-summary-next-wash" />
          <SummaryCell
            label="Outstanding"
            value={outstanding}
            emphasize={outstandingAmount > 0}
            testId="account-summary-balance"
          />
        </div>
      )}
    </section>
  );
});

export default AccountSummary;
