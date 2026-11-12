import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import {
  useGetRevenueAnalytics,
  getGetRevenueAnalyticsQueryKey,
  useGetCustomerAnalytics,
  getGetCustomerAnalyticsQueryKey,
  useGetStaffLeaderboard,
  getGetStaffLeaderboardQueryKey,
  useGetOutstandingDues,
  getGetOutstandingDuesQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { ADMIN_CHART, ADMIN_CHART_COLORS } from "@/features/admin-ds";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  Star,
  TrendingUp,
  AlertCircle,
  Trophy,
  CalendarX,
  Building2,
  MapPin,
  CheckCircle2,
  Users,
  Car,
  ShieldAlert,
  Percent,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  Globe,
} from "lucide-react";
import { Link } from "wouter";

const COLORS = [...ADMIN_CHART_COLORS];

async function fetchCancelledPlans() {
  const res = await fetch("/api/churned", { credentials: "include" });
  if (!res.ok) return [];
  return res.json() as Promise<
    Array<{ id: number; customerName: string; planName?: string; cancelledAt?: string }>
  >;
}

async function fetchMultiCityAnalytics(cityId?: string, branchId?: string) {
  const params = new URLSearchParams();
  if (cityId && cityId !== "all") params.append("cityId", cityId);
  if (branchId && branchId !== "all") params.append("branchId", branchId);
  const qs = params.toString();
  const res = await fetch(`/api/analytics/multi-city${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to load multi-city analytics");
  return res.json();
}

async function fetchCities() {
  try {
    const res = await fetch("/api/masters/cities", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.data ?? [];
  } catch {
    return [];
  }
}

async function fetchBranches() {
  try {
    const res = await fetch("/api/branches", { credentials: "include" });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : data?.data ?? [];
  } catch {
    return [];
  }
}

export default function AdminAnalytics() {
  const activeCityId = useAppStore((s) => s.activeCityId);
  const activeBranchId = useAppStore((s) => s.activeBranchId);
  const clearScope = useAppStore((s) => s.clearScope);

  const { data: cities = [] } = useQuery({ queryKey: ["cities"], queryFn: fetchCities });
  const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: fetchBranches });

  const selectedCityObj = cities.find((c: any) => c.id === activeCityId);
  const selectedBranchObj = branches.find((b: any) => b.id === activeBranchId);

  const { data: multiCity, isLoading: multiCityLoading } = useQuery({
    queryKey: ["analytics", "multi-city", activeCityId, activeBranchId],
    queryFn: () =>
      fetchMultiCityAnalytics(
        activeCityId ? String(activeCityId) : undefined,
        activeBranchId ? String(activeBranchId) : undefined,
      ),
  });

  const { data: revenue, isLoading: revLoading } = useGetRevenueAnalytics(
    { period: "month" },
    { query: { queryKey: getGetRevenueAnalyticsQueryKey({ period: "month" }) } },
  );
  const { data: customers, isLoading: custLoading } = useGetCustomerAnalytics({
    query: { queryKey: getGetCustomerAnalyticsQueryKey() },
  });
  const { data: leaderboard } = useGetStaffLeaderboard(
    {},
    { query: { queryKey: getGetStaffLeaderboardQueryKey({}) } },
  );
  const { data: dues } = useGetOutstandingDues(
    {},
    { query: { queryKey: getGetOutstandingDuesQueryKey({}) } },
  );
  const { data: cancelledPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["analytics", "cancelled-plans"],
    queryFn: fetchCancelledPlans,
  });

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header & Synchronized Scope View */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display font-bold text-2xl">
                {activeBranchId ? `${selectedBranchObj?.name ?? "Branch"} Analytics` : "Platform Analytics"}
              </h1>
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  activeBranchId
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-primary/10 text-primary border-primary/20"
                }`}
              >
                {activeBranchId
                  ? `🏢 ${selectedBranchObj?.name ?? "Branch"}`
                  : "Founder View (All Branches)"}
              </span>
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              {activeBranchId
                ? `Operational performance, daily cleaning fulfillment, cleaner leaderboard & collections for ${selectedBranchObj?.name ?? "this branch"}`
                : "Cross-branch operations, subscription health, financial performance & branch productivity"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeBranchId ? (
              <Button
                variant="outline"
                size="sm"
                onClick={clearScope}
                className="text-xs gap-1.5 h-8 text-muted-foreground hover:text-foreground border-border bg-card shadow-sm"
                data-testid="reset-to-founder-view"
              >
                <Globe size={13} className="text-primary" />
                <span>Reset to All Branches</span>
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 border border-border/60 px-3 py-1.5 rounded-lg">
                <Globe size={13} className="text-primary" />
                <span>All Branches Scope — Filter branch via top bar</span>
              </div>
            )}
          </div>
        </div>

        {/* Operational Highlights */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
                <span>Active Subscriptions</span>
                <Sparkles size={14} className="text-primary" />
              </div>
              {multiCityLoading ? (
                <Skeleton className="h-7 w-20 mt-2" />
              ) : (
                <p className="font-display font-bold text-2xl text-foreground mt-1.5">
                  {multiCity?.operational?.activeSubscriptions ?? 0}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">Daily cleaning active subscribers</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
                <span>Today's Cleaning</span>
                <CheckCircle2 size={14} className="text-green-500" />
              </div>
              {multiCityLoading ? (
                <Skeleton className="h-7 w-20 mt-2" />
              ) : (
                <div className="flex items-baseline gap-2 mt-1.5">
                  <span className="font-display font-bold text-2xl text-green-500">
                    {multiCity?.operational?.todayCompleted ?? 0}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {multiCity?.operational?.todayAssigned ?? 0} ({multiCity?.operational?.overallCompletionRate ?? 0}%)
                  </span>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {multiCity?.operational?.todayPending ?? 0} pending · {multiCity?.operational?.todayCna ?? 0} CNA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
                <span>Collections</span>
                <TrendingUp size={14} className="text-primary" />
              </div>
              {multiCityLoading ? (
                <Skeleton className="h-7 w-24 mt-2" />
              ) : (
                <p className="font-display font-bold text-2xl text-primary mt-1.5">
                  ₹{(multiCity?.financial?.collectedRevenue ?? 0).toLocaleString("en-IN")}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {multiCity?.financial?.collectionRate ?? 0}% collection efficiency
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-muted-foreground text-xs uppercase font-medium">
                <span>Outstanding Dues</span>
                <AlertCircle size={14} className="text-rose-500" />
              </div>
              {multiCityLoading ? (
                <Skeleton className="h-7 w-24 mt-2" />
              ) : (
                <p className="font-display font-bold text-2xl text-rose-500 mt-1.5">
                  ₹{(multiCity?.financial?.outstandingDues ?? 0).toLocaleString("en-IN")}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {multiCity?.operational?.openExceptionsCount ?? 0} open exceptions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Branch Operations & Multi-Tenant Performance */}
        <div className="grid lg:grid-cols-2 gap-5">
          {!activeBranchId ? (
            /* Founder View: Branch Operations Comparison */
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Building2 size={15} className="text-primary" />
                    Branch Operations Comparison
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Footprint across all active branches</p>
                </div>
              </CardHeader>
              <CardContent>
                {multiCityLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (multiCity?.branchBreakdown ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No branches registered</p>
                ) : (
                  <div className="divide-y divide-border">
                    <div className="grid grid-cols-12 text-[11px] font-semibold text-muted-foreground uppercase pb-2">
                      <span className="col-span-4">Branch</span>
                      <span className="col-span-2 text-right">Staff</span>
                      <span className="col-span-2 text-right">Subs</span>
                      <span className="col-span-4 text-right">Collected</span>
                    </div>
                    {(multiCity?.branchBreakdown ?? []).map((b: any) => (
                      <div key={b.branchId} className="grid grid-cols-12 items-center py-2.5 text-xs">
                        <div className="col-span-4 font-medium flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <span className="truncate">{b.branchName}</span>
                        </div>
                        <div className="col-span-2 text-right text-muted-foreground">{b.staffCount}</div>
                        <div className="col-span-2 text-right font-semibold text-foreground">
                          {b.activeSubscriptions}
                        </div>
                        <div className="col-span-4 text-right font-semibold text-primary">
                          ₹{(b.collectedRevenue ?? 0).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* Scoped View: Selected Branch Focus */
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                    <Building2 size={15} className="text-primary" />
                    {selectedBranchObj?.name ?? "Branch"} Overview
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Operating unit details and performance</p>
                </div>
              </CardHeader>
              <CardContent>
                {multiCityLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                      <span className="text-xs text-muted-foreground">Operating Model</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {selectedBranchObj?.isCompanyOperated ? "COCO (Company Operated)" : "FOFO (Franchise Operated)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                      <span className="text-xs text-muted-foreground">Assigned Personnel</span>
                      <span className="text-xs font-bold text-foreground">
                        {selectedBranchObj?.staffCount ?? 0} Cleaners & Supervisors
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                      <span className="text-xs text-muted-foreground">Today's Fulfillment Rate</span>
                      <span className="text-xs font-bold text-emerald-600">
                        {multiCity?.operational?.overallCompletionRate ?? 0}% Completed
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Branch Operations & Model */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Building2 size={15} className="text-primary" />
                  Branch Model Breakdown
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">COCO vs FOFO operating units</p>
              </div>
            </CardHeader>
            <CardContent>
              {multiCityLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (multiCity?.branchBreakdown ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No branches registered</p>
              ) : (
                <div className="divide-y divide-border">
                  <div className="grid grid-cols-12 text-[11px] font-semibold text-muted-foreground uppercase pb-2">
                    <span className="col-span-4">Branch</span>
                    <span className="col-span-2 text-center">Model</span>
                    <span className="col-span-2 text-right">Subs</span>
                    <span className="col-span-2 text-right">Collected</span>
                    <span className="col-span-2 text-right">Royalty</span>
                  </div>
                  {(multiCity?.branchBreakdown ?? []).map((b: any) => (
                    <div key={b.branchId} className="grid grid-cols-12 items-center py-2.5 text-xs">
                      <div className="col-span-4 pr-1">
                        <p className="font-medium truncate">{b.branchName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{b.cityName}</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                            b.isCompanyOperated
                              ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                              : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          }`}
                        >
                          {b.isCompanyOperated ? "COCO" : "FOFO"}
                        </span>
                      </div>
                      <div className="col-span-2 text-right font-semibold text-foreground">
                        {b.activeSubscriptions}
                      </div>
                      <div className="col-span-2 text-right font-semibold text-primary">
                        ₹{(b.collectedRevenue ?? 0).toLocaleString("en-IN")}
                      </div>
                      <div className="col-span-2 text-right text-[11px] text-muted-foreground">
                        {!b.isCompanyOperated ? (
                          <span title={`${b.commissionPercentage}% partner commission`}>
                            ₹{(b.franchiseeCommission ?? 0).toLocaleString("en-IN")}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Monthly Revenue Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Revenue Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {revLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={revenue?.revenueByPeriod ?? []}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke={ADMIN_CHART.primary}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Customer Growth & Service Revenue */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Customer growth */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Customer Growth</CardTitle>
            </CardHeader>
            <CardContent>
              {custLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={customers?.customerGrowth ?? []}>
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" name="Total" fill={ADMIN_CHART.primary} radius={ADMIN_CHART.barRadius} />
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
              {revLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={revenue?.revenueByService ?? []}
                      dataKey="revenue"
                      nameKey="serviceName"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                    >
                      {(revenue?.revenueByService ?? []).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Staff Leaderboard & Outstanding Dues */}
        <div className="grid lg:grid-cols-2 gap-5">
          {/* Staff leaderboard */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <Trophy size={15} className="text-primary" />
              <CardTitle className="text-sm font-semibold">Staff Leaderboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(leaderboard ?? []).slice(0, 5).map((s) => (
                <div key={s.staffId} className="flex items-center gap-3 py-1.5" data-testid={`leaderboard-${s.staffId}`}>
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {s.rank}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{s.staffName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.jobsCompleted} jobs · ₹{(s.revenueGenerated ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs font-medium text-primary">
                    <Star size={11} fill="currentColor" />
                    {Number(s.averageRating ?? 0).toFixed(1)}
                  </div>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <p className="text-muted-foreground text-sm text-center py-4">No staff data</p>
              )}
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
                    <p className="font-display font-bold text-lg text-destructive">
                      ₹{(dues.totalDues ?? 0).toLocaleString("en-IN")}
                    </p>
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
                {(dues?.topDebtors ?? []).slice(0, 4).map((d) => (
                  <div key={d.customerId} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{d.customerName}</span>
                    <div className="text-right">
                      <span className="text-destructive font-medium">₹{(d.dueAmount ?? 0).toLocaleString("en-IN")}</span>
                      {(d.daysPastDue ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">({d.daysPastDue}d overdue)</span>
                      )}
                    </div>
                  </div>
                ))}
                {(!dues?.topDebtors || dues.topDebtors.length === 0) && (
                  <p className="text-muted-foreground text-sm text-center py-4">No outstanding dues</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Retention & Plan Status */}
        <Card id="cancelled-plans">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarX size={15} className="text-amber-600" />
              <CardTitle className="text-sm font-semibold">Subscription Retention &amp; Plan Status</CardTitle>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/churned">Full report</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="font-display font-bold text-lg text-foreground">
                  {multiCity?.retention?.newCustomersThisMonth ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">New Customers (Month)</p>
              </div>
              <div className="bg-amber-500/10 rounded-lg p-3 text-center border border-amber-500/20">
                <p className="font-display font-bold text-lg text-amber-500">
                  {multiCity?.retention?.renewalsDueThisMonth ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Renewals Due (&le; 3 cleanings)</p>
              </div>
              <div className="bg-rose-500/10 rounded-lg p-3 text-center border border-rose-500/20">
                <p className="font-display font-bold text-lg text-rose-500">
                  {multiCity?.retention?.cancelledSubscriptionsThisMonth ?? 0}
                </p>
                <p className="text-[11px] text-muted-foreground">Cancelled (Month)</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Service plans that ended — daily cleaning cancelled, solar AMC expired, wash packages not renewed.
            </p>
            {plansLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : cancelledPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No cancelled or expired plans in this period.</p>
            ) : (
              <div className="space-y-2">
                {cancelledPlans.slice(0, 5).map((row: { id: number; customerName?: string; planName?: string }) => (
                  <div key={row.id} className="flex justify-between text-sm border border-border rounded-lg px-3 py-2">
                    <span className="font-medium">{row.customerName ?? "Customer"}</span>
                    <span className="text-muted-foreground text-xs">{row.planName ?? "Plan ended"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
