import { useGetCustomerSummary, getGetCustomerSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, IndianRupee, Wallet, Car, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Customer360BillingPanels } from "./Customer360BillingPanels";

type Props = {
  customerId: number;
  basePath: string;
  customer?: {
    gstin?: string | null;
    billingName?: string | null;
    status?: string;
    customerSince?: string | null;
    historicalWashCount?: number | null;
  };
};

export function Customer360Overview({ customerId, basePath, customer }: Props) {
  const { data: summary, isLoading } = useGetCustomerSummary(customerId, {
    query: { queryKey: getGetCustomerSummaryQueryKey(customerId), enabled: customerId > 0 },
  });

  if (isLoading) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const kpis = [
    { label: "Wallet balance", value: `₹${(summary?.walletBalance ?? 0).toLocaleString("en-IN")}`, icon: Wallet },
    { label: "Pending dues", value: `₹${(summary?.pendingDues ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee },
    { label: "Active subscriptions", value: String(summary?.activeSubscriptions ?? 0), icon: Car },
    { label: "Services this month", value: String(summary?.totalServicesThisMonth ?? 0), icon: Calendar },
  ];

  return (
    <div className="space-y-4" data-testid="customer-360-overview">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <k.icon size={14} className="text-primary" />{k.label}
              </div>
              <p className="text-xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(customer?.gstin || customer?.billingName) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">B2B billing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {customer.billingName && <p><span className="text-muted-foreground">Billing name:</span> {customer.billingName}</p>}
            {customer.gstin && <p><span className="text-muted-foreground">GSTIN:</span> <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{customer.gstin}</code></p>}
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.recentBookings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent bookings</p>
            ) : (
              (summary?.recentBookings ?? []).map((b: { id: number; serviceType?: string; scheduledDate?: string; status?: string }) => (
                <div key={b.id} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium capitalize">{b.serviceType?.replace(/_/g, " ") ?? "Service"}</p>
                    <p className="text-xs text-muted-foreground">{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString("en-IN") : "—"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{b.status ?? "—"}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.recentPayments ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent payments</p>
            ) : (
              (summary?.recentPayments ?? []).map((p: { id: number; amount?: number; paymentMode?: string; createdAt?: string }) => (
                <div key={p.id} className="flex items-center justify-between text-sm border border-border rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium">₹{(p.amount ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground capitalize">{p.paymentMode ?? "—"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-IN") : "—"}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-3 text-sm">
          <span className="text-muted-foreground">Total lifetime spend:</span>
          <span className="font-semibold">₹{(summary?.totalSpend ?? 0).toLocaleString("en-IN")}</span>
          {customer?.customerSince && (
            <>
              <span className="text-muted-foreground">· Customer since</span>
              <span>{new Date(customer.customerSince).toLocaleDateString("en-IN")}</span>
            </>
          )}
          {(customer?.historicalWashCount ?? 0) > 0 && (
            <span className="text-muted-foreground">· {customer?.historicalWashCount} legacy washes</span>
          )}
          <Link href={`${basePath}/${customerId}?tab=support`} className="inline-flex items-center gap-1 text-primary hover:underline ml-auto">
            <AlertCircle size={14} /> View support tickets
          </Link>
          {basePath.startsWith("/admin") && (
            <Link href={`/admin/bookings?customerId=${customerId}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Calendar size={14} /> All bookings
            </Link>
          )}
        </CardContent>
      </Card>

      <Customer360BillingPanels customerId={customerId} />
    </div>
  );
}
