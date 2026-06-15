import { useGetCustomerSummary, getGetCustomerSummaryQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Calendar, IndianRupee, Wallet, Sparkles } from "lucide-react";
import { ActiveServicesSummary } from "./ActiveServicesSummary";
import { CustomerComplaintsPanel } from "./CustomerComplaintsPanel";

type Props = {
  customerId: number;
  basePath: string;
  customer?: {
    name?: string;
    phone?: string;
    city?: string | null;
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
    { label: "Outstanding amount", value: `₹${(summary?.pendingDues ?? 0).toLocaleString("en-IN")}`, icon: IndianRupee },
    { label: "Wallet balance", value: `₹${(summary?.walletBalance ?? 0).toLocaleString("en-IN")}`, icon: Wallet },
    { label: "Active plans", value: String((summary as { activeContracts?: number })?.activeContracts ?? summary?.activeSubscriptions ?? 0), icon: Sparkles },
    { label: "Jobs this month", value: String(summary?.totalServicesThisMonth ?? 0), icon: Calendar },
  ];

  return (
    <div className="space-y-5" data-testid="customer-command-center">
      {customer && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="font-semibold text-lg">{customer.name}</p>
            <p className="text-sm text-muted-foreground">{customer.phone}{customer.city ? ` · ${customer.city}` : ""}</p>
            {customer.status && (
              <Badge variant="outline" className="mt-2 text-xs capitalize">{customer.status}</Badge>
            )}
          </CardContent>
        </Card>
      )}

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

      <ActiveServicesSummary customerId={customerId} basePath={basePath} />

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.recentBookings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent jobs</p>
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

      {(summary?.totalSpend ?? 0) > 0 && (
        <p className="text-sm text-muted-foreground">
          Lifetime spend: <span className="font-semibold text-foreground">₹{(summary?.totalSpend ?? 0).toLocaleString("en-IN")}</span>
          {customer?.customerSince && (
            <> · Customer since {new Date(customer.customerSince).toLocaleDateString("en-IN")}</>
          )}
        </p>
      )}

      <CustomerComplaintsPanel customerId={customerId} />
    </div>
  );
}
