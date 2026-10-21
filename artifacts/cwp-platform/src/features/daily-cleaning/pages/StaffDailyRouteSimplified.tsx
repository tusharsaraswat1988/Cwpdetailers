import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useStaffDailyRoute } from "../api";
import { fetchWalkInDcmsStop } from "@/features/staff-walk-in/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CheckCircle,
  Navigation,
  MapPinOff,
  RotateCcw,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import { staffVisitLabel } from "../lib/visitLabels";
import { buildNavigateUrl, openExternalNavigation } from "@/lib/maps";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import {
  StaffVehicleCleanDialog,
  type CleanDialogStop,
} from "../components/StaffVehicleCleanDialog";
import { StaffCarNotAvailableDialog } from "../components/StaffCarNotAvailableDialog";

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
  destinationType?: "coordinates" | "address" | "missing";
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

export function StaffDailyRouteSimplified() {
  const { user } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
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

  const [selectedCleanStop, setSelectedCleanStop] = useState<CleanDialogStop | null>(null);
  const [selectedUnavailableStop, setSelectedUnavailableStop] = useState<CleanDialogStop | null>(null);

  const routeStops = (data?.stops ?? []) as RouteStop[];
  const walkInStop = walkInStopQuery.data;

  const stops: RouteStop[] = walkInMode && walkInStop
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
    : routeStops;

  const stats = computeRouteStats(stops);
  const visitType = walkInMode ? walkInVisitType : "cleaning";

  if (!user?.staffId) {
    return (
      <StaffAccountGate scopeLoading={false} missingStaffLink={!user?.staffId} staffId={user?.staffId ?? null}>
        {null}
      </StaffAccountGate>
    );
  }

  if (walkInMode ? walkInStopQuery.isLoading : isLoading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Route load ho rahi hai…</p>;
  }

  if (!walkInMode && isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
        <p className="text-sm text-destructive">
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
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
        Walk-in visit load nahi ho payi. Bookings se dubara try karein.
      </div>
    );
  }

  if (stops.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">Aaj koi daily clean assignment nahi</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {walkInMode && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Walk-in visit — wahi daily clean workflow use karo jo assigned jobs mein hai.
        </div>
      )}

      {/* TOP PROGRESS SUMMARY BANNER */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{walkInMode ? "Walk-in Job" : (data?.date ?? "Today")}</span>
          <span>{stats.completed}/{stats.total} Cleaned</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 text-center">
          <div className="rounded-xl bg-muted/50 p-1.5 sm:p-2.5">
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-tight truncate">Total</p>
            <p className="text-lg font-bold font-display text-foreground mt-0.5">{stats.total}</p>
          </div>
          <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-1.5 sm:p-2.5">
            <p className="text-[10px] sm:text-[11px] text-green-800 font-medium uppercase tracking-tight truncate">Cleaned</p>
            <p className="text-lg font-bold font-display text-green-700 mt-0.5">{stats.completed}</p>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-1.5 sm:p-2.5">
            <p className="text-[10px] sm:text-[11px] text-amber-800 font-medium uppercase tracking-tight truncate">Pending</p>
            <p className="text-lg font-bold font-display text-amber-700 mt-0.5">{stats.pending}</p>
          </div>
          <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 p-1.5 sm:p-2.5">
            <p className="text-[10px] sm:text-[11px] text-orange-800 font-medium uppercase tracking-tight truncate">Nahi mili</p>
            <p className="text-lg font-bold font-display text-orange-700 mt-0.5">{stats.notAvailable}</p>
          </div>
        </div>
      </div>

      {/* VERTICALLY SCROLLABLE ROUTE LIST */}
      <div className="space-y-3" data-testid="dcms-daily-route-list">
        {stops.map((stop, idx) => {
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
                "rounded-2xl border bg-card p-4 space-y-3 shadow-sm transition-all",
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
                  <p className="text-sm font-medium text-foreground truncate mt-0.5">
                    {stop.customerName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {stop.vehicleMake} {stop.vehicleModel}
                    {stop.vehicleColor ? ` · ${stop.vehicleColor}` : ""}
                  </p>
                </div>

                <Badge variant="outline" className={cn("shrink-0 font-medium text-xs", badge.className)}>
                  {badge.label}
                </Badge>
              </div>

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

              {/* ACTION BUTTONS */}
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
                  {visitType === "cleaning" && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-[2.75rem] h-auto py-2.5 px-3 text-xs font-medium border-orange-500/30 text-orange-900 bg-orange-500/5 hover:bg-orange-500/15"
                      onClick={() => setSelectedUnavailableStop(stop)}
                      data-testid={`dcms-unavailable-btn-${stop.subscriptionId}`}
                    >
                      Gaadi nahi mili
                    </Button>
                  )}
                </div>
              ) : isNotAvailable ? (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-medium rounded-xl py-2 px-3 text-orange-900 bg-orange-500/10 border border-orange-500/20">
                    <AlertTriangle size={14} className="text-orange-700" />
                    Car nahi mili — visit recorded (cleaning credit nahi kata)
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
                <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-800 text-xs font-medium">
                  <CheckCircle size={15} className="text-green-600" />
                  Is car ka kaam ho chuka hai
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* GUIDED CLEANING WORKFLOW MODAL */}
      <StaffVehicleCleanDialog
        open={Boolean(selectedCleanStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedCleanStop(null);
        }}
        stop={selectedCleanStop}
        visitType={visitType}
        walkInMode={walkInMode}
        onSuccess={() => {
          if (walkInMode) {
            navigate("/staff/bookings?walkInSuccess=1");
          } else {
            void refetch();
          }
        }}
      />

      {/* CAR NOT AVAILABLE EXCEPTION MODAL */}
      <StaffCarNotAvailableDialog
        open={Boolean(selectedUnavailableStop)}
        onOpenChange={(open) => {
          if (!open) setSelectedUnavailableStop(null);
        }}
        stop={selectedUnavailableStop}
        walkInMode={walkInMode}
        onSuccess={() => {
          if (walkInMode) {
            navigate("/staff/bookings?walkInSuccess=1");
          } else {
            void refetch();
          }
        }}
      />
    </div>
  );
}
