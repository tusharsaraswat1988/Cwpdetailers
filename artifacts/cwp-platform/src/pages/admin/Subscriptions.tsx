import { useState } from "react";
import {
  useListSubscriptions, getListSubscriptionsQueryKey,
  useGetExpiringSoonSubscriptions, getGetExpiringSoonSubscriptionsQueryKey,
  useUpdateSubscription,
  usePauseSubscription, useResumeSubscription, useCancelSubscription,
  useGetSubscriptionHealth,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, Pause, Play, X } from "lucide-react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

const statusColors: Record<string, string> = {
  active: "bg-green-500/10 text-green-600 border-green-500/20",
  paused: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  expiring: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  expired: "bg-muted text-muted-foreground border-muted",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  missed: "bg-red-500/10 text-red-600 border-red-500/20",
};

function ProgressBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-0.5">{used}/{total} services used</p>
    </div>
  );
}

export default function AdminSubscriptions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data, isLoading } = useListSubscriptions({}, { query: { queryKey: getListSubscriptionsQueryKey({}) } });
  const { data: expiring } = useGetExpiringSoonSubscriptions({ query: { queryKey: getGetExpiringSoonSubscriptionsQueryKey() } });
  const { data: health } = useGetSubscriptionHealth();

  const updateMutation = useUpdateSubscription({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() }); toast({ title: "Subscription updated" }); },
    },
  });

  const pauseMutation = usePauseSubscription({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() }); toast({ title: "Subscription paused" }); },
    },
  });
  const resumeMutation = useResumeSubscription({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() }); toast({ title: "Subscription resumed" }); },
    },
  });
  const cancelMutation = useCancelSubscription({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSubscriptionsQueryKey() }); toast({ title: "Subscription cancelled" }); },
    },
  });

  const onCancel = (id: number) => {
    if (confirm("Cancel this subscription?")) cancelMutation.mutate({ id, data: {} });
  };

  const SubTable = ({ items }: { items: NonNullable<typeof data>["data"] | undefined }) => (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr>
            {["Customer", "Type", "Status", "Services", "Period", "Price", "Due", "Action"].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {(items ?? []).map(s => (
            <tr key={s.id} className="hover:bg-muted/20 cursor-pointer" data-testid={`sub-row-${s.id}`} onClick={() => setDetailId(s.id)}>
              <td className="px-4 py-3 font-medium">{s.customerName}</td>
              <td className="px-4 py-3 text-muted-foreground capitalize">{s.type?.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={`text-xs capitalize ${statusColors[s.status ?? "active"]}`}>{s.status}</Badge>
              </td>
              <td className="px-4 py-3 w-32">
                {s.totalServices != null ? <ProgressBar used={s.servicesUsed ?? 0} total={s.totalServices} /> : "—"}
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">
                {s.startDate} → {s.endDate}
              </td>
              <td className="px-4 py-3 font-medium">₹{Number(s.price).toLocaleString("en-IN")}</td>
              <td className="px-4 py-3">
                {Number(s.dueAmount) > 0 ? <span className="text-destructive font-medium">₹{Number(s.dueAmount).toLocaleString("en-IN")}</span> : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {s.status === "active" && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); pauseMutation.mutate({ id: s.id }); }}>
                      <Pause size={12} />
                    </Button>
                  )}
                  {s.status === "paused" && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); resumeMutation.mutate({ id: s.id }); }}>
                      <Play size={12} />
                    </Button>
                  )}
                  {(s.status === "active" || s.status === "paused") && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); onCancel(s.id); }}>
                      <X size={12} />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(items ?? []).length === 0 && <div className="text-center py-12 text-muted-foreground">No subscriptions found</div>}
    </div>
  );

  const detailSub = data?.data?.find(s => s.id === detailId);

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        <Link href="/admin/services" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Services
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Legacy contracts</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {data?.total ?? 0} monthly wash &amp; solar AMC contracts — daily cleaning runs in{" "}
              <Link href="/admin/daily-cleaning/subscriptions" className="text-primary hover:underline">Daily Clean subscriptions</Link>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {health && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-green-500/10 text-green-600 px-2 py-1 rounded-md">{health.active} active</span>
                <span className="bg-blue-500/10 text-blue-600 px-2 py-1 rounded-md">{health.paused} paused</span>
                <span className="bg-amber-500/10 text-amber-600 px-2 py-1 rounded-md">{health.expiring} expiring</span>
                <span className="bg-red-500/10 text-red-600 px-2 py-1 rounded-md">{health.missed} missed</span>
                <span className="bg-muted px-2 py-1 rounded-md">{health.expired} expired</span>
                <span className="bg-destructive/10 text-destructive px-2 py-1 rounded-md">{health.churnRate ?? 0}% churn</span>
              </div>
            )}
          </div>
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
            <TabsTrigger value="paused">Paused</TabsTrigger>
            <TabsTrigger value="expiring">Expiring</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
            <TabsTrigger value="missed">Missed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {isLoading ? <Skeleton className="h-64 w-full" /> : <SubTable items={data?.data} />}
          </TabsContent>
          <TabsContent value="active" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "active")} />
          </TabsContent>
          <TabsContent value="paused" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "paused")} />
          </TabsContent>
          <TabsContent value="expiring" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "expiring")} />
          </TabsContent>
          <TabsContent value="expired" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "expired")} />
          </TabsContent>
          <TabsContent value="missed" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "missed")} />
          </TabsContent>
          <TabsContent value="cancelled" className="mt-4">
            <SubTable items={(data?.data ?? []).filter(s => s.status === "cancelled")} />
          </TabsContent>
        </Tabs>

        {/* Detail drawer */}
        {detailSub && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetailId(null)}>
            <div className="w-full max-w-md bg-card h-full border-l border-border p-6 overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg">Subscription #{detailSub.id}</h2>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailId(null)}><X size={14} /></Button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Customer</span>
                  <span className="font-medium text-sm">{detailSub.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Type</span>
                  <span className="font-medium text-sm capitalize">{detailSub.type?.replace(/_/g, " ")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Status</span>
                  <Badge variant="outline" className={`text-xs capitalize ${statusColors[detailSub.status ?? "active"]}`}>{detailSub.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Period</span>
                  <span className="text-sm">{detailSub.startDate} → {detailSub.endDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Next Due</span>
                  <span className="text-sm">{detailSub.nextDueDate ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Price</span>
                  <span className="font-medium text-sm">₹{Number(detailSub.price).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Due</span>
                  <span className="font-medium text-sm text-destructive">₹{Number(detailSub.dueAmount).toLocaleString("en-IN")}</span>
                </div>
                {detailSub.totalServices != null && (
                  <div>
                    <span className="text-muted-foreground text-sm">Services</span>
                    <div className="mt-1">
                      <ProgressBar used={detailSub.servicesUsed ?? 0} total={detailSub.totalServices} />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  {detailSub.status === "active" && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => pauseMutation.mutate({ id: detailSub.id })}>
                      <Pause size={12} className="mr-1" /> Pause
                    </Button>
                  )}
                  {detailSub.status === "paused" && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => resumeMutation.mutate({ id: detailSub.id })}>
                      <Play size={12} className="mr-1" /> Resume
                    </Button>
                  )}
                  {(detailSub.status === "active" || detailSub.status === "paused") && (
                    <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => onCancel(detailSub.id)}>
                      <X size={12} className="mr-1" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
