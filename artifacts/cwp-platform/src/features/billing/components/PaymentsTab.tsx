import { useListPayments, getListPaymentsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  customerId?: string;
};

export function PaymentsTab({ customerId }: Props) {
  const paymentQueryParams = customerId ? { customerId } : {};
  const { data: payments, isLoading } = useListPayments(paymentQueryParams as any, {
    query: { queryKey: getListPaymentsQueryKey(paymentQueryParams as any) },
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            {["Customer", "Amount", "Method", "Invoice", "Transaction ID", "Date"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
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
                <td className="px-4 py-3 font-semibold text-primary">₹{Number(p.amount).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 uppercase text-xs text-muted-foreground">{p.method}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{p.invoiceId ? `#${p.invoiceId}` : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.transactionId ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(p.createdAt!).toLocaleDateString("en-IN")}</td>
              </tr>
            ))}
        </tbody>
      </table>
      {!isLoading && (payments?.data ?? []).length === 0 && (
        <div className="text-center py-12 text-muted-foreground">No payments found</div>
      )}
    </div>
  );
}
