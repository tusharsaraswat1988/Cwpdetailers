import { useListInvoices, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { FileText, Download, AlertCircle } from "lucide-react";
import { InvoicePdfButton } from "@/features/billing/components/InvoicePdfButton";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
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
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const { data, isLoading, isError, refetch } = useListInvoices(
    { customerId: String(customerId ?? "") } as any,
    {
      query: {
        queryKey: getListInvoicesQueryKey({ customerId: String(customerId ?? "") } as any),
        enabled: customerId != null,
      },
    },
  );

  const totalDue = (data?.data ?? []).reduce((s, inv) => s + Number(inv.dueAmount), 0);

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
              {(data?.data ?? []).map(inv => (
                <div key={inv.id} data-testid={`invoice-${inv.id}`}>
                  <CustomerInvoiceCard
                    invoiceNumber={inv.invoiceNumber}
                    amount={`₹${Number(inv.totalAmount).toLocaleString("en-IN")}`}
                    date={inv.createdAt ? new Date(inv.createdAt).toLocaleDateString("en-IN") : undefined}
                    status={inv.status ?? "draft"}
                    dueAmount={Number(inv.dueAmount)}
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
                        {Number(inv.dueAmount) > 0 && (
                          <p className="text-xs font-medium text-destructive">
                            ₹{Number(inv.dueAmount).toLocaleString("en-IN")} due
                            {inv.dueDate ? ` · Due ${inv.dueDate}` : ""}
                          </p>
                        )}
                      </div>
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CustomerPage>
      )}
    </CustomerLayout>
  );
}
