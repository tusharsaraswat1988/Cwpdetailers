import { useState, useRef, useCallback, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { StaffAccountGate } from "@/components/staff/StaffAccountGate";
import { useStaffDailyRoute, useCompleteVisit } from "../api";
import { fetchWalkInDcmsStop } from "@/features/staff-walk-in/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Camera, CheckCircle, Loader2, ScanLine, Navigation, MapPin } from "lucide-react";
import { extractClientExif, validateCameraFile, readFileAsDataUrl } from "../lib/cameraCapture";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { getStaffLocation } from "@/lib/location";
import { buildNavigateUrl } from "@/lib/maps";
import { PlateScanFlow, type PlateScanMeta } from "../components/PlateScanFlow";
import { cn } from "@/lib/utils";

type RouteStop = {
  subscriptionId: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  todayStatus: "pending" | "completed" | "missed" | "rejected";
  remainingCleanings: number;
  remainingWashes?: number;
  location?: { latitude: number; longitude: number; radiusMeters: number } | null;
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  completed: "Done",
  missed: "Missed",
  rejected: "Rejected",
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
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  const [plateScanMeta, setPlateScanMeta] = useState<PlateScanMeta | null>(null);

  const routeStops = (data?.stops ?? []) as RouteStop[];
  const walkInStop = walkInStopQuery.data;

  const stops: RouteStop[] = walkInMode && walkInStop
    ? [{
        subscriptionId: walkInStop.subscriptionId,
        customerName: walkInStop.customerName,
        vehicleNumber: walkInStop.vehicleNumber,
        vehicleMake: walkInStop.vehicleMake,
        vehicleModel: walkInStop.vehicleModel,
        todayStatus: walkInStop.todayStatus === "rejected" ? "rejected" : walkInStop.todayStatus,
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
  const visitType = walkInMode ? walkInVisitType : "cleaning";

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

  const captureVisit = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !current) return;
    e.target.value = "";
    try {
      validateCameraFile(file);
      const [gps, imageBase64, exif] = await Promise.all([
        getStaffLocation("action"),
        readFileAsDataUrl(file),
        extractClientExif(file),
      ]);
      await completeVisit.mutateAsync({
        subscriptionId: current.subscriptionId,
        visitType,
        imageBase64,
        exif,
        capturedAt: new Date(file.lastModified).toISOString(),
        walkIn: walkInMode,
        ...gps,
        ocrText: plateScanMeta?.ocrText ?? null,
        ocrConfidence: plateScanMeta?.ocrConfidence ?? null,
        confirmedRegistration: plateScanMeta?.confirmedRegistration ?? current.vehicleNumber,
      });
      toast({ title: "Ho gaya!", description: `${current.vehicleNumber} — visit complete` });
      setPlateScanMeta(null);
      if (walkInMode) {
        navigate("/staff/bookings?walkInSuccess=1");
        return;
      }
      refetch();
      if (activeIdx < stops.length - 1) setActiveIdx(i => i + 1);
    } catch (err) {
      toast({ title: "Upload failed", description: visitUploadErrorMessage(err), variant: "destructive" });
    }
  }, [current, completeVisit, toast, refetch, plateScanMeta, activeIdx, stops.length, visitType, walkInMode, navigate]);

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
          {walkInMode ? "Walk-in" : data?.date} · <span className="font-medium text-foreground">{doneCount}/{stops.length}</span> done
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

          {current.todayStatus === "pending" ? (
            <Button
              className="w-full h-14 text-base font-semibold"
              onClick={() => fileRef.current?.click()}
              disabled={completeVisit.isPending}
            >
              {completeVisit.isPending ? (
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              ) : (
                <Camera className="h-5 w-5 mr-2" />
              )}
              Photo lein & complete
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <div className="flex items-center justify-center gap-2 text-green-600 text-sm font-medium bg-green-500/10 rounded-xl w-full py-3">
                <CheckCircle size={18} /> Is car ka kaam ho chuka hai
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
              )}
            >
              {s.vehicleNumber.slice(-4)}
            </button>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => void captureVisit(e)}
      />

      {!walkInMode && (
        <PlateScanFlow
          open={scanOpen}
          onOpenChange={setScanOpen}
          routeSubscriptionIds={stops.map(s => s.subscriptionId)}
          onVehicleConfirmed={handlePlateConfirmed}
        />
      )}
    </div>
  );
}
