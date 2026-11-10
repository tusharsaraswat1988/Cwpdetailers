import { memo } from "react";
import { Link } from "wouter";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { CheckCircle2, AlertCircle, ArrowRight, Receipt } from "lucide-react";
import { AccountSection } from "./AccountSection";

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
    <AccountSection title="Billing & Outstanding Balance" testId="account-billing-section">
      <div className="p-4 sm:p-5 space-y-3">
        {hasOutstanding && display ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-300 bg-amber-50/70" data-testid="account-billing-pay">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                    Payment Status:
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    Payment Due
                  </span>
                </div>
                <p className="font-display text-2xl font-bold tabular-nums text-foreground mt-0.5">
                  {display}
                </p>
                <p className="text-xs text-muted-foreground">Outstanding balance across all services</p>
              </div>
            </div>

            <Link
              href={CUSTOMER_ROUTES.invoices}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs min-h-11 transition-colors shrink-0 cursor-pointer"
            >
              Pay Now <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50" data-testid="account-billing-clear">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-800">
                  Payment Status: All Paid Up
                </span>
                <p className="font-display text-lg font-bold text-foreground">₹0 Outstanding</p>
                <p className="text-xs text-muted-foreground">No pending dues on your account</p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-1 flex items-center justify-between">
          <Link
            href={CUSTOMER_ROUTES.invoices}
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
          >
            <Receipt size={14} /> View All Invoices & Receipts
          </Link>
        </div>
      </div>
    </AccountSection>
  );
});

export default BillingSection;
