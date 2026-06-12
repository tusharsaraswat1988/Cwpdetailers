import { useListInvoices, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";

const statusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-600 border-green-500/20",
  sent: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  draft: "bg-muted text-muted-foreground border-muted",
};

export default function CustomerInvoices() {
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();
  const { data, isLoading } = useListInvoices({ customerId: String(customerId ?? "") } as any, {
    query: {
      queryKey: getListInvoicesQueryKey({ customerId: String(customerId ?? "") } as any),
      enabled: customerId != null,
    }
  });

  const totalDue = (data?.data ?? []).reduce((s, inv) => s + Number(inv.dueAmount), 0);

  return (
    <CustomerLayout>
      {scopeLoading ? (
        <div className="p-6"><Skeleton className="h-8 w-48" /></div>
      ) : missingCustomerLink || customerId == null ? (
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile. Contact CWP support.</p>
        </div>
      ) : (
      <div className="space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Invoices</h1>
          {totalDue > 0 && (
            <div className="mt-2 inline-flex items-center gap-2 bg-destructive/10 text-destructive text-sm px-3 py-1.5 rounded-lg">
              Total due: ₹{totalDue.toLocaleString("en-IN")}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />) :
            (data?.data ?? []).map(inv => (
              <div key={inv.id} className="bg-card border border-border rounded-xl p-4" data-testid={`invoice-${inv.id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{inv.invoiceNumber}</p>
                      <p className="font-semibold text-sm mt-0.5">₹{Number(inv.totalAmount).toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.createdAt!).toLocaleDateString("en-IN")}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-xs ${statusColors[inv.status ?? "draft"]}`}>{inv.status}</Badge>
                    {Number(inv.dueAmount) > 0 && (
                      <p className="text-xs text-destructive font-medium mt-1">₹{Number(inv.dueAmount).toLocaleString("en-IN")} due</p>
                    )}
                    {inv.dueDate && <p className="text-xs text-muted-foreground mt-0.5">Due: {inv.dueDate}</p>}
                  </div>
                </div>
              </div>
            ))}
          {!isLoading && (data?.data ?? []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">No invoices yet</div>
          )}
        </div>
      </div>
      )}
    </CustomerLayout>
  );
}
