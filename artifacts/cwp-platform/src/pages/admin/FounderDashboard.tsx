import { useQuery } from "@tanstack/react-query";
import {
  useGetDashboardStats, getGetDashboardStatsQueryKey,
  useGetSubscriptionHealth, useListStaff,
} from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  TrendingUp, TrendingDown, IndianRupee, Users, CreditCard, AlertCircle,
  Star, Activity, Funnel, Building2,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const COLORS = ["hsl(180,100%,40%)", "hsl(220,40%,60%)", "hsl(40,100%,50%)", "hsl(0,84%,60%)", "hsl(270,60%,60%)"];

async function fetchLeadStats() {
  const res = await fetch("/api/leads/stats");
  if (!res.ok) return { total: 0, converted: 0, conversionRate: 0, bySource: [] };
  return res.json();
}

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function KpiCard({
  title, value, sub, icon: Icon, color = "text-primary", trend, loading, href,
}: {
  title: string; value: string | number; sub?: string; icon: typeof IndianRupee;
  color?: string; trend?: "up" | "down"; loading?: boolean; href?: string;
}) {
  const content = (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:shadow-md transition-shadow" data-testid={`founder-kpi-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
              {loading
                ? <Skeleton className="h-8 w-28 mt-1.5" />
                : <p className={`font-display font-bold text-2xl mt-1 tabular-nums ${color}`}>{value}</p>}
              {sub && <p className="text-muted-foreground text-xs mt-1">{sub}</p>}
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon size={18} className="text-primary" />
              </div>
              {trend && !loading && (
                <span className={`flex items-center gap-0.5 text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
                  {trend === "up" ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {trend === "up" ? "vs last mo" : "vs last mo"}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function FounderDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats(
    { period: "month" },
    { query: { queryKey: getGetDashboardStatsQueryKey({ period: "month" }) } },
  );
  const { data: health } = useGetSubscriptionHealth({ query: {} } as any);
  const { data: leadStats } = useQuery({ queryKey: ["leadStats"], queryFn: fetchLeadStats });
  const { data: staffData } = useListStaff({ isActive: true } as any, {
    query: { queryKey: ["ops-wall-staff"] },
  });

  const activeStaffCount = (staffData ?? []).length;
  const now = new Date();

  const allHealthy =
    (stats?.openComplaints ?? 0) === 0 &&
    (health?.paused ?? 0) === 0 &&
    (stats?.pendingDuesTotal ?? 0) < 10000;

  return (
    <AdminLayout>
      <div className="p-6 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-muted-foreground text-sm">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
            <h1 className="font-display font-bold text-3xl mt-1">Business Overview</h1>
            <p className="text-muted-foreground text-sm mt-1">Everything that matters, in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            {allHealthy && (
              <span className="inline-flex items-center gap-1.5 bg-green-500/10 text-green-700 border border-green-500/20 px-3 py-1.5 rounded-full text-sm font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> All systems healthy
              </span>
            )}
            <Link href="/admin/operations-wall">
              <Button variant="outline" size="sm">
                <Activity size={14} className="mr-1.5" /> Live Wall
              </Button>
            </Link>
          </div>
        </div>

        {/* Revenue block */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Revenue</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard title="Today's Revenue" value={fmt(stats?.todayRevenue ?? 0)} icon={IndianRupee} color="text-primary" loading={isLoading} trend="up" />
            <KpiCard title="This Month" value={fmt(stats?.monthRevenue ?? 0)} icon={TrendingUp} color="text-primary" loading={isLoading} trend="up" />
            <KpiCard title="Collections Due" value={fmt(stats?.pendingDuesTotal ?? 0)} icon={AlertCircle} color={(stats?.pendingDuesTotal ?? 0) > 50000 ? "text-destructive" : "text-amber-600"} loading={isLoading} sub="Outstanding invoices" href="/admin/dues" />
          </div>
        </div>

        {/* Business block */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Business Health</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Active Customers" value={stats?.totalCustomers ?? "—"} icon={Users} loading={isLoading} trend="up" href="/admin/customers" />
            <KpiCard title="Active Contracts" value={stats?.activeContracts ?? stats?.activeSubscriptions ?? "—"} icon={CreditCard} loading={isLoading} href="/admin/customers" />
            <KpiCard title="Total Leads" value={leadStats?.total ?? "—"} icon={Funnel} loading={!leadStats} sub={`${leadStats?.conversionRate ?? 0}% conversion`} href="/admin/leads" />
            <KpiCard title="Active Staff" value={activeStaffCount} icon={Users} loading={!staffData} href="/admin/staff" />
          </div>
        </div>

        {/* Alerts block */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Watch List</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Open Complaints" value={stats?.openComplaints ?? "—"} icon={AlertCircle} color={(stats?.openComplaints ?? 0) > 0 ? "text-destructive" : "text-green-600"} loading={isLoading} href="/admin/complaints" />
            <KpiCard title="Paused (Low Bal.)" value={health?.paused ?? "—"} icon={AlertCircle} color={(health?.paused ?? 0) > 0 ? "text-amber-600" : "text-green-600"} loading={!health} sub="Need wallet top-up" href="/admin/subscriptions" />
            <KpiCard title="Repeat Customer %" value={`${stats?.repeatCustomerPercent ?? 0}%`} icon={Star} loading={isLoading} />
            <KpiCard title="Churn Rate" value={`${health?.churnRate ?? 0}%`} icon={TrendingDown} color={(health?.churnRate ?? 0) > 5 ? "text-destructive" : "text-green-600"} loading={!health} />
          </div>
        </div>

        {/* City Performance */}
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">City-wise Performance</h2>
          <Card>
            <CardContent className="p-5">
              {isLoading
                ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
                : (stats?.cityWiseStats ?? []).length === 0
                ? <p className="text-muted-foreground text-sm text-center py-4">No city data available</p>
                : (
                  <div className="space-y-4">
                    {(stats?.cityWiseStats ?? []).map((c, i) => {
                      const maxRev = Math.max(...(stats?.cityWiseStats ?? []).map(x => x.revenue ?? 0), 1);
                      return (
                        <div key={c.city} className="flex items-center gap-4">
                          <div className="w-6 text-xs text-muted-foreground text-right tabular-nums">{i + 1}</div>
                          <div className="w-24 font-medium text-sm truncate">{c.city}</div>
                          <div className="flex-1">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((c.revenue ?? 0) / maxRev) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-right w-20 tabular-nums">
                            <p className="text-sm font-semibold">{fmt(c.revenue ?? 0)}</p>
                          </div>
                          <div className="text-right w-24 text-xs text-muted-foreground tabular-nums">
                            {c.customers} customers
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading
                ? <Skeleton className="h-48 w-full" />
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats?.revenueByCategory ?? []}>
                      <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : String(v)} />
                      <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
                      <Bar dataKey="amount" fill="hsl(180,100%,40%)" radius={[4, 4, 0, 0]} />
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
              {isLoading
                ? <Skeleton className="h-48 w-full" />
                : (
                  <div>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={stats?.subscriptionBreakdown ?? []} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={65}>
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
      </div>
    </AdminLayout>
  );
}
