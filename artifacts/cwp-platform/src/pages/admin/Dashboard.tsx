import { useGetDashboardStats, getGetDashboardStatsQueryKey, useGetExpiringSoonSubscriptions, useGetSubscriptionHealth } from "@workspace/api-client-react";
import { PageTemplate, KpiRow, ErrorState, type KpiItem } from "@/components/shared";
import { ADMIN_CHART_COLORS, ADMIN_CHART } from "@/features/admin-ds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, CreditCard, AlertCircle, Activity, Clock, BarChart3, HeartPulse, Pause, Circle, ChevronDown, ClipboardCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

const COLORS = [...ADMIN_CHART_COLORS];

async function fetchLeadStats(): Promise<{ total: number; converted: number; conversionRate: number; bySource: { source: string; count: number }[] }> {
  const res = await fetch("/api/leads/stats");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchFollowUps(): Promise<any[]> {
  const res = await fetch("/api/leads/follow-ups");
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function fetchOpsSummary(): Promise<{ pending: number }> {
  const today = new Date().toISOString().split("T")[0];
  const res = await fetch(`/api/operations/timeline?date=${today}`, { credentials: "include" });
  if (!res.ok) return { pending: 0 };
  const data = await res.json();
  return { pending: data.summary?.pending ?? 0 };
}

export default function AdminDashboard() {
  const { data: stats, isLoading, isError, refetch } = useGetDashboardStats({ period: "month" }, { query: { queryKey: getGetDashboardStatsQueryKey({ period: "month" }) } });
  const { data: expiring } = useGetExpiringSoonSubscriptions();
  const { data: health } = useGetSubscriptionHealth();
  const { data: leadStats } = useQuery({ queryKey: ["leadStats"], queryFn: fetchLeadStats });
  const { data: followUps } = useQuery({ queryKey: ["leadFollowUps"], queryFn: fetchFollowUps });
  const { data: opsSummary } = useQuery({ queryKey: ["dashboardOpsSummary"], queryFn: fetchOpsSummary, refetchInterval: 60000 });

  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;
  const sourceLabel: Record<string, string> = {
    whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", website: "Website", call: "Call", google: "Google", walk_in: "Walk-in", referral: "Referral",
  };

  const pendingAssignments = opsSummary?.pending ?? 0;

  const priorityKpis: KpiItem[] = [
    {
      id: "todays-jobs",
      label: "Today's Jobs",
      value: stats?.activeJobs ?? "--",
      icon: Activity,
      href: "/admin/service-updates",
      prominent: true,
    },
    {
      id: "pending-assignments",
      label: "Pending Assignments",
      value: pendingAssignments,
      icon: ClipboardCheck,
      href: "/admin/assign-services",
      tone: pendingAssignments > 0 ? "warning" : "default",
      prominent: true,
    },
    {
      id: "collections-due",
      label: "Collections Due",
      value: fmt(stats?.pendingDuesTotal ?? 0),
      icon: AlertCircle,
      tone: "destructive",
      subtitle: "Needs collection",
      href: "/admin/billing?tab=dues",
      prominent: true,
    },
    {
      id: "open-complaints",
      label: "Open Complaints",
      value: stats?.openComplaints ?? "--",
      icon: AlertCircle,
      tone: "warning",
      href: "/admin/complaints",
      prominent: true,
    },
    {
      id: "revenue-this-month",
      label: "Revenue This Month",
      value: fmt(stats?.monthRevenue ?? 0),
      icon: TrendingUp,
      subtitle: stats?.todayRevenue ? `Today: ${fmt(stats.todayRevenue)}` : undefined,
      href: "/admin/billing",
    },
  ];

  const secondaryKpis: KpiItem[] = [
    { id: "active-customers", label: "Active Customers", value: stats?.totalCustomers ?? "--", icon: Users, href: "/admin/customers" },
  ];

  return (
    <PageTemplate
      title="Dashboard"
      description="What needs your attention today"
      primaryAction={{
        label: "View today's jobs",
        href: "/admin/service-updates",
        testId: "dashboard-primary-cta",
      }}
    >
      <div className="text-right -mt-2">
        <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
      </div>

      {isError ? (
        <ErrorState description="We couldn't load dashboard stats. Please try again." onRetry={() => refetch()} />
      ) : (
        <>
          {/* Priority KPIs — founder order */}
          <KpiRow items={priorityKpis} isLoading={isLoading} columns={5} />
          <KpiRow items={secondaryKpis} isLoading={isLoading} columns={4} />
        </>
      )}

      {!isError && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full py-2">
            <ChevronDown size={16} className="transition-transform [[data-state=open]_&]:rotate-180" />
            More insights — subscriptions, sales & charts
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-2">
            {health && (
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <HeartPulse size={18} className="text-primary" />
                      <span className="font-semibold text-sm">Subscription Health</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-1 rounded-md border border-green-500/20">
                        <Circle size={7} fill="currentColor" /> {health.active} active
                      </span>
                      {(health.paused ?? 0) > 0 && (
                        <span className="flex items-center gap-1 bg-amber-500/10 text-amber-700 px-2 py-1 rounded-md border border-amber-500/20 font-medium">
                          <Pause size={8} /> {health.paused ?? 0} paused (low balance)
                        </span>
                      )}
                      {(health.expiring ?? 0) > 0 && (
                        <span className="flex items-center gap-1 bg-orange-500/10 text-orange-700 px-2 py-1 rounded-md border border-orange-500/20">
                          <AlertCircle size={8} /> {health.expiring ?? 0} expiring soon
                        </span>
                      )}
                      {(health.missedThisWeek ?? 0) > 0 && (
                        <span className="flex items-center gap-1 bg-red-500/10 text-red-700 px-2 py-1 rounded-md border border-red-500/20 font-medium">
                          <AlertCircle size={8} /> {health.missedThisWeek ?? 0} missed this week
                        </span>
                      )}
                      <span className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded-md">
                        <Circle size={7} fill="currentColor" /> {health.expired} expired
                      </span>
                      <Link href="/admin/subscriptions" className="text-primary hover:underline ml-1 font-medium">View all →</Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <KpiRow
              items={[
                { id: "active-subscriptions", label: "Active Subscriptions", value: stats?.activeSubscriptions ?? "--", icon: CreditCard },
                { id: "repeat-customer-percent", label: "Repeat Customer %", value: `${stats?.repeatCustomerPercent ?? 0}%`, icon: Users },
              ]}
              isLoading={isLoading}
              columns={4}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 size={14} className="text-primary" />Lead Source Analytics
                  </CardTitle>
                  <Link href="/admin/leads" className="text-xs text-primary hover:underline">View pipeline</Link>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    {leadStats?.bySource?.map(s => (
                      <div key={s.source} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-sm font-medium">{sourceLabel[s.source] || s.source}</span>
                        <span className="text-sm text-muted-foreground">{s.count}</span>
                      </div>
                    )) ?? (
                      <p className="text-sm text-muted-foreground">No lead data yet</p>
                    )}
                    <div className="ml-auto flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-lg font-bold text-primary">{leadStats?.total ?? 0}</p>
                        <p className="text-[10px] text-muted-foreground">Total Leads</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-400">{leadStats?.conversionRate ?? 0}%</p>
                        <p className="text-[10px] text-muted-foreground">Conversion</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" />Follow-ups
                  </CardTitle>
                  <Link href="/admin/leads" className="text-xs text-primary hover:underline">View all</Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(followUps ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No upcoming follow-ups</p>
                  ) : (
                    (followUps ?? []).slice(0, 5).map(l => (
                      <div key={l.id} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{l.name}</p>
                          <p className="text-xs text-muted-foreground">{l.phone}</p>
                        </div>
                        <span className="text-xs text-amber-500">{l.nextFollowUpAt ? new Date(l.nextFollowUpAt).toLocaleDateString("en-IN") : "—"}</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Revenue by Service Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-48 w-full" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={stats?.revenueByCategory ?? []}>
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
                        <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                        <Bar dataKey="amount" fill={ADMIN_CHART.primary} radius={ADMIN_CHART.barRadius} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Subscription Mix</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? <Skeleton className="h-48 w-full" /> : (
                    <div>
                      <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                          <Pie data={stats?.subscriptionBreakdown ?? []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={60}>
                            {(stats?.subscriptionBreakdown ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {(stats?.subscriptionBreakdown ?? []).map((b, i) => (
                          <div key={b.type ?? i} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                              <span className="text-muted-foreground capitalize">{(b.type ?? "").replace(/_/g, " ")}</span>
                            </div>
                            <span className="font-medium">{b.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Revenue by City</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />) : (
                    (stats?.cityWiseStats ?? []).map(c => (
                      <div key={c.city} className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{c.city}</span>
                            <span className="text-muted-foreground">₹{(c.revenue ?? 0).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, ((c.revenue ?? 0) / (Math.max(...(stats?.cityWiseStats ?? []).map(x => x.revenue ?? 0)) || 1)) * 100)}%` }} />
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">{c.customers} customers</span>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Expiring Soon</CardTitle>
                  <Link href="/admin/subscriptions" className="text-xs text-primary hover:underline">View all</Link>
                </CardHeader>
                <CardContent className="space-y-2">
                  {!expiring || expiring.length === 0 ? (
                    <p className="text-muted-foreground text-sm text-center py-4">No subscriptions expiring in 7 days</p>
                  ) : expiring.slice(0, 5).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0" data-testid={`expiring-sub-${sub.id}`}>
                      <div>
                        <p className="text-sm font-medium">{sub.customerName}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sub.type?.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-amber-500">{sub.endDate}</p>
                        <p className="text-xs text-muted-foreground">₹{Number(sub.dueAmount).toLocaleString("en-IN")} due</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </PageTemplate>
  );
}
