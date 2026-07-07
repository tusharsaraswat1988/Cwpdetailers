import { useListInvoices, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { FileText, Download, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { InvoicePdfButton } from "@/features/billing/components/InvoicePdfButton";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";

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
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      ) : missingCustomerLink || customerId == null ? (
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <NoCustomerProfileMessage />
        </div>
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="font-display font-bold text-2xl">Invoices</h1>
            {totalDue > 0 && (
              <div className="mt-2 flex items-center gap-2 bg-destructive/10 text-destructive text-sm px-3 py-2 rounded-xl border border-destructive/20 w-fit">
                <AlertCircle size={14} />
                Total due: ₹{totalDue.toLocaleString("en-IN")}
              </div>
            )}
          </div>

          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
          ) : (data?.data ?? []).length === 0 ? (
            // QW-04 / QW-12: EmptyState
            <EmptyState
              icon={<FileText size={20} />}
              title="No invoices yet"
              description="Invoices for your services will appear here"
              action={
                <Link href="/customer/bookings">
                  <Button size="sm" variant="outline">Book a Service</Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-3">
              {(data?.data ?? []).map(inv => (
                // QW-12: Card styling (already had bg-card, keeping, adding border accent for overdue)
                <div key={inv.id}
                  className={`bg-card border rounded-xl p-4 ${Number(inv.dueAmount) > 0 ? "border-destructive/30" : "border-border"}`}
                  data-testid={`invoice-${inv.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={14} className="text-primary" />
                      </div>
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                        <p className="font-semibold text-sm mt-0.5">
                          ₹{Number(inv.totalAmount).toLocaleString("en-IN")}
                          <span className="text-xs font-normal text-muted-foreground ml-1">(GST incl.)</span>
                        </p>
                        <p className="text-xs text-muted-foreground">{new Date(inv.createdAt!).toLocaleDateString("en-IN")}</p>
                        <InvoicePdfButton
                          invoiceId={inv.id!}
                          invoiceNumber={inv.invoiceNumber}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5 disabled:opacity-50"
                          data-testid={`invoice-pdf-${inv.id}`}
                        >
                          <Download size={12} /> Download PDF
                        </InvoicePdfButton>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {/* QW-12: StatusBadge */}
                      <StatusBadge status={inv.status ?? "draft"} />
                      {Number(inv.dueAmount) > 0 && (
                        <p className="text-xs text-destructive font-medium">₹{Number(inv.dueAmount).toLocaleString("en-IN")} due</p>
                      )}
                      {inv.dueDate && <p className="text-xs text-muted-foreground">Due: {inv.dueDate}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CustomerLayout>
  );
}
