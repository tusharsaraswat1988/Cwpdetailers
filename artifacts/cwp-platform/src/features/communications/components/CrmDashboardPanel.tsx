import { useQuery } from "@tanstack/react-query";
import { commApi } from "../api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Star, TrendingUp, Inbox } from "lucide-react";

function Metric({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="p-3 rounded-lg border">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="font-bold text-xl mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function CrmDashboardPanel() {
  const { data: sla, isLoading: slaLoading } = useQuery({ queryKey: ["comm-sla"], queryFn: commApi.getSlaDashboard });
  const { data: csat, isLoading: csatLoading } = useQuery({ queryKey: ["comm-csat"], queryFn: commApi.getCsatDashboard });
  const { data: inboxCounts } = useQuery({ queryKey: ["comm-inbox-counts"], queryFn: commApi.getInboxCounts });
  const { data: crm } = useQuery({ queryKey: ["comm-crm-analytics"], queryFn: commApi.getCrmAnalytics });
  const { data: profitability, isLoading: profLoading } = useQuery({ queryKey: ["comm-profitability"], queryFn: () => commApi.getProfitability() });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {slaLoading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />) : (
          <>
            <Metric label="Open Conversations" value={sla?.openConversations ?? inboxCounts?.open ?? 0} />
            <Metric label="Pending Replies" value={sla?.pendingReplies ?? inboxCounts?.pendingReplies ?? 0} />
            <Metric label="SLA Breaches" value={sla?.slaBreaches ?? inboxCounts?.slaBreaches ?? 0} />
            <Metric label="My Queue" value={inboxCounts?.myQueue ?? 0} />
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Star size={14} />CSAT</CardTitle>
          </CardHeader>
          <CardContent>
            {csatLoading ? <Skeleton className="h-16" /> : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-2xl font-bold">{csat?.avgRating?.toFixed(1) ?? "—"}</p><p className="text-xs text-muted-foreground">Avg Rating</p></div>
                <div><p className="text-2xl font-bold">{csat?.satisfactionPct ?? 0}%</p><p className="text-xs text-muted-foreground">Satisfied</p></div>
                <div><p className="text-2xl font-bold">{csat?.totalResponses ?? 0}</p><p className="text-xs text-muted-foreground">Responses</p></div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Inbox size={14} />Inbox Overview</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 rounded border"><span>Unassigned</span><span className="font-medium">{inboxCounts?.unassigned ?? 0}</span></div>
            <div className="flex justify-between p-2 rounded border"><span>Assigned</span><span className="font-medium">{inboxCounts?.assigned ?? 0}</span></div>
            <div className="flex justify-between p-2 rounded border"><span>Escalated</span><span className="font-medium text-red-600">{inboxCounts?.escalated ?? 0}</span></div>
            <div className="flex justify-between p-2 rounded border"><span>Closed</span><span className="font-medium">{inboxCounts?.closed ?? 0}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp size={14} />Channel Profitability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {profLoading ? <Skeleton className="h-24" /> : (profitability ?? []).map(row => (
            <div key={row.channel} className="flex justify-between items-center p-2 rounded border text-sm">
              <span className="font-medium uppercase">{row.channel}</span>
              <span>Cost ₹{row.cost.toLocaleString("en-IN")} · Rev ₹{row.revenue.toLocaleString("en-IN")} · ROI {row.roi}x</span>
            </div>
          ))}
          {!profLoading && !profitability?.length && (
            <p className="text-sm text-muted-foreground text-center py-4">No profitability data yet</p>
          )}
        </CardContent>
      </Card>

      {crm && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle size={14} />CRM Analytics Snapshot</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">{JSON.stringify(crm, null, 2)}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
