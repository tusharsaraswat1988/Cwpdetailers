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
  Sparkles,
  Building2,
  Search,
  X,
  Copy,
  Check,
  MoreVertical,
  CheckCircle2,
  Clock,
} from "lucide-react";
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
  formatIstTime,
  type DcmsLocalRecord,
} from "../lib/dcmsLocalStorage";
import { useStaffLanguage } from "@/lib/staffLanguage";

export type RouteStop = {
  subscriptionId: number;
  customerId?: number;
  vehicleId?: number;
  routeOrder?: number;
  originalSequence?: number;
  completionOrder?: number;
  completedAtTime?: string;
  completedAt?: string;
  isPendingSync?: boolean;
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

export function StaffDailyRouteSimplified() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t, isHindi } = useStaffLanguage();
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
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
  // Preserve original sequence index (#1, #2, #3, ...) for each stop based on initial routeOrder
  const stops: RouteStop[] = useMemo(() => {
    const sourceStops: RouteStop[] = walkInMode && walkInStop
      ? [
          {
            subscriptionId: walkInStop.subscriptionId,
            customerId: walkInStop.customerId,
            vehicleId: walkInStop.vehicleId,
            originalSequence: 1,
            customerName: walkInStop.customerName,
            vehicleNumber: walkInStop.vehicleNumber,
            vehicleMake: walkInStop.vehicleMake,
            vehicleModel: walkInStop.vehicleModel,
            todayStatus: walkInStop.todayStatus,
            remainingCleanings: walkInStop.remainingCleanings,
            remainingWashes: walkInStop.remainingWashes,
          },
        ]
      : rawRouteStops.map((s, idx) => ({
          ...s,
          originalSequence: s.routeOrder && s.routeOrder > 0 ? s.routeOrder : idx + 1,
        }));

    // Calculate server completion orders for cross-device/after-restart persistence
    const serverCompletedStops = sourceStops.filter(s => s.todayStatus === "completed");
    const sortedServerCompleted = [...serverCompletedStops].sort((a, b) => {
      const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return timeA - timeB;
    });
    const serverOrderMap = new Map<number, number>();
    sortedServerCompleted.forEach((s, idx) => {
      serverOrderMap.set(s.subscriptionId, idx + 1);
    });

    return sourceStops.map(s => {
      const local = localRecords[s.subscriptionId];
      if (!local) {
        const sOrder = serverOrderMap.get(s.subscriptionId);
        const sTime = s.completedAt ? formatIstTime(new Date(s.completedAt)) : undefined;
        return {
          ...s,
          completionOrder: s.completionOrder ?? sOrder,
          completedAtTime: s.completedAtTime ?? sTime,
          isPendingSync: false,
        };
      }

      return {
        ...s,
        todayStatus: localStatusToRouteStopStatus(local.status),
        localActionLabel: local.actionLabel,
        completionOrder: local.completionOrder,
        completedAtTime: local.completedAtTime,
        isPendingSync: s.todayStatus === "completed" ? false : local.isPendingSync,
      };
    });
  }, [walkInMode, walkInStop, rawRouteStops, localRecords]);

  const stats = useMemo(() => computeRouteStats(stops), [stops]);
  const progressPercent = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const visitType = walkInMode ? walkInVisitType : "cleaning";

  // Filter by search query
  const queryFilteredStops = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stops;

    return stops.filter(s => {
      const matchPlate = s.vehicleNumber.toLowerCase().includes(q);
      const matchCustomer = s.customerName.toLowerCase().includes(q);
      const matchModel = `${s.vehicleMake} ${s.vehicleModel}`.toLowerCase().includes(q);
      const matchSociety = (s.societyName ?? "").toLowerCase().includes(q);
      const matchBay = (s.parkingBay ?? "").toLowerCase().includes(q);
      return matchPlate || matchCustomer || matchModel || matchSociety || matchBay;
    });
  }, [stops, searchQuery]);

  // Phase 2 & 3: Segregate into Pending and Completed lists
  // Pending section is displayed FIRST (above); Completed section is displayed BELOW
  const pendingStops = useMemo(() => {
    return queryFilteredStops.filter(s => s.todayStatus === "pending" || s.todayStatus === "rejected");
  }, [queryFilteredStops]);

  const completedStops = useMemo(() => {
    return queryFilteredStops.filter(s => s.todayStatus === "completed" || s.todayStatus === "car_not_available");
  }, [queryFilteredStops]);

  // Next pending task for quick directions/action
  const nextPendingStop = pendingStops[0] ?? null;

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
    toast({ title: t("address_copied"), description: locText });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSuccessfulClean = (isQueued?: boolean) => {
    if (staffId && selectedCleanStop) {
      saveDcmsLocalRecord(staffId, {
        subscriptionId: selectedCleanStop.subscriptionId,
        vehicleNumber: selectedCleanStop.vehicleNumber,
        status: "completed",
        actionLabel: isQueued
          ? (isHindi ? "फोन पर सुरक्षित (सिंक पेंडिंग)" : "Saved on phone (sync pending)")
          : (isHindi ? "गाड़ी साफ हुई — कम्प्लीट" : "Car Cleaned — Completed"),
        isPendingSync: Boolean(isQueued),
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
        <p className="text-sm font-medium text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (!walkInMode && isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <p className="text-sm text-destructive font-medium">
          {(error as Error)?.message || t("photo_failed_retry")}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t("retry")}
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
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center space-y-3">
        <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="text-sm font-semibold text-foreground">{t("no_assignments_today")}</p>
        <p className="text-xs text-muted-foreground">{t("no_assignments_desc")}</p>
        <Button variant="outline" size="sm" className="h-9 gap-1.5 mx-auto" onClick={() => void refetch()}>
          <RotateCcw size={13} className={cn(isLoading && "animate-spin")} />
          <span>{isHindi ? "रीफ्रेश करें" : "Refresh"}</span>
        </Button>
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
            {walkInMode ? "Walk-in Job" : t("progress_title")}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">
              {stats.completed} / {stats.total} {t("progress_summary")} ({progressPercent}%)
            </span>
            {!walkInMode && (
              <button
                type="button"
                onClick={() => void refetch()}
                className="p-1 rounded-md hover:bg-muted text-primary staff-tap inline-flex items-center gap-1"
                aria-label="Refresh route"
                title={isHindi ? "रीफ्रेश करें" : "Refresh"}
                data-testid="dcms-refresh-route-btn"
              >
                <RotateCcw size={13} className={cn(isLoading && "animate-spin")} />
              </button>
            )}
          </div>
        </div>

        {/* PROGRESS BAR */}
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* SUMMARY NUMBERS ROW */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1">
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-tight">
              {t("filter_all")}
            </p>
            <p className="text-base font-bold text-foreground mt-0.5">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2">
            <p className="text-[10px] text-amber-800 dark:text-amber-300 font-semibold uppercase tracking-tight">
              {t("filter_pending")}
            </p>
            <p className="text-base font-bold text-amber-700 dark:text-amber-300 mt-0.5">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-2">
            <p className="text-[10px] text-green-800 dark:text-green-300 font-semibold uppercase tracking-tight">
              {t("filter_completed")}
            </p>
            <p className="text-base font-bold text-green-700 dark:text-green-300 mt-0.5">{stats.completed}</p>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("search_plate_placeholder")}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9.5 pr-8 h-12 text-sm rounded-xl bg-card border-border shadow-none focus-visible:ring-1 focus-visible:ring-primary"
          data-testid="dcms-search-input"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: PENDING VEHICLES (DISPLAYED FIRST / ABOVE PER PHASE 2 & 3)     */}
      {/* ========================================================================= */}
      <div className="space-y-3" data-testid="dcms-pending-section">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground font-display">
              {t("pending_vehicles_title")}
            </h2>
            <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold">
              {pendingStops.length}
            </Badge>
          </div>
          {pendingStops.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {isHindi ? "कोई भी गाड़ी चुनकर साफ करें" : "Select any vehicle to clean"}
            </span>
          )}
        </div>

        {pendingStops.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-500/40 bg-emerald-500/5 p-6 text-center space-y-1.5">
            <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
            <p className="text-xs font-bold text-foreground">
              {t("no_pending_vehicles")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingStops.map(stop => {
              const navUrl = buildNavigateUrl({
                latitude: stop.location?.latitude,
                longitude: stop.location?.longitude,
                address: stop.address,
              });

              return (
                <div
                  key={stop.subscriptionId}
                  className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm hover:border-primary/40 transition-all staff-elevated"
                  data-testid={`dcms-vehicle-card-${stop.subscriptionId}`}
                >
                  {/* TOP HEADER: ORIGINAL ASSIGNED SEQUENCE, VEHICLE NUMBER, PENDING BADGE */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-foreground">
                          #{stop.originalSequence ?? 1}
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

                    <Badge variant="outline" className="bg-amber-500/15 text-amber-800 border-amber-500/30 font-medium text-xs">
                      {t("filter_pending")}
                    </Badge>
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
                        title={t("copy_address")}
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
                      >
                        <Navigation className="h-3.5 w-3.5 text-primary" />
                        <span>{t("directions")}</span>
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

                  {/* PRIMARY ACTIONS: 1-TAP CLEAN BUTTON & OPTIONS */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      className="flex-1 h-12 text-sm font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
                      onClick={() => setSelectedCleanStop(stop)}
                      data-testid={`dcms-clean-btn-${stop.subscriptionId}`}
                    >
                      <Camera className="mr-2 h-4 w-4 shrink-0" />
                      {t("complete_cleaning_action")}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 px-3 text-xs font-semibold border-border hover:bg-muted"
                      onClick={() => setSelectedActionStop(stop)}
                      data-testid={`dcms-action-sheet-btn-${stop.subscriptionId}`}
                      title={t("options")}
                    >
                      <MoreVertical className="h-4 w-4 shrink-0" />
                      <span className="hidden sm:inline ml-1">{t("options")}</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: COMPLETED VEHICLES (DISPLAYED SEPARATELY BELOW)               */}
      {/* ========================================================================= */}
      {completedStops.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-border" data-testid="dcms-completed-section">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground font-display">
                {t("completed_vehicles_title")}
              </h2>
              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-bold bg-green-500/15 text-green-800">
                {completedStops.length}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground">
              {isHindi ? "सफाई पूरी हो गई" : "Completed today"}
            </span>
          </div>

          <div className="space-y-3">
            {completedStops.map(stop => {
              const isCleanCompleted = stop.todayStatus === "completed";
              const isNotAvailable = stop.todayStatus === "car_not_available";

              return (
                <div
                  key={stop.subscriptionId}
                  className={cn(
                    "rounded-2xl border p-4 space-y-2.5 shadow-sm transition-all staff-elevated",
                    isCleanCompleted && "border-green-500/30 bg-green-500/[0.03]",
                    isNotAvailable && "border-orange-500/30 bg-orange-500/[0.03]",
                  )}
                  data-testid={`dcms-completed-card-${stop.subscriptionId}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Original assigned sequence badge */}
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          Assigned #{stop.originalSequence ?? 1}
                        </span>
                        <h3 className="font-display font-bold text-lg tracking-tight text-foreground truncate">
                          {stop.vehicleNumber}
                        </h3>
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate mt-0.5">
                        {stop.customerName} · {stop.vehicleMake} {stop.vehicleModel}
                      </p>
                    </div>

                    {/* Actual Completion Order / Status Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isCleanCompleted ? (
                        stop.isPendingSync ? (
                          <Badge variant="outline" className="bg-amber-500/20 text-amber-900 dark:text-amber-200 border-amber-500/40 font-medium text-xs flex items-center gap-1">
                            <Clock size={11} className="text-amber-700 animate-pulse" />
                            {isHindi ? "सिंक पेंडिंग" : "Sync Pending"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-600 text-white font-medium text-xs border-0 flex items-center gap-1">
                            <CheckCircle size={11} />
                            {stop.completionOrder ? `Completed #${stop.completionOrder}` : t("cleaning_complete")}
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="bg-orange-500/15 text-orange-900 border-orange-500/30 font-medium text-xs">
                          {t("car_not_available_action")}
                        </Badge>
                      )}

                      {stop.completedAtTime && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock size={10} /> {stop.completedAtTime}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* RECOVERY OR EDIT ACTIONS */}
                  {isNotAvailable ? (
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 text-xs font-semibold border-green-600/30 text-green-800 bg-green-500/5 hover:bg-green-500/15"
                        onClick={() => setSelectedCleanStop(stop)}
                        data-testid={`dcms-recovery-btn-${stop.subscriptionId}`}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5 text-green-700" />
                        {t("car_found_clean_now")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 text-xs text-muted-foreground"
                        onClick={() => setSelectedActionStop(stop)}
                      >
                        {t("change")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
                      <span className="text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1">
                        <CheckCircle2 size={13} className="text-emerald-600" /> Verified proof uploaded
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedActionStop(stop)}
                        className="text-[11px] text-muted-foreground hover:text-foreground underline font-medium"
                      >
                        {t("options")}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
