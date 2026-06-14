import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Receipt } from "lucide-react";
import { fetchCustomerSubscriptions, fetchCustomerInvoices } from "../api";

type Props = { customerId: number };

export function Customer360BillingPanels({ customerId }: Props) {
  const { data: subs, isLoading: subsLoading } = useQuery({
    queryKey: ["customer-360-subs", customerId],
    queryFn: () => fetchCustomerSubscriptions(customerId),
    enabled: customerId > 0,
  });
  const { data: invs, isLoading: invsLoading } = useQuery({
    queryKey: ["customer-360-invoices", customerId],
    queryFn: () => fetchCustomerInvoices(customerId),
    enabled: customerId > 0,
  });

  return (
    <div className="grid md:grid-cols-2 gap-4" data-testid="customer-360-billing-panels">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt size={16} className="text-primary" /> Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {subsLoading ? <Skeleton className="h-16" /> : (subs?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No subscriptions</p>
          ) : (
            (subs?.data ?? []).map(s => (
              <div key={s.id} className="text-sm border border-border rounded-lg px-3 py-2 flex justify-between gap-2">
                <div>
                  <p className="font-medium capitalize">{s.type?.replace(/_/g, " ") ?? "Subscription"}</p>
                  <p className="text-xs text-muted-foreground">{s.startDate} → {s.endDate}</p>
                </div>
                <Badge variant="outline" className="text-xs capitalize h-6">{s.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText size={16} className="text-primary" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {invsLoading ? <Skeleton className="h-16" /> : (invs?.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices</p>
          ) : (
            (invs?.data ?? []).map(inv => (
              <div key={inv.id} className="text-sm border border-border rounded-lg px-3 py-2 flex justify-between gap-2">
                <div>
                  <p className="font-medium">{inv.invoiceNumber ?? `INV-${inv.id}`}</p>
                  <p className="text-xs text-muted-foreground">
                    ₹{Number(inv.totalAmount ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize h-6">{inv.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
