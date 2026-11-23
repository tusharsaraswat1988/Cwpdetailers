import { useListPayments, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { useAppStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowRight, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/lib/design-system/EmptyState";

type Props = {
  customerId?: string;
};

export function PaymentsTab({ customerId }: Props) {
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const paymentQueryParams = {
    ...(customerId ? { customerId } : {}),
    ...(activeBranchId ? { branchId: activeBranchId } : {}),
  };
  const { data: payments, isLoading } = useListPayments(paymentQueryParams as any, {
    query: { queryKey: getListPaymentsQueryKey(paymentQueryParams as any) },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-800/40 text-xs">
        <div className="flex items-center gap-2 text-blue-950 dark:text-blue-100">
          <Receipt size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            Looking for real-time gateway reconciliations, summary cards, and search? Visit the dedicated <strong>Payment Ledger</strong>.
          </span>
        </div>
        <Link href="/admin/payments/ledger">
          <Button variant="outline" size="sm" className="h-7 text-xs bg-white text-blue-700 border-blue-300 hover:bg-blue-50">
            Open Ledger <ArrowRight size={12} className="ml-1" />
          </Button>
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Method</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Transaction ID</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
            ))
            : (payments?.data ?? []).map(p => (
              <tr key={p.id} className="hover:bg-muted/20" data-testid={`payment-row-${p.id}`}>
                <td className="px-4 py-3 font-medium">{p.customerName}</td>
                <td className="px-4 py-3 text-right font-semibold text-primary font-mono tabular-nums">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-xs">
                  {p.method?.toLowerCase() === "cashfree" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs">
                      Cashfree
                    </span>
                  ) : (
                    <span className="uppercase text-muted-foreground">{p.method}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.invoiceId ? `#${p.invoiceId}` : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.transactionId ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.createdAt!).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {!isLoading && (payments?.data ?? []).length === 0 && (
        <EmptyState
          icon="payments"
          title="No payments recorded"
          description="Customer receipts and online gateway transactions will appear here."
        />
      )}
      </div>
    </div>
  );
}
