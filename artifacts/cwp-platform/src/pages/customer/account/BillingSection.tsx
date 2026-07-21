import { memo } from "react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { AccountSection, AccountTextAction } from "./AccountSection";

type Props = {
  totalDues?: string | null;
};

export const BillingSection = memo(function BillingSection({ totalDues }: Props) {
  const amount = totalDues != null ? parseFloat(totalDues) : 0;
  const hasOutstanding = Number.isFinite(amount) && amount > 0;
  const display = hasOutstanding
    ? `₹${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`
    : null;

  return (
    <AccountSection title="Billing" testId="account-billing-section">
      {hasOutstanding && display ? (
        <Link
          href={CUSTOMER_ROUTES.invoices}
          className="flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left customer-transition hover:bg-foreground/[0.03] active:bg-foreground/[0.05]"
          data-testid="account-billing-pay"
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
              {display}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Outstanding balance</p>
          </div>
          <AccountTextAction className="text-sm font-medium">Pay Now</AccountTextAction>
        </Link>
      ) : (
        <div className="flex min-h-11 items-center px-4 py-2.5" data-testid="account-billing-clear">
          <div>
            <p className="font-display text-lg font-semibold tabular-nums text-foreground">₹0</p>
            <p className="mt-0.5 text-xs text-muted-foreground">No outstanding balance</p>
          </div>
        </div>
      )}
    </AccountSection>
  );
});
