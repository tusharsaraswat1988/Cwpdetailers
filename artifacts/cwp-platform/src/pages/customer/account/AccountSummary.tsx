import { memo } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { CustomerSkeleton } from "@/features/customer-ds";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import type { AccountSummaryMetrics } from "./useAccountSummary";

type Props = {
  metrics: AccountSummaryMetrics;
  className?: string;
};

function SummaryCell({
  icon,
  label,
  value,
  emphasize,
  testId,
}: {
  icon: string;
  label: string;
  value: string;
  emphasize?: boolean;
  testId: string;
}) {
  return (
    <div className="min-w-0 p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex items-start gap-2.5" data-testid={testId}>
      <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center shrink-0 text-primary mt-0.5 shadow-2xs">
        <MaterialSymbol name={icon} size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate font-display text-sm sm:text-base font-bold leading-tight tabular-nums text-foreground",
            emphasize && "text-emerald-600",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

export const AccountSummary = memo(function AccountSummary({ metrics, className }: Props) {
  const { activePlan, vehicleCount, nextWash, accountStatus, loading } = metrics;

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
        <div className="flex items-center gap-1.5">
          <MaterialSymbol name="analytics" size={16} className="text-primary" />
          <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Account Overview
          </h2>
        </div>
        <Link
          href={CUSTOMER_ROUTES.plans}
          className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5 cursor-pointer"
        >
          My Plans <MaterialSymbol name="arrow_forward" size={13} />
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
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <SummaryCell icon="assignment" label="Primary Plan" value={activePlan} testId="account-summary-plan" />
          <SummaryCell
            icon="directions_car"
            label="Vehicles & Sites"
            value={String(vehicleCount)}
            testId="account-summary-vehicles"
          />
          <SummaryCell icon="calendar_today" label="Next Scheduled" value={nextWash} testId="account-summary-next-wash" />
          <SummaryCell
            icon="verified"
            label="Account Status"
            value={accountStatus || "Active"}
            emphasize={true}
            testId="account-summary-status"
          />
        </div>
      )}
    </section>
  );
});

export default AccountSummary;
