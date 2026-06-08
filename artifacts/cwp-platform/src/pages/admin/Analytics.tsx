import { useGetRevenueAnalytics, getGetRevenueAnalyticsQueryKey, useGetCustomerAnalytics, getGetCustomerAnalyticsQueryKey, useGetStaffLeaderboard, getGetStaffLeaderboardQueryKey, useGetOutstandingDues, getGetOutstandingDuesQueryKey } from "@workspace/api-client-react";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from "recharts";
import { Star, TrendingUp, AlertCircle, Trophy } from "lucide-react";

const COLORS = ["hsl(180,100%,40%)", "hsl(220,70%,60%)", "hsl(40,100%,50%)", "hsl(0,84%,60%)", "hsl(270,60%,60%)"];

export default function AdminAnalytics() {
  const { data: revenue, isLoading: revLoading } = useGetRevenueAnalytics({ period: "month" }, { query: { queryKey: getGetRevenueAnalyticsQueryKey({ period: "month" }) } });
  const { data: customers, isLoading: custLoading } = useGetCustomerAnalytics({ query: { queryKey: getGetCustomerAnalyticsQueryKey() } });
  const { data: leaderboard } = useGetStaffLeaderboard({}, { query: { queryKey: getGetStaffLeaderboardQueryKey({}) } });
  const { data: dues } = useGetOutstandingDues({}, { query: { queryKey: getGetOutstandingDuesQueryKey({}) } });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Business performance insights</p>
        </div>

        {/* Revenue overview cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Revenue", value: revenue?.totalRevenue, icon: TrendingUp },
            { label: "Collected", value: revenue?.paidRevenue, icon: TrendingUp },
            { label: "Pending", value: revenue?.pendingRevenue, icon: AlertCircle },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="p-5">
                <p className="text-muted-foreground text-xs uppercase tracking-wide font-medium">{label}</p>
                {revLoading ? <Skeleton className="h-7 w-24 mt-1.5" /> : (
                  <p className="font-display font-bold text-2xl text-primary mt-1">
                    ₹{(value ?? 0).toLocaleString("en-IN")}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {revLoading ? <Skeleton className="h-52 w-full" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenue?.revenueByPeriod ?? []}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => v >= 1000 ? `${v / 1000}k` : v} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(180,100%,40%)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Customer growth */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Customer Growth</CardTitle>
            </CardHeader>
            <CardContent>
              {custLoading ? <Skeleton className="h-44 w-full" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={customers?.customerGrowth ?? []}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Total" fill="hsl(180,100%,40%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="newCustomers" name="New" fill="hsl(220,70%,60%)" radius={[3, 3, 0, 0]} />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Revenue by service */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Revenue by Service</CardTitle>
            </CardHeader>
            <CardContent>
              {revLoading ? <Skeleton className="h-44 w-full" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={revenue?.revenueByService ?? []} dataKey="revenue" nameKey="serviceName" cx="50%" cy="50%" outerRadius={70}>
                      {(revenue?.revenueByService ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Staff leaderboard */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <Trophy size={15} className="text-primary" />
              <CardTitle className="text-sm font-semibold">Staff Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(leaderboard ?? []).slice(0, 5).map(s => (
                <div key={s.staffId} className="flex items-center gap-3 py-1.5" data-testid={`leaderboard-${s.staffId}`}>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {s.rank}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.staffName}</p>
                    <p className="text-xs text-muted-foreground">{s.jobsCompleted} jobs · ₹{(s.revenueGenerated ?? 0).toLocaleString("en-IN")}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Star size={11} fill="currentColor" />
                    {Number(s.averageRating ?? 0).toFixed(1)}
                  </div>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && <p className="text-muted-foreground text-sm text-center py-4">No staff data</p>}
            </CardContent>
          </Card>

          {/* Outstanding dues */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <AlertCircle size={15} className="text-destructive" />
              <CardTitle className="text-sm font-semibold">Outstanding Dues</CardTitle>
            </CardHeader>
            <CardContent>
              {dues && (
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-destructive/5 rounded-lg p-3 text-center">
                    <p className="font-display font-bold text-lg text-destructive">₹{(dues.totalDues ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-muted-foreground">Total Dues</p>
                  </div>
                  <div className="bg-muted rounded-lg p-3 text-center">
                    <p className="font-display font-bold text-lg">{dues.customersWithDues ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Customers</p>
                  </div>
                  <div className="bg-amber-500/5 rounded-lg p-3 text-center">
                    <p className="font-display font-bold text-lg text-amber-600">{dues.overdueInvoices ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {(dues?.topDebtors ?? []).slice(0, 4).map(d => (
                  <div key={d.customerId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.customerName}</span>
                    <div className="text-right">
                      <span className="text-destructive font-medium">₹{(d.dueAmount ?? 0).toLocaleString("en-IN")}</span>
                      {(d.daysPastDue ?? 0) > 0 && <span className="text-xs text-muted-foreground ml-1">({d.daysPastDue}d overdue)</span>}
                    </div>
                  </div>
                ))}
                {(!dues?.topDebtors || dues.topDebtors.length === 0) && <p className="text-muted-foreground text-sm text-center py-4">No outstanding dues</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
