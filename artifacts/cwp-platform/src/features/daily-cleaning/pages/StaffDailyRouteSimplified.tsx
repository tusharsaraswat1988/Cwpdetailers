import { useState, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useStaffDailyRoute, useCompleteVisit, useRecordCarNotAvailable } from "../api";
import { fetchWalkInDcmsStop } from "@/features/staff-walk-in/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Camera, CheckCircle, Loader2, ScanLine, Navigation, MapPin } from "lucide-react";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { staffVisitLabel } from "../lib/visitLabels";
import { getStaffLocation } from "@/lib/location";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { buildNavigateUrl } from "@/lib/maps";
import { PlateScanFlow, type PlateScanMeta } from "../components/PlateScanFlow";
import { cn } from "@/lib/utils";
import {
  ExtraServiceStatusCard,
  StaffAddServiceButton,
  StaffAddServiceSheet,
} from "@/features/extra-service/components/StaffAddServiceSheet";
import {
  useStaffExtraServiceRequests,
  useVerifyExtraServiceOtp,
  type ExtraServiceRequestView,
} from "@/features/extra-service/api";

type RouteStop = {
  subscriptionId: number;
  customerId?: number;
  vehicleId?: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  todayStatus: "pending" | "completed" | "missed" | "rejected" | "car_not_available";
  remainingCleanings: number;
  remainingWashes?: number;
  location?: { latitude: number; longitude: number; radiusMeters: number } | null;
};

const statusLabel: Record<string, string> = {
  pending: staffVisitLabel("pending"),
  completed: staffVisitLabel("completed"),
  missed: staffVisitLabel("missed"),
  rejected: staffVisitLabel("rejected"),
  car_not_available: staffVisitLabel("car_not_available"),
};

export function StaffDailyRouteSimplified() {
  const { user } = useAuth();
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(search);
  const walkInMode = params.get("walkIn") === "1";
  const walkInSubscriptionId = params.get("subscriptionId");
  const walkInVisitType = params.get("visitType") === "wash" ? "wash" : "cleaning";

  const { data, isLoading, isError, error, refetch } = useStaffDailyRoute(undefined, { enabled: !walkInMode });
  const walkInStopQuery = useQuery({
    queryKey: ["walk-in-dcms-stop", walkInSubscriptionId, walkInVisitType],
    queryFn: () => fetchWalkInDcmsStop(Number(walkInSubscriptionId), walkInVisitType),
    enabled: walkInMode && walkInSubscriptionId != null && Number.isFinite(Number(walkInSubscriptionId)),
  });

  const completeVisit = useCompleteVisit();
  const recordCarNotAvailable = useRecordCarNotAvailable();
  const { toast } = useToast();
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [plateScanMeta, setPlateScanMeta] = useState<PlateScanMeta | null>(null);
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [extraOtp, setExtraOtp] = useState("");
  const [extraOtpError, setExtraOtpError] = useState<string | null>(null);

  const routeStops = (data?.stops ?? []) as RouteStop[];
  const walkInStop = walkInStopQuery.data;

  const stops: RouteStop[] = walkInMode && walkInStop
    ? [{
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
      }]
    : routeStops;

  useEffect(() => {
    if (walkInMode && walkInSubscriptionId && stops.length > 0) {
      const idx = stops.findIndex(s => s.subscriptionId === Number(walkInSubscriptionId));
      if (idx >= 0) setActiveIdx(idx);
    }
  }, [walkInMode, walkInSubscriptionId, stops]);

  const current = stops[activeIdx];
  const doneCount = stops.filter(s => s.todayStatus === "completed").length;
  const unavailableCount = stops.filter(s => s.todayStatus === "car_not_available").length;
  const visitType = walkInMode ? walkInVisitType : "cleaning";
  const showPendingActions = current?.todayStatus === "pending" || current?.todayStatus === "rejected";
  const showSameDayRecovery = current?.todayStatus === "car_not_available" && visitType === "cleaning";
  const actionPending = completeVisit.isPending || recordCarNotAvailable.isPending;
  const extraRequests = useStaffExtraServiceRequests(current?.customerId, {
    enabled: current?.customerId != null,
    refetchInterval: 3000,
  });
  const verifyExtra = useVerifyExtraServiceOtp();
  const extraRequest = extraRequests.data?.requests.find((r: ExtraServiceRequestView) =>
    r.vehicleId === current?.vehicleId
    || (current?.vehicleId == null && r.customerId === current?.customerId),
  ) ?? extraRequests.data?.requests[0];

  const handlePlateConfirmed = useCallback(({ subscriptionId, scanMeta }: {
    subscriptionId: number;
    scanMeta: PlateScanMeta;
  }) => {
    const idx = stops.findIndex(s => s.subscriptionId === subscriptionId);
    if (idx >= 0) {
      setActiveIdx(idx);
      setPlateScanMeta(scanMeta);
    }
  }, [stops]);

  const captureVisit = useCallback(async () => {
    if (!current) return;
    try {
      const photo = await captureStaffPhoto("rear");
      const gps = await getStaffLocation("action");
      const result = await completeVisit.mutateAsync({
        subscriptionId: current.subscriptionId,
        visitType,
        imageBase64: photo.dataUrl,
        exif: photo.exif,
        capturedAt: photo.capturedAt,
        walkIn: walkInMode,
        ...gps,
        ocrText: plateScanMeta?.ocrText ?? null,
        ocrConfidence: plateScanMeta?.ocrConfidence ?? null,
        confirmedRegistration: plateScanMeta?.confirmedRegistration ?? current.vehicleNumber,
      });
      if (isOfflineQueued(result)) {
        toast({ title: "Visit saved on phone", description: queuedSavedMessage("visit") });
      } else {
        toast({ title: "Ho gaya!", description: `${current.vehicleNumber} — visit complete` });
      }
      setPlateScanMeta(null);
      if (walkInMode) {
        navigate("/staff/bookings?walkInSuccess=1");
        return;
      }
      refetch();
      if (activeIdx < stops.length - 1) setActiveIdx(i => i + 1);
    } catch (err) {
      if (isCameraCancel(err)) return;
      toast({ title: "Upload failed", description: visitUploadErrorMessage(err), variant: "destructive" });
    }
  }, [current, completeVisit, toast, refetch, plateScanMeta, activeIdx, stops.length, visitType, walkInMode, navigate]);

  const captureCarNotAvailable = useCallback(async () => {
    if (!current) return;
    try {
      const photo = await captureStaffPhoto("rear");
      const gps = await getStaffLocation("action");
      const result = await recordCarNotAvailable.mutateAsync({
        subscriptionId: current.subscriptionId,
        walkIn: walkInMode,
        imageBase64: photo.dataUrl,
        exif: photo.exif,
        capturedAt: photo.capturedAt,
        ...gps,
      });
      if (isOfflineQueued(result)) {
        toast({ title: "Record saved on phone", description: queuedSavedMessage("visit") });
      } else {
        toast({
          title: "Visit record ho gaya",
          description: `${current.vehicleNumber} — car nahi mili, cleaning count nahi kata`,
        });
      }
      if (walkInMode) {
        navigate("/staff/bookings?walkInSuccess=1");
        return;
      }
      refetch();
      if (activeIdx < stops.length - 1) setActiveIdx(i => i + 1);
    } catch (err) {
      if (isCameraCancel(err)) return;
      toast({ title: "Record failed", description: visitUploadErrorMessage(err), variant: "destructive" });
    }
  }, [current, recordCarNotAvailable, toast, refetch, activeIdx, stops.length, walkInMode, navigate]);

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
    <div className="space-y-4">
      {walkInMode && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          Walk-in visit — wahi daily clean workflow use karo jo assigned jobs mein hai.
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {walkInMode ? "Walk-in" : data?.date} · <span className="font-medium text-foreground">{doneCount}/{stops.length}</span> cleaned
          {unavailableCount > 0 && (
            <> · <span className="font-medium text-foreground">{unavailableCount}</span> car nahi mili</>
          )}
        </p>
        {!walkInMode && (
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4 mr-1" /> Scan plate
          </Button>
        )}
      </div>

      {current && (
        <div className="rounded-2xl border-2 border-primary/25 bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-bold text-2xl tracking-wide">{current.vehicleNumber}</p>
              <p className="text-sm font-medium mt-1">{current.customerName}</p>
              <p className="text-xs text-muted-foreground">{current.vehicleMake} {current.vehicleModel}</p>
            </div>
            <Badge
              variant={current.todayStatus === "completed" ? "default" : "secondary"}
              className={cn(
                current.todayStatus === "completed" && "bg-green-600",
                current.todayStatus === "pending" && "bg-amber-500/15 text-amber-800 border-amber-500/30",
                current.todayStatus === "car_not_available" && "bg-amber-500/15 text-amber-900 border-amber-500/30",
                current.todayStatus === "rejected" && "bg-destructive/15 text-destructive",
              )}
            >
              {statusLabel[current.todayStatus]}
            </Badge>
          </div>

          {current.location && (
            <a
              href={buildNavigateUrl({
                latitude: current.location.latitude,
                longitude: current.location.longitude,
              })}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 h-11 rounded-xl border border-primary/30 bg-primary/5 text-sm font-medium text-primary"
              data-testid={`dcms-navigate-${current.subscriptionId}`}
            >
              <Navigation size={15} />
              Navigate to stop
              <MapPin size={12} className="opacity-60" />
            </a>
          )}

          {showPendingActions ? (
            <div className="space-y-2">
              <Button
                className="w-full h-14 text-base font-semibold"
                onClick={() => void captureVisit()}
                disabled={actionPending}
              >
                {completeVisit.isPending ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 mr-2" />
                )}
                Car available — photo lein & complete
              </Button>
              {visitType === "cleaning" && (
                <div className="space-y-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12"
                    onClick={() => setConfirmUnavailable(true)}
                    disabled={actionPending}
                  >
                    {recordCarNotAvailable.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4 mr-2" />
                    )}
                    Car nahi mili — jagah ki photo
                  </Button>
                  <p className="text-[11px] text-center text-muted-foreground">
                    Wahan ki photo + GPS zaroori hai — proof ke liye ki aap gaye the. Cleaning credit nahi katega.
                  </p>
                </div>
              )}
            </div>
          ) : showSameDayRecovery ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-medium rounded-xl w-full py-3 text-amber-800 bg-amber-500/10">
                <CheckCircle size={18} />
                Car nahi mili — visit record ho gaya, cleaning nahi
              </div>
              <Button
                className="w-full h-14 text-base font-semibold"
                onClick={() => void captureVisit()}
                disabled={actionPending}
                data-testid="dcms-same-day-complete"
              >
                {completeVisit.isPending ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 mr-2" />
                )}
                Car mil gayi — complete cleaning
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <div className="flex items-center justify-center gap-2 text-sm font-medium rounded-xl w-full py-3 text-green-600 bg-green-500/10">
                <CheckCircle size={18} />
                Is car ka kaam ho chuka hai
              </div>
              {walkInMode && (
                <Button
                  className="w-full"
                  onClick={() => navigate("/staff/bookings?walkInSuccess=1")}
                >
                  Agla customer khojo
                </Button>
              )}
            </div>
          )}

          {extraRequest && extraRequest.status !== "rejected" && extraRequest.status !== "cancelled" && (
            <ExtraServiceStatusCard
              request={extraRequest}
              otp={extraOtp}
              onOtpChange={(v) => { setExtraOtp(v); setExtraOtpError(null); }}
              verifying={verifyExtra.isPending}
              error={extraOtpError}
              onVerify={() => {
                verifyExtra.mutate(
                  { id: extraRequest.id, code: extraOtp },
                  {
                    onSuccess: (res: { request: ExtraServiceRequestView }) => {
                      setExtraOtp("");
                      const executionId = res.request.executionId;
                      if (executionId) {
                        navigate(`/staff/bookings?job=execution-${executionId}`);
                      }
                    },
                    onError: (err: Error) => setExtraOtpError(err instanceof Error ? err.message : "Could not verify"),
                  },
                );
              }}
            />
          )}

          {(!extraRequest
            || extraRequest.status === "otp_verified"
            || extraRequest.status === "rejected"
            || extraRequest.status === "cancelled") && (
            <StaffAddServiceButton onClick={() => setAddServiceOpen(true)} disabled={actionPending} />
          )}

          {!walkInMode && (
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={activeIdx === 0}
                onClick={() => setActiveIdx(i => i - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" /> Pehla
              </Button>
              <span className="text-xs text-muted-foreground">{activeIdx + 1} / {stops.length}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={activeIdx >= stops.length - 1}
                onClick={() => setActiveIdx(i => i + 1)}
              >
                Agla <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {!walkInMode && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {stops.map((s, i) => (
            <button
              key={s.subscriptionId}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                "shrink-0 px-3 py-2 rounded-lg text-xs font-medium border transition-colors",
                i === activeIdx && "ring-2 ring-primary border-primary",
                s.todayStatus === "completed" && "bg-green-500/10 border-green-500/30 text-green-800",
                s.todayStatus === "pending" && "bg-card border-border",
                s.todayStatus === "rejected" && "bg-destructive/10 border-destructive/30",
                s.todayStatus === "car_not_available" && "bg-amber-500/10 border-amber-500/30 text-amber-900",
              )}
            >
              {s.vehicleNumber.slice(-4)}
            </button>
          ))}
        </div>
      )}

      {!walkInMode && (
        <PlateScanFlow
          open={scanOpen}
          onOpenChange={setScanOpen}
          routeSubscriptionIds={stops.map(s => s.subscriptionId)}
          onVehicleConfirmed={handlePlateConfirmed}
        />
      )}

      <ConfirmDialog
        open={confirmUnavailable}
        onOpenChange={setConfirmUnavailable}
        title="Car nahi mili?"
        description="Is jagah ki photo zaroori hai — proof ke liye ki aap wahan gaye the. Visit present count hogi, cleaning credit nahi katega."
        confirmLabel="Photo lein"
        cancelLabel="Wapas"
        onConfirm={() => {
          setConfirmUnavailable(false);
          void captureCarNotAvailable();
        }}
        isConfirming={recordCarNotAvailable.isPending}
      />

      <StaffAddServiceSheet
        open={addServiceOpen}
        onOpenChange={setAddServiceOpen}
        customerId={current?.customerId}
        subscriptionId={current?.subscriptionId}
        vehicleId={current?.vehicleId}
      />
    </div>
  );
}
