import { memo } from "react";
import { cn } from "@/lib/utils";
import { CustomerSkeleton } from "@/features/customer-ds";
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
    <div className="min-w-0" data-testid={testId}>
      <p className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate font-display text-base font-semibold leading-tight tabular-nums text-foreground sm:text-lg",
          emphasize && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/** Compact hub summary — typography grid, no metric cards. */
export const AccountSummary = memo(function AccountSummary({ metrics, className }: Props) {
  const { activePlan, vehicleCount, nextWash, outstanding, outstandingAmount, loading } = metrics;

  return (
    <section
      className={cn(
        "rounded-[var(--customer-radius-lg,1.25rem)] px-4 py-4",
        "bg-[color-mix(in_srgb,var(--customer-surface-tint)_55%,hsl(var(--card)))]",
        className,
      )}
      data-testid="account-summary"
      aria-label="Membership summary"
    >
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Membership Summary
      </h2>
      {loading ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <CustomerSkeleton className="h-10 w-full" />
          <CustomerSkeleton className="h-10 w-full" />
          <CustomerSkeleton className="h-10 w-full" />
          <CustomerSkeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <SummaryCell label="Active Plan" value={activePlan} testId="account-summary-plan" />
          <SummaryCell
            label="Registered Vehicles"
            value={String(vehicleCount)}
            testId="account-summary-vehicles"
          />
          <SummaryCell label="Next Wash" value={nextWash} testId="account-summary-next-wash" />
          <SummaryCell
            label="Outstanding Balance"
            value={outstanding}
            emphasize={outstandingAmount > 0}
            testId="account-summary-balance"
          />
        </div>
      )}
    </section>
  );
});
