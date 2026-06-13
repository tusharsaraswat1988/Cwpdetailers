import { useState, useRef, useCallback, useEffect } from "react";

import StaffAppShell from "@/components/layout/StaffAppShell";

import { StaffAccountGate } from "@/components/staff/StaffAccountGate";

import { useAuth } from "@/lib/auth";

import { useStaffDailyRoute, useCompleteVisit } from "../api";

import { Button } from "@/components/ui/button";

import { Card, CardContent } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import { Checkbox } from "@/components/ui/checkbox";

import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";

import { ChevronLeft, ChevronRight, Camera, MapPin, Droplets, AlertTriangle, ScanLine } from "lucide-react";

import { extractClientExif, validateCameraFile, readFileAsDataUrl, getGps } from "../lib/cameraCapture";

import { VehicleReferencePhotos, type VehicleReferencePhotoSet } from "@/components/shared/VehicleReferencePhotos";

import { PlateScanFlow, type PlateScanMeta } from "../components/PlateScanFlow";

import { PlateVerifyCard } from "../components/PlateVerifyCard";

import { resolveMediaUrl } from "@/lib/media-url";

import { cn } from "@/lib/utils";



type RouteStop = {

  subscriptionId: number;

  vehicleId: number;

  routeOrder: number;

  customerName: string;

  vehicleNumber: string;

  vehicleMake: string;

  vehicleModel: string;

  vehicleColor?: string | null;

  planName: string;

  remainingCleanings: number;

  todayStatus: "pending" | "completed" | "missed" | "rejected";

  rejectionReason?: string | null;

  referencePhotos: VehicleReferencePhotoSet;

  referencePhotosComplete: boolean;

  location?: { latitude: number; longitude: number; radiusMeters: number } | null;

};



const statusStyle: Record<string, string> = {

  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",

  completed: "bg-green-500/10 text-green-700 border-green-500/30",

  missed: "bg-red-500/10 text-red-700 border-red-500/30",

  rejected: "bg-destructive/10 text-destructive border-destructive/30",

};



export default function StaffDailyRoutePage() {

  const { user } = useAuth();

  const { data, isLoading, refetch } = useStaffDailyRoute();

  const completeVisit = useCompleteVisit();

  const { toast } = useToast();

  const fileRef = useRef<HTMLInputElement>(null);

  const [activeIdx, setActiveIdx] = useState(0);

  const [visitType, setVisitType] = useState<"cleaning" | "wash">("cleaning");

  const [vehicleConfirmed, setVehicleConfirmed] = useState(false);

  const [scanOpen, setScanOpen] = useState(false);

  const [plateScanMeta, setPlateScanMeta] = useState<PlateScanMeta | null>(null);

  const [scannedViaPlate, setScannedViaPlate] = useState(false);



  const stops = (data?.stops ?? []) as RouteStop[];

  const current = stops[activeIdx];



  useEffect(() => {

    setVehicleConfirmed(false);

    setPlateScanMeta(null);

    setScannedViaPlate(false);

  }, [activeIdx, current?.subscriptionId]);



  const handlePlateConfirmed = useCallback(({ subscriptionId, scanMeta }: {

    subscriptionId: number;

    scanMeta: PlateScanMeta;

  }) => {

    const idx = stops.findIndex(s => s.subscriptionId === subscriptionId);

    if (idx >= 0) {

      setActiveIdx(idx);

      setVehicleConfirmed(true);

      setPlateScanMeta(scanMeta);

      setScannedViaPlate(true);

    }

  }, [stops]);



  const captureVisit = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file || !current) return;

    e.target.value = "";

    try {

      validateCameraFile(file);

      const [gps, imageBase64, exif] = await Promise.all([

        getGps(),

        readFileAsDataUrl(file),

        extractClientExif(file),

      ]);

      await completeVisit.mutateAsync({

        subscriptionId: current.subscriptionId,

        visitType,

        imageBase64,

        exif,

        ...gps,

        ocrText: plateScanMeta?.ocrText ?? null,

        ocrConfidence: plateScanMeta?.ocrConfidence ?? null,

        confirmedRegistration: plateScanMeta?.confirmedRegistration ?? current.vehicleNumber,

      });

      toast({ title: visitType === "wash" ? "Wash recorded" : "Cleaning completed" });

      setPlateScanMeta(null);

      setScannedViaPlate(false);

      refetch();

    } catch (err) {

      toast({ title: "Visit rejected", description: (err as Error).message, variant: "destructive" });

    }

  }, [current, visitType, completeVisit, toast, refetch, plateScanMeta]);



  const canSubmitVisit = current?.todayStatus === "pending" && vehicleConfirmed;



  if (!user?.staffId) {

    return (

      <StaffAccountGate scopeLoading={false} missingStaffLink={!user?.staffId} staffId={user?.staffId ?? null}>

        {null}

      </StaffAccountGate>

    );

  }



  return (

    <StaffAppShell>

      <div className="space-y-4">

        <div className="flex items-start justify-between gap-3">

          <div>

            <h1 className="font-display font-bold text-xl">Today&apos;s Route</h1>

            <p className="text-sm text-muted-foreground">{data?.date} · {stops.length} vehicles</p>

          </div>

          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>

            <ScanLine className="h-4 w-4 mr-1" /> Scan Plate

          </Button>

        </div>



        {isLoading ? (

          <p className="text-muted-foreground text-sm">Loading route…</p>

        ) : stops.length === 0 ? (

          <Card><CardContent className="p-6 text-center text-muted-foreground">No assigned vehicles today</CardContent></Card>

        ) : current ? (

          <>

            <div className="flex items-center justify-between gap-2">

              <Button variant="outline" size="icon" disabled={activeIdx === 0} onClick={() => setActiveIdx(i => i - 1)}>

                <ChevronLeft className="h-4 w-4" />

              </Button>

              <span className="text-sm font-medium">{activeIdx + 1} / {stops.length}</span>

              <Button variant="outline" size="icon" disabled={activeIdx >= stops.length - 1} onClick={() => setActiveIdx(i => i + 1)}>

                <ChevronRight className="h-4 w-4" />

              </Button>

            </div>



            <Card>

              <CardContent className="p-4 space-y-3">

                <div className="flex justify-between items-start gap-3">

                  <div className="flex gap-3 min-w-0">

                    {(current.referencePhotos.front ?? current.referencePhotos.rear) && (

                      <img

                        src={resolveMediaUrl(current.referencePhotos.front ?? current.referencePhotos.rear!)}

                        alt=""

                        className="w-14 h-11 object-cover rounded-lg border shrink-0"

                      />

                    )}

                    <div className="min-w-0">

                      <p className="font-semibold text-lg">{current.vehicleNumber}</p>

                      <p className="text-sm">{current.customerName}</p>

                      <p className="text-xs text-muted-foreground">{current.vehicleMake} {current.vehicleModel}</p>

                    </div>

                  </div>

                  <Badge className={cn("capitalize shrink-0", statusStyle[current.todayStatus])}>{current.todayStatus}</Badge>

                </div>



                {scannedViaPlate && plateScanMeta && current && (

                  <PlateVerifyCard

                    detectedRegistration={plateScanMeta.confirmedRegistration}

                    ocrConfidence={plateScanMeta.ocrConfidence}

                    vehicleMake={current.vehicleMake}

                    vehicleModel={current.vehicleModel}

                    vehicleColor={current.vehicleColor}

                    ownerName={current.customerName}

                    referencePhotos={current.referencePhotos}

                    compact

                    className="border-green-500/30 bg-green-500/5"

                  />

                )}



                {!current.referencePhotosComplete && (

                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2 text-xs text-amber-800">

                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />

                    <span>Front and rear reference photos missing — verify vehicle carefully before cleaning.</span>

                  </div>

                )}



                {!scannedViaPlate && (
                  <VehicleReferencePhotos photos={current.referencePhotos} variant="staff" />
                )}



                {current.location && (

                  <p className="text-xs text-muted-foreground flex items-center gap-1">

                    <MapPin className="h-3 w-3" /> {current.location.radiusMeters}m service radius

                  </p>

                )}



                {current.todayStatus === "pending" && (

                  <>

                    <div className="flex items-center gap-2 pt-1 border-t">

                      <Checkbox

                        id="vehicle-confirmed"

                        checked={vehicleConfirmed}

                        onCheckedChange={v => setVehicleConfirmed(Boolean(v))}

                      />

                      <Label htmlFor="vehicle-confirmed" className="text-sm cursor-pointer">

                        I verified this is the correct vehicle using reference photos

                      </Label>

                    </div>

                    <div className="flex gap-2">

                      <Button

                        className="flex-1"

                        onClick={() => { setVisitType("cleaning"); fileRef.current?.click(); }}

                        disabled={!canSubmitVisit || completeVisit.isPending}

                      >

                        <Camera className="h-4 w-4 mr-1" /> Cleaning

                      </Button>

                      <Button

                        variant="secondary"

                        className="flex-1"

                        onClick={() => { setVisitType("wash"); fileRef.current?.click(); }}

                        disabled={!canSubmitVisit || completeVisit.isPending}

                      >

                        <Droplets className="h-4 w-4 mr-1" /> Wash

                      </Button>

                    </div>

                  </>

                )}

              </CardContent>

            </Card>



            <div className="flex gap-1 overflow-x-auto pb-2">

              {stops.map((s, i) => {

                const thumb = s.referencePhotos.front ?? s.referencePhotos.rear;

                return (

                  <button

                    key={s.subscriptionId}

                    onClick={() => setActiveIdx(i)}

                    className={cn(

                      "shrink-0 rounded border overflow-hidden capitalize",

                      i === activeIdx ? "ring-2 ring-primary" : statusStyle[s.todayStatus],

                    )}

                  >

                    {thumb ? (

                      <img src={resolveMediaUrl(thumb)} alt="" className="w-12 h-10 object-cover" />

                    ) : (

                      <span className="block px-2 py-1 text-xs">{s.vehicleNumber.slice(-4)}</span>

                    )}

                  </button>

                );

              })}

            </div>

          </>

        ) : null}



        <input

          ref={fileRef}

          type="file"

          accept="image/*"

          capture="environment"

          className="hidden"

          onChange={captureVisit}

        />



        <PlateScanFlow

          open={scanOpen}

          onOpenChange={setScanOpen}

          routeSubscriptionIds={stops.map(s => s.subscriptionId)}

          onVehicleConfirmed={handlePlateConfirmed}

        />

      </div>

    </StaffAppShell>

  );

}

