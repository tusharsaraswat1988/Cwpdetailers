import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, IndianRupee, Wallet } from "lucide-react";
import { Link } from "wouter";
import { fetchCustomerBillingSummary } from "../api";

type Props = {
  customerId: number;
};

function formatMoney(n: number) {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN");
}

export function BillingSummaryPanel({ customerId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["customer", customerId, "billing-summary"],
    queryFn: () => fetchCustomerBillingSummary(customerId),
    enabled: customerId > 0,
  });

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <div className="space-y-4" data-testid="billing-summary-panel">
      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <IndianRupee size={14} className="text-primary" /> Outstanding due
            </p>
            <p className={`text-xl font-bold ${(data?.outstandingDue ?? 0) > 0 ? "text-destructive" : ""}`}>
              {formatMoney(data?.outstandingDue ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
              <Wallet size={14} className="text-primary" /> Wallet balance
            </p>
            <p className="text-xl font-bold">{formatMoney(data?.walletBalance ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">Money balance only — not washes left on packages</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent billing</CardTitle>
          <Link href={`/admin/billing?customerId=${customerId}`}>
            <Button variant="outline" size="sm" data-testid="btn-open-billing">
              <ExternalLink size={14} className="mr-1.5" />Open Billing
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="border border-border rounded-lg px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">Last invoice</p>
            {data?.lastInvoice ? (
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    <FileText size={14} className="text-primary" />
                    {data.lastInvoice.invoiceNumber}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(data.lastInvoice.totalAmount)}
                    {data.lastInvoice.balanceDue > 0 && (
                      <span className="text-destructive ml-2">Due {formatMoney(data.lastInvoice.balanceDue)}</span>
                    )}
                    {" · "}{formatDate(data.lastInvoice.issuedAt)}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">{data.lastInvoice.status}</Badge>
              </div>
            ) : (
              <p className="text-muted-foreground">No invoices yet</p>
            )}
          </div>

          <div className="border border-border rounded-lg px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1">Last payment</p>
            {data?.lastPayment ? (
              <div>
                <p className="font-medium">{formatMoney(data.lastPayment.amount)}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {data.lastPayment.method.replace(/_/g, " ")} · {formatDate(data.lastPayment.receivedAt)}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">No payments recorded</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Create invoices, record payments, and manage dues in Billing &amp; Finance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
