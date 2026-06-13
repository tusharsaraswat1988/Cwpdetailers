import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Search, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { recognizePlateFromImage, normalizeRegistration } from "../lib/plateOcr";
import { useVehicleSearch, useRecognizePlate, dcmsFetch } from "../api";
import { PlateVerifyCard } from "./PlateVerifyCard";
import type { VehicleReferencePhotoSet } from "@/components/shared/VehicleReferencePhotos";

export type PlateScanMeta = {
  ocrText: string;
  ocrConfidence: number;
  confirmedRegistration: string;
};

export type VehicleSearchPayload = {
  vehicle: {
    id: number;
    registrationNumber: string;
    make: string;
    model: string;
    color?: string | null;
  };
  customer: { name: string };
  subscription: { id: number; status: string } | null;
  assigned?: boolean;
  referencePhotos?: VehicleReferencePhotoSet;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeSubscriptionIds: number[];
  onVehicleConfirmed: (payload: {
    subscriptionId: number;
    vehicleId: number;
    scanMeta: PlateScanMeta;
  }) => void;
};

type Step = "capture" | "processing" | "verify" | "manual";

const EMPTY_PHOTOS: VehicleReferencePhotoSet = {
  front: null,
  rear: null,
  left: null,
  right: null,
};

export function PlateScanFlow({ open, onOpenChange, routeSubscriptionIds, onVehicleConfirmed }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("capture");
  const [ocrRaw, setOcrRaw] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [detectedReg, setDetectedReg] = useState("");
  const [manualReg, setManualReg] = useState("");
  const [searchReg, setSearchReg] = useState("");
  const [doSearch, setDoSearch] = useState(false);
  const [vehiclePayload, setVehiclePayload] = useState<VehicleSearchPayload | null>(null);

  const search = useVehicleSearch(searchReg, doSearch);
  const recognizePlate = useRecognizePlate();

  const reset = useCallback(() => {
    setStep("capture");
    setOcrRaw("");
    setOcrConfidence(0);
    setDetectedReg("");
    setManualReg("");
    setSearchReg("");
    setDoSearch(false);
    setVehiclePayload(null);
  }, []);

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const applyVehicle = (payload: VehicleSearchPayload, reg: string, raw: string, confidence: number) => {
    const subId = payload.subscription?.id;
    if (!subId) {
      toast({ title: "No active subscription", description: "This vehicle has no active daily cleaning plan.", variant: "destructive" });
      return;
    }
    if (payload.assigned === false) {
      toast({ title: "Not on your route", description: "This vehicle is not assigned to you today.", variant: "destructive" });
      return;
    }
    if (!routeSubscriptionIds.includes(subId)) {
      toast({ title: "Not on today's route", description: "Vehicle found but not scheduled on your route today.", variant: "destructive" });
      return;
    }
    onVehicleConfirmed({
      subscriptionId: subId,
      vehicleId: payload.vehicle.id,
      scanMeta: {
        ocrText: raw,
        ocrConfidence: confidence,
        confirmedRegistration: normalizeRegistration(reg),
      },
    });
    handleClose(false);
    toast({ title: "Vehicle confirmed", description: payload.vehicle.registrationNumber });
  };

  const showVerifyStep = (payload: VehicleSearchPayload | null, reg: string) => {
    setVehiclePayload(payload);
    setManualReg(reg);
    setDetectedReg(reg);
    setStep("verify");
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setStep("processing");
    try {
      const ocr = await recognizePlateFromImage(file);
      setOcrRaw(ocr.rawText);
      setOcrConfidence(ocr.confidence);

      const reg = ocr.displayRegistration ?? "";
      setDetectedReg(reg);
      setManualReg(reg);

      if (reg) {
        const server = await recognizePlate.mutateAsync({ rawText: ocr.rawText, confidence: ocr.confidence });
        showVerifyStep((server.vehicle as VehicleSearchPayload | null) ?? null, reg);
        return;
      }

      setStep("verify");
    } catch (err) {
      toast({ title: "OCR failed", description: (err as Error).message, variant: "destructive" });
      setStep("manual");
    }
  };

  const lookupRegistration = async (reg: string): Promise<VehicleSearchPayload | null> => {
    try {
      return await dcmsFetch<VehicleSearchPayload>(
        `/daily-cleaning/vehicles/search?registration=${encodeURIComponent(reg)}`,
      );
    } catch {
      return null;
    }
  };

  const handleRegLookup = async (reg: string) => {
    if (reg.length < 4) {
      setVehiclePayload(null);
      return;
    }
    const data = await lookupRegistration(reg);
    setVehiclePayload(data);
  };

  const handleConfirmVehicle = async () => {
    const reg = manualReg.trim();
    if (!reg) {
      toast({ title: "Enter registration", variant: "destructive" });
      return;
    }
    let payload = vehiclePayload;
    if (!payload?.subscription) {
      payload = await lookupRegistration(reg);
      if (!payload) {
        toast({ title: "Vehicle not found", description: "Check the number or try manual search", variant: "destructive" });
        return;
      }
      setVehiclePayload(payload);
    }
    applyVehicle(payload, reg, ocrRaw, ocrConfidence);
  };

  const handleManualSearch = () => {
    const reg = manualReg.trim();
    if (reg.length < 4) {
      toast({ title: "Enter at least 4 characters", variant: "destructive" });
      return;
    }
    setSearchReg(reg);
    setDoSearch(true);
  };

  const handleSearchConfirm = () => {
    if (!search.data) return;
    applyVehicle(search.data as VehicleSearchPayload, manualReg || searchReg, ocrRaw, ocrConfidence);
  };

  const activePayload =
    vehiclePayload
    ?? (search.data as VehicleSearchPayload | undefined)
    ?? null;

  const verifyPhotos = activePayload?.referencePhotos ?? EMPTY_PHOTOS;

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan Number Plate</DialogTitle>
            <DialogDescription>
              Match the detected plate with vehicle details and reference photos before confirming.
            </DialogDescription>
          </DialogHeader>

          {step === "capture" && (
            <div className="space-y-4">
              <Button className="w-full" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4 mr-2" /> Open Camera
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setStep("manual")}>
                <Search className="h-4 w-4 mr-2" /> Manual Search
              </Button>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Reading number plate…</p>
            </div>
          )}

          {step === "verify" && (
            <div className="space-y-4">
              {!detectedReg && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Could not read plate — enter number manually below
                </p>
              )}

              {activePayload ? (
                <PlateVerifyCard
                  detectedRegistration={manualReg}
                  ocrConfidence={ocrConfidence}
                  vehicleMake={activePayload.vehicle.make}
                  vehicleModel={activePayload.vehicle.model}
                  vehicleColor={activePayload.vehicle.color}
                  ownerName={activePayload.customer.name}
                  referencePhotos={verifyPhotos}
                  editable
                  onRegistrationChange={v => {
                    setManualReg(v);
                    void handleRegLookup(v);
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Detected</p>
                    <Input
                      value={manualReg}
                      onChange={e => {
                        const v = e.target.value.toUpperCase();
                        setManualReg(v);
                        void handleRegLookup(v);
                      }}
                      className="font-mono text-lg tracking-wide"
                      placeholder="UP65AB1234"
                    />
                  </div>
                  {manualReg.length >= 4 && !vehiclePayload && (
                    <p className="text-sm text-destructive">No vehicle found for this number</p>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleConfirmVehicle} disabled={recognizePlate.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Yes, correct vehicle
                </Button>
                <Button variant="outline" onClick={() => setStep("manual")}>
                  <XCircle className="h-4 w-4 mr-1" /> Wrong
                </Button>
              </div>
            </div>
          )}

          {step === "manual" && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Vehicle number entry</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="UP65AB1234"
                    value={manualReg}
                    onChange={e => { setManualReg(e.target.value.toUpperCase()); setDoSearch(false); }}
                  />
                  <Button onClick={handleManualSearch} disabled={search.isFetching}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {doSearch && search.isLoading && (
                <p className="text-sm text-muted-foreground">Searching…</p>
              )}

              {doSearch && search.isError && (
                <p className="text-sm text-destructive">Vehicle not found</p>
              )}

              {doSearch && search.isSuccess && search.data != null && (
                <div className="space-y-3">
                  <PlateVerifyCard
                    detectedRegistration={manualReg || searchReg}
                    ocrConfidence={ocrConfidence || undefined}
                    vehicleMake={(search.data as VehicleSearchPayload).vehicle.make}
                    vehicleModel={(search.data as VehicleSearchPayload).vehicle.model}
                    vehicleColor={(search.data as VehicleSearchPayload).vehicle.color}
                    ownerName={(search.data as VehicleSearchPayload).customer.name}
                    referencePhotos={(search.data as VehicleSearchPayload).referencePhotos ?? EMPTY_PHOTOS}
                  />
                  {(search.data as VehicleSearchPayload).assigned === false && (
                    <p className="text-xs text-destructive">This vehicle is not assigned to you</p>
                  )}
                  <Button className="w-full" onClick={handleSearchConfirm}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Yes, correct vehicle
                  </Button>
                </div>
              )}

              <Button variant="ghost" className="w-full" onClick={() => setStep("capture")}>
                <Camera className="h-4 w-4 mr-1" /> Scan plate instead
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCapture}
      />
    </>
  );
}

/** Fetch vehicle by registration (imperative). */
export async function fetchVehicleByRegistration(registration: string): Promise<VehicleSearchPayload | null> {
  try {
    return await dcmsFetch<VehicleSearchPayload>(
      `/daily-cleaning/vehicles/search?registration=${encodeURIComponent(registration)}`,
    );
  } catch {
    return null;
  }
}
