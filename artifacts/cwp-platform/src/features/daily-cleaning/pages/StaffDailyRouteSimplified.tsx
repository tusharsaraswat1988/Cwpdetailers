import { useState, useMemo, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useStaffDailyRoute } from "../api";
import { fetchWalkInDcmsStop } from "@/features/staff-walk-in/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  CheckCircle,
  Navigation,
  MapPinOff,
  RotateCcw,
  AlertTriangle,
  Clock,
  Sparkles,
  Building2,
  Search,
  X,
  Copy,
  Check,
  MoreVertical,
  Filter,
} from "lucide-react";
import { staffVisitLabel } from "../lib/visitLabels";
import { buildNavigateUrl, openExternalNavigation } from "@/lib/maps";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import {
  StaffVehicleCleanDialog,
  type CleanDialogStop,
} from "../components/StaffVehicleCleanDialog";
import {
  StaffExecutionActionsSheet,
} from "../components/StaffExecutionActionsSheet";
import {
  getDcmsDayStore,
  saveDcmsLocalRecord,
  localStatusToRouteStopStatus,
  type DcmsLocalRecord,
} from "../lib/dcmsLocalStorage";

export type RouteStop = {
  subscriptionId: number;
  customerId?: number;
  vehicleId?: number;
  routeOrder?: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  todayStatus: "pending" | "completed" | "missed" | "rejected" | "car_not_available";
  remainingCleanings: number;
  remainingWashes?: number;
  location?: { latitude: number; longitude: number; radiusMeters?: number } | null;
  address?: string | null;
  locationLabel?: string | null;
  societyName?: string | null;
  towerName?: string | null;
  flatNumber?: string | null;
  parkingLevel?: string | null;
  parkingBay?: string | null;
  parkingNotes?: string | null;
  destinationType?: "coordinates" | "address" | "missing";
  localActionLabel?: string | null;
};

export function computeRouteStats(stops: Array<{ todayStatus: string }>) {
  const total = stops.length;
  const completed = stops.filter(s => s.todayStatus === "completed").length;
  const pending = stops.filter(
    s => s.todayStatus === "pending" || s.todayStatus === "rejected",
  ).length;
  const notAvailable = stops.filter(s => s.todayStatus === "car_not_available").length;
  return { total, completed, pending, notAvailable };
}

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: staffVisitLabel("pending"),
    className: "bg-amber-500/15 text-amber-800 border-amber-500/30",
  },
  completed: {
    label: staffVisitLabel("completed"),
    className: "bg-green-600 text-white border-green-700",
  },
  car_not_available: {
    label: staffVisitLabel("car_not_available"),
    className: "bg-orange-500/15 text-orange-900 border-orange-500/30",
  },
  rejected: {
    label: staffVisitLabel("rejected"),
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
  missed: {
    label: staffVisitLabel("missed"),
    className: "bg-muted text-muted-foreground border-border",
  },
};

type FilterTab = "all" | "pending" | "completed" | "exceptions";

export function StaffDailyRouteSimplified() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(searchParams);
  const walkInMode = params.get("walkIn") === "1";
  const walkInSubscriptionId = params.get("subscriptionId");
  const walkInVisitType = params.get("visitType") === "wash" ? "wash" : "cleaning";

  const { data, isLoading, isError, error, refetch } = useStaffDailyRoute(undefined, {
    enabled: !walkInMode,
  });

  const walkInStopQuery = useQuery({
    queryKey: ["walk-in-dcms-stop", walkInSubscriptionId, walkInVisitType],
    queryFn: () => fetchWalkInDcmsStop(Number(walkInSubscriptionId), walkInVisitType),
    enabled: walkInMode && walkInSubscriptionId != null && Number.isFinite(Number(walkInSubscriptionId)),
  });

  // Dialog & Action Sheet state
  const [selectedCleanStop, setSelectedCleanStop] = useState<CleanDialogStop | null>(null);
  const [selectedActionStop, setSelectedActionStop] = useState<CleanDialogStop | null>(null);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Local storage optimistic records
  const staffId = user?.staffId ?? null;
  const [localRecords, setLocalRecords] = useState<Record<number, DcmsLocalRecord>>({});

  useEffect(() => {
    if (staffId) {
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }
  }, [staffId]);

  const rawRouteStops = (data?.stops ?? []) as RouteStop[];
  const walkInStop = walkInStopQuery.data;

  // Merge server stops with local storage records for field resilience
  const stops: RouteStop[] = useMemo(() => {
    const sourceStops: RouteStop[] = walkInMode && walkInStop
      ? [
          {
            subscriptionId: walkInStop.subscriptionId,
            customerId: walkInStop.customerId,
            vehicleId: walkInStop.vehicleId,
            customerName: walkInStop.customerName,
            vehicleNumber: walkInStop.vehicleNumber,
            vehicleMake: walkInStop.vehicleMake,
            vehicleModel: walkInStop.vehicleModel,
            todayStatus: walkInStop.todayStatus,
            remainingCleanings: walkInStop.remainingCleanings,
            remainingWashes: walkInStop.remainingWashes,
          },
        ]
      : rawRouteStops;

    return sourceStops.map(s => {
      const local = localRecords[s.subscriptionId];
      if (!local) return s;

      return {
        ...s,
        todayStatus: localStatusToRouteStopStatus(local.status),
        localActionLabel: local.actionLabel,
      };
    });
  }, [walkInMode, walkInStop, rawRouteStops, localRecords]);

  const stats = useMemo(() => computeRouteStats(stops), [stops]);
  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const visitType = walkInMode ? walkInVisitType : "cleaning";

  // Filter and search
  const filteredStops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return stops.filter(s => {
      // Status filter
      if (filterTab === "pending" && s.todayStatus !== "pending" && s.todayStatus !== "rejected") {
        return false;
      }
      if (filterTab === "completed" && s.todayStatus !== "completed") {
        return false;
      }
      if (filterTab === "exceptions" && s.todayStatus !== "car_not_available") {
        return false;
      }

      // Search query (matches plate, customer name, make, model, society, or parking bay)
      if (q) {
        const matchPlate = s.vehicleNumber.toLowerCase().includes(q);
        const matchCustomer = s.customerName.toLowerCase().includes(q);
        const matchModel = `${s.vehicleMake} ${s.vehicleModel}`.toLowerCase().includes(q);
        const matchSociety = (s.societyName ?? "").toLowerCase().includes(q);
        const matchBay = (s.parkingBay ?? "").toLowerCase().includes(q);
        return matchPlate || matchCustomer || matchModel || matchSociety || matchBay;
      }

      return true;
    });
  }, [stops, searchQuery, filterTab]);

  // Find next pending task with location for quick hero navigation
  const nextPendingStop = useMemo(() => {
    return stops.find(s => s.todayStatus === "pending" || s.todayStatus === "rejected");
  }, [stops]);

  const handleCopyLocation = (e: React.MouseEvent, stop: RouteStop) => {
    e.stopPropagation();
    const locText = [
      stop.societyName,
      stop.towerName && `Tower ${stop.towerName}`,
      stop.flatNumber && `Flat ${stop.flatNumber}`,
      stop.parkingLevel,
      stop.parkingBay && `Bay ${stop.parkingBay}`,
      stop.address,
    ]
      .filter(Boolean)
      .join(", ");

    if (!locText) return;
    navigator.clipboard.writeText(locText);
    setCopiedId(stop.subscriptionId);
    toast({ title: "Address copied", description: locText });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuccessfulClean = () => {
    if (staffId && selectedCleanStop) {
      saveDcmsLocalRecord(staffId, {
        subscriptionId: selectedCleanStop.subscriptionId,
        vehicleNumber: selectedCleanStop.vehicleNumber,
        status: "completed",
        actionLabel: "Car Found — Cleaning Completed",
      });
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }

    if (walkInMode) {
      navigate("/staff/bookings?walkInSuccess=1");
    } else {
      void refetch();
    }
  };

  const handleSuccessfulException = () => {
    if (staffId) {
      const store = getDcmsDayStore(staffId);
      setLocalRecords(store.records);
    }

    if (walkInMode) {
      navigate("/staff/bookings?walkInSuccess=1");
    } else {
      void refetch();
    }
  };

  if (!user?.staffId) {
    return (
      <StaffAccountGate scopeLoading={false} missingStaffLink={!user?.staffId} staffId={user?.staffId ?? null}>
        {null}
      </StaffAccountGate>
    );
  }

  if (walkInMode ? walkInStopQuery.isLoading : isLoading) {
    return (
      <div className="py-12 text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm font-medium text-muted-foreground">Route load ho rahi hai…</p>
      </div>
    );
  }

  if (!walkInMode && isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <p className="text-sm text-destructive font-medium">
          {(error as Error)?.message || "Daily route load nahi ho payi."}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          Dobara try karein
        </Button>
      </div>
    );
  }

  if (walkInMode && walkInStopQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive font-medium">
        Walk-in visit load nahi ho payi. Bookings se dubara try karein.
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center space-y-2">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">Aaj koi daily clean assignment nahi</p>
        <p className="text-xs text-muted-foreground">Jab assignment add hoga, yahan cars list dikhegi.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24" data-testid="staff-daily-route-container">
      {walkInMode && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>Walk-in visit — wahi daily clean workflow use karo jo assigned jobs mein hai.</span>
        </div>
      )}

      {/* TOP PROGRESS SUMMARY BANNER WITH PROGRESS BAR */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3 staff-elevated">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {walkInMode ? "Walk-in Job" : (data?.date ?? "Today")}
          </span>
          <span className="font-bold text-foreground">
            {stats.completed} / {stats.total} Cleaned ({progressPercent}%)
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center pt-1">
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={cn(
              "rounded-xl p-1.5 sm:p-2 transition-all",
              filterTab === "all" ? "bg-muted border border-border/80 ring-2 ring-primary/20" : "bg-muted/40 hover:bg-muted/70"
            )}
          >
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight truncate">Total</p>
            <p className="text-base sm:text-lg font-bold font-display text-foreground mt-0.5">{stats.total}</p>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("completed")}
            className={cn(
              "rounded-xl p-1.5 sm:p-2 transition-all",
              filterTab === "completed"
                ? "bg-green-500/20 border border-green-500/40 ring-2 ring-green-500/20"
                : "bg-green-500/10 border border-green-500/20 hover:bg-green-500/15"
            )}
          >
            <p className="text-[10px] text-green-800 dark:text-green-300 font-semibold uppercase tracking-tight truncate">Cleaned</p>
            <p className="text-base sm:text-lg font-bold font-display text-green-700 dark:text-green-300 mt-0.5">{stats.completed}</p>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("pending")}
            className={cn(
              "rounded-xl p-1.5 sm:p-2 transition-all",
              filterTab === "pending"
                ? "bg-amber-500/20 border border-amber-500/40 ring-2 ring-amber-500/20"
                : "bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15"
            )}
          >
            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold uppercase tracking-tight truncate">Pending</p>
            <p className="text-base sm:text-lg font-bold font-display text-amber-700 dark:text-amber-300 mt-0.5">{stats.pending}</p>
          </button>

          <button
            type="button"
            onClick={() => setFilterTab("exceptions")}
            className={cn(
              "rounded-xl p-1.5 sm:p-2 transition-all",
              filterTab === "exceptions"
                ? "bg-orange-500/20 border border-orange-500/40 ring-2 ring-orange-500/20"
                : "bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/15"
            )}
          >
            <p className="text-[10px] text-orange-800 dark:text-orange-300 font-semibold uppercase tracking-tight truncate">Exceptions</p>
            <p className="text-base sm:text-lg font-bold font-display text-orange-700 dark:text-orange-300 mt-0.5">{stats.notAvailable}</p>
          </button>
        </div>
      </div>

      {/* QUICK "NAVIGATE TO NEXT TASK" HERO (IF PENDING TASKS EXIST) */}
      {!walkInMode && nextPendingStop && (
        <div
          className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 flex items-center justify-between gap-3"
          data-testid="dcms-next-pending-hero"
        >
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Next Task
            </span>
            <p className="text-sm font-bold text-foreground truncate mt-0.5">
              {nextPendingStop.vehicleNumber} • {nextPendingStop.customerName}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {nextPendingStop.societyName || "Apartment"}
              {nextPendingStop.parkingBay ? ` • Bay ${nextPendingStop.parkingBay}` : ""}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {nextPendingStop.address && (
              <a
                href={buildNavigateUrl({
                  latitude: nextPendingStop.location?.latitude,
                  longitude: nextPendingStop.location?.longitude,
                  address: nextPendingStop.address,
                })}
                target="_blank"
                rel="noreferrer"
                className="h-9 px-3 rounded-xl border border-primary/30 bg-primary/10 text-xs font-semibold text-primary inline-flex items-center gap-1.5 hover:bg-primary/20"
              >
                <Navigation size={13} />
                <span className="hidden sm:inline">Directions</span>
              </a>
            )}

            <Button
              size="sm"
              className="h-9 px-3 text-xs font-semibold"
              onClick={() => setSelectedActionStop(nextPendingStop)}
            >
              <Sparkles size={13} className="mr-1" />
              Action
            </Button>
          </div>
        </div>
      )}

      {/* SEARCH AND FILTER BAR */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by plate number (e.g. 1234), customer, bay..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9.5 pr-8 h-11 text-xs rounded-xl bg-card border-border/80 shadow-none focus-visible:ring-1 focus-visible:ring-primary"
            data-testid="dcms-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* FILTER PILLS */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: "all", label: `All (${stops.length})` },
            { id: "pending", label: `Pending (${stats.pending})` },
            { id: "completed", label: `Cleaned (${stats.completed})` },
            { id: "exceptions", label: `Exceptions (${stats.notAvailable})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id as FilterTab)}
              className={cn(
                "px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-colors",
                filterTab === tab.id
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER EMPTY STATE */}
      {filteredStops.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Koi gaadi match nahi hui</p>
          <p className="text-[11px] text-muted-foreground">Search filter badal kar dobara dekhein.</p>
          {searchQuery && (
            <Button variant="ghost" size="sm" className="text-xs h-8 mt-1" onClick={() => setSearchQuery("")}>
              Clear Search
            </Button>
          )}
        </div>
      )}

      {/* VERTICALLY SCROLLABLE ROUTE LIST */}
      <div className="space-y-3" data-testid="dcms-daily-route-list">
        {filteredStops.map((stop, idx) => {
          const navUrl = buildNavigateUrl({
            latitude: stop.location?.latitude,
            longitude: stop.location?.longitude,
            address: stop.address,
          });

          const isCompleted = stop.todayStatus === "completed";
          const isNotAvailable = stop.todayStatus === "car_not_available";
          const isPending = stop.todayStatus === "pending" || stop.todayStatus === "rejected";
          const badge = statusBadgeConfig[stop.todayStatus] ?? {
            label: stop.todayStatus,
            className: "bg-muted text-muted-foreground",
          };

          return (
            <div
              key={stop.subscriptionId}
              className={cn(
                "rounded-2xl border bg-card p-4 space-y-3 shadow-sm transition-all staff-elevated",
                isCompleted && "border-green-500/30 bg-green-500/[0.02]",
                isNotAvailable && "border-orange-500/30 bg-orange-500/[0.02]",
                isPending && "border-border hover:border-primary/40",
              )}
              data-testid={`dcms-vehicle-card-${stop.subscriptionId}`}
            >
              {/* TOP HEADER: STOP #, VEHICLE NUMBER, STATUS BADGE */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      #{idx + 1}
                    </span>
                    <h3 className="font-display font-bold text-xl tracking-tight text-foreground truncate">
                      {stop.vehicleNumber}
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                    {stop.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {stop.vehicleMake} {stop.vehicleModel}
                    {stop.vehicleColor ? ` · ${stop.vehicleColor}` : ""}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge variant="outline" className={cn("font-medium text-xs", badge.className)}>
                    {badge.label}
                  </Badge>
                  {stop.localActionLabel && (
                    <span className="text-[10px] text-muted-foreground italic max-w-[120px] truncate text-right">
                      {stop.localActionLabel}
                    </span>
                  )}
                </div>
              </div>

              {/* SOCIETY / TOWER / PARKING BAY DETAILS */}
              {(stop.societyName || stop.towerName || stop.parkingBay || stop.flatNumber) && (
                <div className="flex items-center justify-between gap-1.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-950 dark:text-blue-200">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                    <span className="font-bold">{stop.societyName || "Apartment"}</span>
                    {stop.towerName && <span className="font-medium">• {stop.towerName}</span>}
                    {stop.flatNumber && <span>• Flat {stop.flatNumber}</span>}
                    {stop.parkingLevel && <span>• {stop.parkingLevel}</span>}
                    {stop.parkingBay && (
                      <Badge variant="outline" className="bg-primary text-white font-mono text-[11px] px-2 py-0.5 border-0">
                        Bay: {stop.parkingBay}
                      </Badge>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={e => handleCopyLocation(e, stop)}
                    className="shrink-0 p-1 text-blue-700 hover:text-blue-900 rounded"
                    title="Copy Location"
                  >
                    {copiedId === stop.subscriptionId ? (
                      <Check size={13} className="text-emerald-600" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              )}

              {/* LOCATION / DIRECTIONS ACTION */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                {navUrl ? (
                  <a
                    href={navUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      if (Capacitor.isNativePlatform()) {
                        e.preventDefault();
                        openExternalNavigation(navUrl);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline h-8 px-2.5 rounded-lg bg-primary/10 border border-primary/20 shrink-0 text-xs"
                    data-testid={`dcms-navigate-${stop.subscriptionId}`}
                  >
                    <Navigation className="h-3.5 w-3.5 text-primary" />
                    <span>Directions</span>
                    {stop.address && (
                      <span className="text-[11px] text-muted-foreground font-normal max-w-[150px] truncate hidden sm:inline">
                        · {stop.address}
                      </span>
                    )}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1 text-muted-foreground/80 italic text-[11px]">
                    <MapPinOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                    Location nahi mili
                  </span>
                )}

                {stop.remainingCleanings > 0 && (
                  <span className="text-muted-foreground text-[11px]">
                    {stop.remainingCleanings} cleans left
                  </span>
                )}
              </div>

              {/* CONTEXTUAL ACTION BUTTONS */}
              {isPending ? (
                <div className="flex gap-2 pt-1">
                  <Button
                    className="flex-1 min-h-[2.75rem] h-auto py-2.5 px-3 text-sm font-semibold"
                    onClick={() => setSelectedCleanStop(stop)}
                    data-testid={`dcms-clean-btn-${stop.subscriptionId}`}
                  >
                    <Camera className="mr-1.5 h-4 w-4 shrink-0" />
                    Clean karein
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-[2.75rem] h-auto py-2.5 px-3 text-xs font-semibold border-border hover:bg-muted"
                    onClick={() => setSelectedActionStop(stop)}
                    data-testid={`dcms-action-sheet-btn-${stop.subscriptionId}`}
                  >
                    <MoreVertical className="h-4 w-4 shrink-0" />
                    <span className="hidden sm:inline ml-1">Options</span>
                  </Button>
                </div>
              ) : isNotAvailable ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-1.5 text-xs font-medium rounded-xl py-2 px-3 text-orange-900 bg-orange-500/10 border border-orange-500/20">
                    <span className="flex items-center gap-1.5 truncate">
                      <AlertTriangle size={14} className="text-orange-700 shrink-0" />
                      <span className="truncate">{stop.localActionLabel || "Car nahi mili — visit recorded"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedActionStop(stop)}
                      className="text-[11px] text-orange-800 underline font-semibold shrink-0"
                    >
                      Change
                    </button>
                  </div>
                  {visitType === "cleaning" && (
                    <Button
                      variant="outline"
                      className="w-full h-10 text-xs font-semibold border-green-600/30 text-green-800 bg-green-500/5 hover:bg-green-500/15"
                      onClick={() => setSelectedCleanStop(stop)}
                      data-testid={`dcms-recovery-btn-${stop.subscriptionId}`}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-green-700" />
                      Car mil gayi — clean karein
                    </Button>
                  )}
                </div>
              ) : isCompleted ? (
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-800 text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle size={15} className="text-green-600" />
                    Clean completed
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedActionStop(stop)}
                    className="text-[11px] text-green-800 underline font-semibold"
                  >
                    Options
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* CONTEXTUAL ACTION BOTTOM SHEET / DIALOG */}
      <StaffExecutionActionsSheet
        open={Boolean(selectedActionStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedActionStop(null);
        }}
        stop={selectedActionStop}
        staffId={staffId}
        walkInMode={walkInMode}
        onStartClean={(targetStop) => {
          setSelectedCleanStop(targetStop);
        }}
        onSuccess={handleSuccessfulException}
      />

      {/* GUIDED CLEANING WORKFLOW MODAL */}
      <StaffVehicleCleanDialog
        open={Boolean(selectedCleanStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedCleanStop(null);
        }}
        stop={selectedCleanStop}
        visitType={visitType}
        walkInMode={walkInMode}
        onSuccess={handleSuccessfulClean}
      />
    </div>
  );
}
