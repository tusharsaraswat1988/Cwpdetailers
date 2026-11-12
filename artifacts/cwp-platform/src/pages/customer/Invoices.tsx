import { useState } from "react";
import {
  useListInvoices,
  getListInvoicesQueryKey,
  getGetCustomerSummaryQueryKey,
  getGetCustomerQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { FileText, Download, AlertCircle, ArrowRight } from "lucide-react";
import { InvoicePdfButton } from "@/features/billing/components/InvoicePdfButton";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { CustomerPaymentReviewDialog } from "@/components/payment/CustomerPaymentReviewDialog";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerErrorState,
  CustomerSkeleton,
  CustomerButton,
  CustomerInvoiceCard,
} from "@/features/customer-ds";

export default function CustomerInvoices() {
  const qc = useQueryClient();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const [selectedInvoice, setSelectedInvoice] = useState<{ id: number; amount: number } | null>(null);
  const { data, isLoading, isError, refetch } = useListInvoices(
    { customerId: String(customerId ?? "") } as any,
    {
      query: {
        queryKey: getListInvoicesQueryKey({ customerId: String(customerId ?? "") } as any),
        enabled: customerId != null,
      },
    },
  );

  const totalDue = (data?.data ?? []).reduce((s, inv) => {
    if (inv.status === "paid" || inv.status === "cancelled") return s;
    const due = Number((inv as any).balanceDue ?? inv.dueAmount ?? 0);
    return s + (due > 0 ? due : 0);
  }, 0);

  return (
    <CustomerLayout>
      {scopeLoading ? (
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-28" />
          <CustomerSkeleton className="h-28" />
        </CustomerPage>
      ) : missingCustomerLink || customerId == null ? (
        <CustomerPage>
          <CustomerEmptyState
            title="Account not linked"
            description="Your login is not linked to a customer profile yet."
            action={<NoCustomerProfileMessage />}
            hint=""
          />
        </CustomerPage>
      ) : (
        <CustomerPage>
          <CustomerHeader
            title="Invoices"
            subtitle={totalDue > 0 ? undefined : "Bills & payments"}
            actions={
              totalDue > 0 ? (
                <div className="flex items-center gap-2 rounded-[var(--customer-radius-sm)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle size={14} aria-hidden />
                  Due ₹{totalDue.toLocaleString("en-IN")}
                </div>
              ) : undefined
            }
          />

          {isError ? (
            <CustomerErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <CustomerSkeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            <CustomerEmptyState
              icon={<FileText size={20} />}
              title="No invoices yet"
              description="Invoices for your services will appear here"
              action={
                <CustomerButton href={CUSTOMER_ROUTES.schedule} variant="outline">
                  Schedule a Service
                </CustomerButton>
              }
            />
          ) : (
            <div className="space-y-3">
              {(data?.data ?? []).map(inv => {
                const isPaidOrCancelled = inv.status === "paid" || inv.status === "cancelled";
                const rawDue = Number((inv as any).balanceDue ?? inv.dueAmount ?? 0);
                const effectiveDue = isPaidOrCancelled ? 0 : Math.max(0, rawDue);
                return (
                <div key={inv.id} data-testid={`invoice-${inv.id}`}>
                  <CustomerInvoiceCard
                    invoiceNumber={inv.invoiceNumber}
                    amount={`₹${Number(inv.totalAmount).toLocaleString("en-IN")}`}
                    date={inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN") : undefined}
                    status={inv.status ?? "draft"}
                    dueAmount={effectiveDue}
                    downloadSlot={
                      <div className="mt-1.5 space-y-1">
                        <InvoicePdfButton
                          invoiceId={inv.id!}
                          invoiceNumber={inv.invoiceNumber}
                          className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
                          data-testid={`invoice-pdf-${inv.id}`}
                        >
                          <Download size={12} /> Download PDF
                        </InvoicePdfButton>
                        {effectiveDue > 0 && !isPaidOrCancelled && (
                          <div className="flex items-center gap-2.5 pt-1">
                            <p className="text-xs font-semibold text-destructive">
                              ₹{effectiveDue.toLocaleString("en-IN")} due
                              {inv.dueDate ? ` · Due ${inv.dueDate}` : ""}
                            </p>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoice({ id: inv.id!, amount: effectiveDue })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-[11px] font-semibold transition-colors cursor-pointer shadow-2xs"
                              data-testid={`pay-invoice-${inv.id}`}
                            >
                              Pay Now <ArrowRight size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    }
                  />
                </div>
              );})}
            </div>
          )}
        </CustomerPage>
      )}

      {/* Cashfree Payment Review Dialog */}
      <CustomerPaymentReviewDialog
        open={selectedInvoice !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedInvoice(null);
        }}
        customerId={customerId ?? undefined}
        invoiceId={selectedInvoice?.id}
        outstandingAmount={selectedInvoice?.amount}
        payableAmount={selectedInvoice?.amount}
        onPaymentSuccess={() => {
          refetch();
          if (customerId) {
            qc.invalidateQueries({ queryKey: getGetCustomerSummaryQueryKey(customerId) });
            qc.invalidateQueries({ queryKey: getGetCustomerQueryKey(customerId) });
          }
          setSelectedInvoice(null);
        }}
      />
    </CustomerLayout>
  );
}
