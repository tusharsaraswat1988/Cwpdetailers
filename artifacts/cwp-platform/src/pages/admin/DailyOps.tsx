import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/layout/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Play, RefreshCw, AlertTriangle, Pause, Users, Car,
  Clock, CheckCircle2, MoreHorizontal,
} from "lucide-react";
import { CompletionRing } from "@/components/shared/CompletionRing";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "wouter";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DailyOpsSummary = {
  date: string;
  istWeekday: number;
  isOffDay: boolean;
  offDays: number[];
  activeDailyContracts: number;
  pausedDailyContracts: number;
  todayDailyBookings: Array<{
    id: number;
    customerId: number;
    customerName: string | null;
    staffId: number | null;
    vehicleId: number | null;
    status: string;
    scheduledTime: string | null;
    subscriptionId: number | null;
  }>;
  unassignedVehicles: Array<{
    subscriptionId: number;
    customerId: number;
    customerName: string | null;
    vehicleId: number | null;
    registrationNumber: string | null;
  }>;
  dueWashes: Array<{
    subscriptionId: number;
    customerId: number;
    customerName: string | null;
    type: string;
    daysOverdue: number;
    nextDueDate: string | null;
  }>;
  schedulerPreview: {
    date: string;
    isOffDay: boolean;
    eligible: number;
    blocked: Array<{ subscriptionId: number; reason: string }>;
  };
};

async function fetchDailyOps(): Promise<DailyOpsSummary> {
  const res = await fetch("/api/subscriptions/daily-ops", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load daily ops");
  return res.json();
}

async function runDailySchedule() {
  const res = await fetch("/api/subscriptions/daily-schedule", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Schedule failed");
  }
  return res.json();
}

async function runDailyTick(force = false) {
  const res = await fetch("/api/subscriptions/daily-tick", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Daily tick failed");
  }
  return res.json();
}

const reasonLabel: Record<string, string> = {
  no_staff_assigned: "No staff assigned",
  insufficient_balance: "Insufficient balance",
  no_vehicle: "No vehicle linked",
  zero_balance_paused: "Zero balance — paused",
  insufficient_balance_paused: "Low balance — paused",
};

export default function AdminDailyOps() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["daily-ops"],
    queryFn: fetchDailyOps,
    refetchInterval: 60000,
  });

  const scheduleMutation = useMutation({
    mutationFn: runDailySchedule,
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["daily-ops"] });
      toast({
        title: "Daily schedule run complete",
        description: `Created ${result.created ?? 0} bookings, skipped ${result.skipped ?? 0}, paused ${result.paused ?? 0}`,
      });
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const tickMutation = useMutation({
    mutationFn: () => runDailyTick(true),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["daily-ops"] });
      if (result.skipped) {
        toast({ title: "Daily tick skipped (already ran recently)" });
      } else {
        toast({
          title: "Full daily tick complete",
          description: `Scheduler created ${result.scheduler?.created ?? 0} bookings`,
        });
      }
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const offDayNames = (data?.offDays ?? [3]).map((d) => WEEKDAYS[d]).join(", ");

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* QW-08: Header — actions demoted to overflow menu */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display font-bold text-2xl">Daily Cleaning</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Automated scheduling · {isFetching ? "Refreshing…" : "Auto-refresh every 60s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} data-testid="btn-refresh-daily-ops">
              <RefreshCw size={14} className={`mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {/* QW-08: Trigger buttons demoted to overflow dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="btn-daily-ops-actions">
                  <MoreHorizontal size={14} className="mr-1.5" /> Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending || data?.isOffDay}
                  data-testid="btn-run-daily-schedule"
                >
                  <Play size={13} className="mr-2 text-primary" />
                  {scheduleMutation.isPending ? "Running…" : "Run today's schedule"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => tickMutation.mutate()}
                  disabled={tickMutation.isPending}
                  data-testid="btn-run-daily-tick"
                >
                  <Calendar size={13} className="mr-2 text-muted-foreground" />
                  {tickMutation.isPending ? "Running…" : "Full daily tick"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : data && (
          <>
            {data.isOffDay && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20" data-testid="off-day-banner">
                <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Weekly off day — no auto-scheduling today</p>
                  <p className="text-xs text-muted-foreground">
                    Off days: {offDayNames} · Today is {WEEKDAYS[data.istWeekday]}
                  </p>
                </div>
              </div>
            )}

            {/* QW-07 / QW-09: CompletionRing hero + standardized stat chips */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Completion ring for today */}
              {(() => {
                const completed = data.todayDailyBookings.filter(b => b.status === "completed").length;
                const total = data.todayDailyBookings.length;
                return total > 0 ? (
                  <div className="flex items-center gap-3 bg-card border border-border rounded-xl p-4">
                    <CompletionRing value={completed} max={total} size={64} label="done" />
                    <div>
                      <p className="font-display font-bold text-lg">{completed}/{total}</p>
                      <p className="text-xs text-muted-foreground">Today's washes</p>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="flex flex-wrap gap-3 flex-1">
                {/* Green = good */}
                <Card data-testid="stat-active-daily" className="flex-1 min-w-[120px]">
                  <CardContent className="p-4">
                    <CheckCircle2 size={15} className="text-green-500 mb-1" />
                    <p className="font-display font-bold text-2xl">{data.activeDailyContracts}</p>
                    <p className="text-xs text-muted-foreground">Active contracts</p>
                  </CardContent>
                </Card>
                {/* Amber = warning */}
                <Card data-testid="stat-paused-daily" className="flex-1 min-w-[120px]">
                  <CardContent className="p-4">
                    <Pause size={15} className="text-amber-500 mb-1" />
                    <p className="font-display font-bold text-2xl">{data.pausedDailyContracts}</p>
                    <p className="text-xs text-muted-foreground">Paused (low balance)</p>
                  </CardContent>
                </Card>
                {/* Primary = informational */}
                <Card data-testid="stat-today-bookings" className="flex-1 min-w-[120px]">
                  <CardContent className="p-4">
                    <Calendar size={15} className="text-primary mb-1" />
                    <p className="font-display font-bold text-2xl">{data.todayDailyBookings.length}</p>
                    <p className="text-xs text-muted-foreground">Today's bookings</p>
                  </CardContent>
                </Card>
                {/* Red = action needed if blockers exist */}
                <Card data-testid="stat-eligible" className="flex-1 min-w-[120px]">
                  <CardContent className="p-4">
                    <Clock size={15} className={data.schedulerPreview.blocked.length > 0 ? "text-destructive mb-1" : "text-primary mb-1"} />
                    <p className="font-display font-bold text-2xl">{data.schedulerPreview.eligible}</p>
                    <p className="text-xs text-muted-foreground">
                      Eligible
                      {data.schedulerPreview.blocked.length > 0 && (
                        <span className="text-destructive ml-1">({data.schedulerPreview.blocked.length} blocked)</span>
                      )}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar size={16} className="text-primary" />
                    Today's daily cleaning ({data.date})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.todayDailyBookings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No daily cleaning bookings for today</p>
                  ) : (
                    <div className="space-y-2">
                      {data.todayDailyBookings.map((b) => (
                        <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border border-border" data-testid={`daily-booking-${b.id}`}>
                          <div>
                            <p className="text-sm font-medium">{b.customerName ?? `Customer #${b.customerId}`}</p>
                            <p className="text-xs text-muted-foreground">
                              Staff #{b.staffId ?? "—"} · {b.scheduledTime ?? "09:00"}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">{b.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car size={16} className="text-amber-500" />
                    Unassigned vehicles ({data.unassignedVehicles.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.unassignedVehicles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">All active daily contracts have staff assigned</p>
                  ) : (
                    <div className="space-y-2">
                      {data.unassignedVehicles.map((v) => (
                        <div key={v.subscriptionId} className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                          <div>
                            <p className="text-sm font-medium">{v.customerName ?? `Customer #${v.customerId}`}</p>
                            <p className="text-xs text-muted-foreground">{v.registrationNumber ?? `Vehicle #${v.vehicleId}`}</p>
                          </div>
                          <Link href={`/admin/customers/${v.customerId}`}>
                            <Button size="sm" variant="outline" className="text-xs">Assign staff</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle size={16} className="text-destructive" />
                    Due washes ({data.dueWashes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.dueWashes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No overdue package/AMC washes</p>
                  ) : (
                    <div className="space-y-2">
                      {data.dueWashes.slice(0, 10).map((d) => (
                        <div key={d.subscriptionId} className="flex items-center justify-between p-3 rounded-lg border border-border">
                          <div>
                            <p className="text-sm font-medium">{d.customerName ?? `Customer #${d.customerId}`}</p>
                            <p className="text-xs text-muted-foreground capitalize">{d.type?.replace(/_/g, " ")} · due {d.nextDueDate}</p>
                          </div>
                          <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                            {d.daysOverdue}d overdue
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users size={16} className="text-muted-foreground" />
                    Scheduler blockers ({data.schedulerPreview.blocked.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data.schedulerPreview.blocked.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No blockers — all eligible contracts ready</p>
                  ) : (
                    <div className="space-y-2">
                      {data.schedulerPreview.blocked.map((b) => (
                        <div key={b.subscriptionId} className="flex items-center justify-between p-2 rounded-lg border border-border text-sm">
                          <span>Sub #{b.subscriptionId}</span>
                          <Badge variant="outline" className="text-xs">{reasonLabel[b.reason] ?? b.reason}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
