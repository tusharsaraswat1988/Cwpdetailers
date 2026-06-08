import { useListSubscriptions, getListSubscriptionsQueryKey, useGetExpiringSoonSubscriptions, getGetExpiringSoonSubscriptionsQueryKey, useUpdateSubscription } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Calendar } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  expired: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export default function AdminSubscriptions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useListSubscriptions({}, { query: { queryKey: getListSubscriptionsQueryKey({}) } });
  const { data: expiring } = useGetExpiringSoonSubscriptions({ query: { queryKey: getGetExpiringSoonSubscriptionsQueryKey() } });

  const updateMutation = useUpdateSubscription({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() });
        toast({ title: "Subscription updated" });
      },
    },
  });

  const SubTable = ({ items }: { items: NonNullable<typeof data>["data"] | undefined }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            {["Customer", "Type", "Status", "Period", "Price", "Due", "Action"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(items ?? []).map(s => (
            <tr key={s.id} className="hover:bg-muted/20" data-testid={`sub-row-${s.id}`}>
              <td className="px-4 py-3 font-medium">{s.customerName}</td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{s.type?.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={`text-xs capitalize ${statusColors[s.status ?? "active"]}`}>{s.status}</Badge>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {s.startDate} → {s.endDate}
              </td>
              <td className="px-4 py-3 font-medium">₹{Number(s.price).toLocaleString("en-IN")}</td>
              <td className="px-4 py-3">
                {Number(s.dueAmount) > 0 ? <span className="text-destructive font-medium">₹{Number(s.dueAmount).toLocaleString("en-IN")}</span> : "—"}
              </td>
              <td className="px-4 py-3">
                {s.status === "active" && (
                  <Button size="sm" variant="outline" className="text-xs h-7 px-2"
                    onClick={() => updateMutation.mutate({ id: s.id, data: { status: "cancelled" } })}>
                    Cancel
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(items ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No subscriptions found</div>}
    </div>
  );

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <div>
          <h1 className="font-display font-bold text-2xl">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total subscriptions</p>
        </div>

        {expiring && (expiring as Array<{ customerName: string }>).length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-amber-700">{expiring.length} subscriptions expiring within 7 days</p>
              <p className="text-xs text-amber-600 mt-0.5">Contact customers to renew: {expiring.map(e => e.customerName).join(", ")}</p>
            </div>
          </div>
        )}

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {isLoading ? <Skeleton className="h-64 w-full" /> : <SubTable items={data?.data} />}
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "active")} />
          </TabsContent>
          <TabsContent value="expired" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "expired")} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
