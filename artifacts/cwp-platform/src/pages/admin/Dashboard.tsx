import { useGetDashboardStats, getGetDashboardStatsQueryKey, useGetExpiringSoonSubscriptions } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, CreditCard, Calendar, AlertCircle, Star, IndianRupee, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const COLORS = ["hsl(180,100%,40%)", "hsl(220,40%,60%)", "hsl(40,100%,50%)", "hsl(0,84%,60%)", "hsl(270,60%,60%)"];

function StatCard({ title, value, subtitle, icon: Icon, color = "text-primary", loading }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, "-")}`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
              {loading ? <Skeleton className="h-7 w-24 mt-1.5" /> : (
                <p className={`font-display font-bold text-2xl mt-1 ${color}`}>{value}</p>
              )}
              {subtitle && <p className="text-muted-foreground text-xs mt-1">{subtitle}</p>}
            </div>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon size={18} className="text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats({ period: "month" }, { query: { queryKey: getGetDashboardStatsQueryKey({ period: "month" }) } });
  const { data: expiring } = useGetExpiringSoonSubscriptions();

  const fmt = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString("en-IN")}`;

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-2xl">Operations Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Real-time business overview</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Today</p>
            <p className="font-medium text-sm">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Today's Revenue" value={fmt(stats?.todayRevenue ?? 0)} icon={IndianRupee} loading={isLoading} />
          <StatCard title="Month Revenue" value={fmt(stats?.monthRevenue ?? 0)} icon={TrendingUp} loading={isLoading} />
          <StatCard title="Active Subscriptions" value={stats?.activeSubscriptions ?? "--"} icon={CreditCard} loading={isLoading} />
          <StatCard title="Total Customers" value={stats?.totalCustomers ?? "--"} icon={Users} loading={isLoading} />
          <StatCard title="Pending Dues" value={fmt(stats?.pendingDuesTotal ?? 0)} icon={AlertCircle} color="text-destructive" loading={isLoading} subtitle="Needs collection" />
          <StatCard title="Active Jobs" value={stats?.activeJobs ?? "--"} icon={Activity} loading={isLoading} />
          <StatCard title="Open Complaints" value={stats?.openComplaints ?? "--"} icon={AlertCircle} color="text-amber-500" loading={isLoading} />
          <StatCard title="Repeat Customer %" value={`${stats?.repeatCustomerPercent ?? 0}%`} icon={Star} loading={isLoading} />
        </div>

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Revenue by category */}
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
                    <Bar dataKey="amount" fill="hsl(180,100%,40%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Subscription breakdown */}
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

        {/* Bottom row */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* City stats */}
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

          {/* Expiring subscriptions */}
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
      </div>
    </AdminLayout>
  );
}
