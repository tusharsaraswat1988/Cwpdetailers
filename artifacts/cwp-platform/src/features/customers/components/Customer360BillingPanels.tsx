import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FileDown, FileText, PlusCircle, Receipt } from "lucide-react";
import { Link } from "wouter";
import { fetchCustomerSubscriptions, fetchCustomerInvoices } from "../api";
import { InvoicePdfButton } from "@/features/billing/components/InvoicePdfButton";

type Props = {
  customerId: number;
  basePath?: string;
  showActions?: boolean;
};

export function Customer360BillingPanels({ customerId, basePath = "/admin/customers", showActions = true }: Props) {
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

  const totalDue = (invs?.data ?? []).reduce(
    (sum, inv) => sum + Number((inv as { balanceDue?: string | number }).balanceDue ?? inv.totalAmount ?? 0),
    0,
  );

  return (
    <div className="space-y-4" data-testid="customer-360-billing-panels">
      {showActions && basePath.startsWith("/admin") && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/billing?customerId=${customerId}&action=create`}>
            <Button variant="outline" size="sm" data-testid="btn-customer-create-invoice">
              <FileText size={14} className="mr-1.5" />Create invoice
            </Button>
          </Link>
          <Link href={`/admin/billing?customerId=${customerId}&action=pay`}>
            <Button variant="outline" size="sm" data-testid="btn-customer-record-payment">
              <PlusCircle size={14} className="mr-1.5" />Record payment
            </Button>
          </Link>
          {totalDue > 0 && (
            <Link href={`/admin/dues`}>
              <Badge variant="outline" className="text-destructive border-destructive/30 h-8 px-3">
                ₹{totalDue.toLocaleString("en-IN")} outstanding
              </Badge>
            </Link>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={16} className="text-primary" /> Invoices
            </CardTitle>
            {showActions && basePath.startsWith("/admin") && (
              <Link href={`/admin/billing?customerId=${customerId}`} className="text-xs text-primary hover:underline">
                View all
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {invsLoading ? <Skeleton className="h-16" /> : (invs?.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No invoices yet — created automatically on package purchase, plan signup, wallet recharge, and completed one-time jobs.</p>
            ) : (
              (invs?.data ?? []).map(inv => {
                const balance = Number((inv as { balanceDue?: string | number }).balanceDue ?? 0);
                return (
                  <div key={inv.id} className="text-sm border border-border rounded-lg px-3 py-2 flex justify-between gap-2 items-center">
                    <div>
                      <p className="font-medium">{inv.invoiceNumber ?? `INV-${inv.id}`}</p>
                      <p className="text-xs text-muted-foreground">
                        ₹{Number(inv.totalAmount ?? 0).toLocaleString("en-IN")}
                        {balance > 0 && (
                          <span className="text-destructive ml-2">Due ₹{balance.toLocaleString("en-IN")}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-xs capitalize h-6">{inv.status}</Badge>
                      <InvoicePdfButton
                        invoiceId={inv.id!}
                        invoiceNumber={inv.invoiceNumber}
                        className="text-primary hover:underline disabled:opacity-50"
                        title="Download PDF"
                      >
                        <FileDown size={14} />
                      </InvoicePdfButton>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
