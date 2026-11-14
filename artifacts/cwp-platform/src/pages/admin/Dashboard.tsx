import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import AdminLayout from "@/components/layout/AdminLayout";
import { PageActionHeader } from "@/components/layout/PageActionHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/lib/store";
import { operationsApi, type CommandCenterData, type ImmediateAttentionItem } from "@/lib/operations/api";
import {
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  Users,
  CreditCard,
  Building2,
  MapPin,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  Phone,
  Sparkles,
  TrendingUp,
  XCircle,
  Truck,
  ExternalLink,
  Receipt,
  UserX,
  ListTodo,
} from "lucide-react";

export default function AdminDashboard() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { activeCityId, activeBranchId, setActiveCity, setActiveBranch, clearScope } = useAppStore();

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);

  // Fetch Cities and Branches for dynamic filter
  const { data: cities = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/masters/cities"],
    queryFn: async () => {
      const res = await fetch("/api/masters/cities", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json?.data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: branches = [] } = useQuery<{ id: number; name: string; cityId?: number | null }[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches", { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json?.data ?? [];
    },
    staleTime: 60_000,
  });

  // Query authoritative Operations Command Center data
  const {
    data: ops,
    isLoading,
    isRefetching,
    refetch,
    dataUpdatedAt,
  } = useQuery<CommandCenterData>({
    queryKey: ["operations-command-center", date, activeCityId, activeBranchId],
    queryFn: () =>
      operationsApi.getCommandCenter({
        date,
        cityId: activeCityId ?? undefined,
        branchId: activeBranchId ?? undefined,
        autoScan: true,
      }),
    refetchInterval: 30_000, // Resilient 30s background polling
  });

  const handleCityChange = (val: string) => {
    if (val === "all") {
      clearScope();
    } else {
      setActiveCity(Number(val));
    }
  };

  const handleBranchChange = (val: string) => {
    if (val === "all") {
      setActiveBranch(null);
    } else {
      const branch = branches.find((b) => b.id === Number(val));
      setActiveBranch(Number(val), branch?.cityId ?? null);
    }
  };

  // Filter branches based on selected city if any
  const availableBranches = useMemo(() => {
    if (!activeCityId) return branches;
    return branches.filter((b) => b.cityId === activeCityId);
  }, [branches, activeCityId]);

  const metrics = ops?.metrics;
  const immediateAttention = ops?.immediateAttention ?? [];
  const cityPerformance = ops?.cityPerformance ?? [];
  const staffNeedingIntervention = ops?.staffNeedingIntervention ?? [];
  const breakdown = ops?.servicesBreakdown;
  const recentActivity = ops?.recentLiveActivity ?? [];

  const lastRefreshedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--";

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6" data-testid="operations-command-center">
        {/* Command Center Header with Dynamic Scope Filter & Refresh */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/70">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Operations Command Center
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Live operational triage, service execution intelligence & real-time city performance
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Dynamic City Filter */}
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1 shadow-sm">
              <MapPin size={13} className="text-primary shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">City:</span>
              <Select value={activeCityId ? String(activeCityId) : "all"} onValueChange={handleCityChange}>
                <SelectTrigger className="h-7 w-[120px] sm:w-[140px] text-xs font-medium border-0 shadow-none px-1 bg-transparent">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {cities.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Branch Filter */}
            <div className="flex items-center gap-1.5 bg-card border border-border rounded-lg px-2.5 py-1 shadow-sm">
              <Building2 size={13} className="text-primary shrink-0" />
              <span className="text-xs font-semibold text-muted-foreground hidden sm:inline">Branch:</span>
              <Select value={activeBranchId ? String(activeBranchId) : "all"} onValueChange={handleBranchChange}>
                <SelectTrigger className="h-7 w-[130px] sm:w-[150px] text-xs font-medium border-0 shadow-none px-1 bg-transparent">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {availableBranches.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Refresh & Live Timestamp */}
            <div className="flex items-center gap-2 pl-1">
              <span className="text-[11px] text-muted-foreground hidden lg:inline">
                Updated {lastRefreshedLabel}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 shadow-sm"
                onClick={() => refetch()}
                disabled={isRefetching}
              >
                <RefreshCw size={13} className={isRefetching ? "animate-spin text-primary" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* 1. What is happening today? — Authoritative Core Metrics */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="command-metrics-grid">
            <Card className="border-border shadow-sm">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Today's Total</span>
                  <Calendar size={14} className="text-primary" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-foreground">
                  {metrics?.totalBookingsToday ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Scheduled & in-flight</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Confirmed</span>
                  <CheckCircle2 size={14} className="text-blue-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                  {metrics?.confirmedBookingsToday ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Ready for execution</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Completed</span>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {metrics?.completedServicesToday ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Bookings + DCMS visits</p>
              </CardContent>
            </Card>

            <Card className={`border shadow-sm ${(metrics?.delayedServicesToday ?? 0) > 0 ? "border-amber-500/50 bg-amber-500/5" : "border-border"}`}>
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Delayed Jobs</span>
                  <Clock size={14} className={(metrics?.delayedServicesToday ?? 0) > 0 ? "text-amber-500" : "text-muted-foreground"} />
                </div>
                <div className={`text-2xl font-bold tracking-tight ${(metrics?.delayedServicesToday ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
                  {metrics?.delayedServicesToday ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Past scheduled slot</p>
              </CardContent>
            </Card>

            <Card className={`border shadow-sm ${(metrics?.unassignedJobsToday ?? 0) > 0 ? "border-red-500/50 bg-red-500/5" : "border-border"}`}>
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Unassigned</span>
                  <UserX size={14} className={(metrics?.unassignedJobsToday ?? 0) > 0 ? "text-red-500" : "text-muted-foreground"} />
                </div>
                <div className={`text-2xl font-bold tracking-tight ${(metrics?.unassignedJobsToday ?? 0) > 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                  {metrics?.unassignedJobsToday ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Missing technician</p>
              </CardContent>
            </Card>

            <Card className="border-border shadow-sm">
              <CardContent className="p-3.5 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                  <span>Open Issues</span>
                  <ShieldAlert size={14} className="text-orange-500" />
                </div>
                <div className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-400">
                  {metrics?.openComplaintsCount ?? 0}
                </div>
                <p className="text-[11px] text-muted-foreground">Complaints + tickets</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Operational Status Stepper Breakdown */}
        {breakdown && (
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between pb-2 text-xs font-semibold text-muted-foreground">
              <span>Operational Service Status</span>
              <span>{metrics?.activeStaffOnField ?? 0} technicians on field</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1 text-center">
              <div className="bg-secondary/60 rounded-lg p-2">
                <p className="text-xs text-muted-foreground">Scheduled</p>
                <p className="text-base font-bold text-foreground">{breakdown.scheduled}</p>
              </div>
              <div className="bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-lg p-2">
                <p className="text-xs">Assigned</p>
                <p className="text-base font-bold">{breakdown.assigned}</p>
              </div>
              <div className="bg-purple-500/10 text-purple-600 border border-purple-500/20 rounded-lg p-2">
                <p className="text-xs">En Route</p>
                <p className="text-base font-bold">{breakdown.enRoute}</p>
              </div>
              <div className="bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded-lg p-2">
                <p className="text-xs">In Progress</p>
                <p className="text-base font-bold">{breakdown.inProgress}</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-lg p-2">
                <p className="text-xs">Completed</p>
                <p className="text-base font-bold">{breakdown.completed}</p>
              </div>
              <div className="bg-red-500/10 text-red-600 border border-red-500/20 rounded-lg p-2">
                <p className="text-xs">Delayed</p>
                <p className="text-base font-bold">{breakdown.delayed}</p>
              </div>
              <div className="bg-muted text-muted-foreground rounded-lg p-2">
                <p className="text-xs">Cancelled</p>
                <p className="text-base font-bold">{breakdown.cancelled}</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. What requires immediate attention? — Prioritized Operational Triage */}
        <div className="space-y-3" data-testid="immediate-attention-section">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Requires Immediate Attention
              </h2>
              <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
                {immediateAttention.length} urgent items
              </Badge>
            </div>
            <Link href="/admin/exceptions" className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
              View all exceptions <ArrowRight size={12} />
            </Link>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : immediateAttention.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-6 text-center text-muted-foreground text-xs space-y-1">
                <CheckCircle2 size={24} className="mx-auto text-green-500 mb-1" />
                <p className="font-semibold text-foreground text-sm">All Clear!</p>
                <p>No unassigned jobs, delayed services, or critical exceptions currently pending.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {immediateAttention.map((item) => {
                const isCritical = item.severity === "critical";

                return (
                  <Card
                    key={item.id}
                    className={`border transition-all shadow-sm ${
                      isCritical
                        ? "border-red-500/50 bg-red-500/5"
                        : "border-orange-500/40 bg-orange-500/5"
                    }`}
                  >
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold uppercase ${
                            isCritical ? "bg-red-600 text-white" : "bg-orange-500/15 text-orange-700"
                          }`}
                        >
                          {item.type.replace(/_/g, " ")}
                        </Badge>
                        {item.scheduledTime && (
                          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                            <Clock size={11} /> {item.scheduledTime}
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-semibold text-xs sm:text-sm text-foreground line-clamp-1">
                          {item.title}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                        <span className="text-muted-foreground truncate max-w-[140px]">
                          {item.cityName || "All"} {item.branchName ? `· ${item.branchName}` : ""}
                        </span>

                        {item.actionType === "assign" && item.bookingId && (
                          <Link href={`/admin/assign-services?bookingId=${item.bookingId}`}>
                            <Button size="sm" variant="default" className="h-7 text-xs px-2.5">
                              Assign Staff
                            </Button>
                          </Link>
                        )}
                        {item.actionType === "reschedule" && item.bookingId && (
                          <Link href={`/admin/bookings?bookingId=${item.bookingId}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              Reschedule
                            </Button>
                          </Link>
                        )}
                        {item.actionType === "resolve_exception" && (
                          <Link href="/admin/exceptions">
                            <Button size="sm" variant="destructive" className="h-7 text-xs px-2.5">
                              Resolve
                            </Button>
                          </Link>
                        )}
                        {item.actionType === "view_ticket" && (
                          <Link href="/admin/complaints">
                            <Button size="sm" variant="outline" className="h-7 text-xs px-2.5">
                              View Ticket
                            </Button>
                          </Link>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Performance Matrix & Operations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* City & Branch Performance Matrix */}
          <Card className="lg:col-span-2 border-border shadow-sm">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
                    <Building2 size={16} className="text-primary" />
                    City & Branch Operational Performance
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Live completion rates and unassigned load per configured city
                  </CardDescription>
                </div>
                <Link href="/admin/cities" className="text-xs text-primary hover:underline font-medium">
                  Manage Cities →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-3">
              {cityPerformance.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No city performance records</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 font-medium">City</th>
                        <th className="pb-2 font-medium">Total Jobs</th>
                        <th className="pb-2 font-medium">Completion Rate</th>
                        <th className="pb-2 font-medium">Unassigned</th>
                        <th className="pb-2 font-medium">Exceptions</th>
                        <th className="pb-2 font-medium">Staff Active</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {cityPerformance.map((c) => (
                        <tr key={c.cityId} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 font-semibold text-foreground flex items-center gap-1.5">
                            <MapPin size={12} className="text-primary shrink-0" />
                            {c.cityName}
                          </td>
                          <td className="py-2.5 text-foreground">{c.totalBookings}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center gap-1 font-semibold ${c.completionRate >= 80 ? "text-emerald-600" : c.completionRate >= 50 ? "text-amber-600" : "text-muted-foreground"}`}>
                              {c.completionRate}%
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className={c.unassignedCount > 0 ? "font-bold text-red-600 bg-red-500/10 px-1.5 py-0.5 rounded" : "text-muted-foreground"}>
                              {c.unassignedCount}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className={c.openExceptionsCount > 0 ? "font-bold text-orange-600 bg-orange-500/10 px-1.5 py-0.5 rounded" : "text-muted-foreground"}>
                              {c.openExceptionsCount}
                            </span>
                          </td>
                          <td className="py-2.5 text-foreground font-medium">{c.activeStaffCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Staff Intervention Queue & Live Activity */}
          <div className="space-y-4">
            {/* Staff Intervention */}
            <Card className="border-border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <UserCheck size={15} className="text-amber-500" />
                  Staff Needing Intervention
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2.5">
                {staffNeedingIntervention.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    All assigned staff on schedule with zero reported delays.
                  </p>
                ) : (
                  staffNeedingIntervention.map((s) => (
                    <div
                      key={s.staffId}
                      className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-border bg-card"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-foreground">{s.staffName}</p>
                        <p className="text-[11px] text-muted-foreground">{s.primaryIssue}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {s.staffPhone && (
                          <a href={`tel:${s.staffPhone}`}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Call Staff">
                              <Phone size={12} className="text-primary" />
                            </Button>
                          </a>
                        )}
                        <Link href={`/admin/staff/${s.staffId}`}>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] px-2">
                            Profile
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick Nav Shortcuts */}
            <Card className="border-border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2">
                  <ListTodo size={15} className="text-primary" />
                  Operations Shortcuts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 grid grid-cols-2 gap-2 text-xs">
                <Link
                  href="/admin/bookings"
                  className="p-2.5 rounded-lg border border-border hover:border-primary/40 bg-secondary/30 transition-all font-medium flex items-center justify-between"
                >
                  <span>All Bookings</span>
                  <ArrowRight size={12} />
                </Link>
                <Link
                  href="/admin/exceptions"
                  className="p-2.5 rounded-lg border border-border hover:border-primary/40 bg-secondary/30 transition-all font-medium flex items-center justify-between"
                >
                  <span>Exceptions</span>
                  <ArrowRight size={12} />
                </Link>
                <Link
                  href="/admin/complaints"
                  className="p-2.5 rounded-lg border border-border hover:border-primary/40 bg-secondary/30 transition-all font-medium flex items-center justify-between"
                >
                  <span>Support Cases</span>
                  <ArrowRight size={12} />
                </Link>
                <Link
                  href="/admin/quality"
                  className="p-2.5 rounded-lg border border-border hover:border-primary/40 bg-secondary/30 transition-all font-medium flex items-center justify-between"
                >
                  <span>Quality & SLA</span>
                  <ArrowRight size={12} />
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
