import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RotateCcw,
  Check,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { captureStaffPhoto, isCameraCancel, type StaffCapturedPhoto } from "@/lib/native/captureStaffPhoto";
import { getStaffLocation } from "@/lib/location";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { recognizePlateFromImage, normalizeRegistration } from "../lib/plateOcr";
import { useCompleteVisit } from "../api";
import type { VehicleReferencePhotoSet } from "@/components/shared/VehicleReferencePhotos";
import { PlateVerifyCard } from "./PlateVerifyCard";

export type CleanDialogStop = {
  subscriptionId: number;
  customerId?: number;
  vehicleId?: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  referencePhotos?: VehicleReferencePhotoSet;
  todayStatus: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: CleanDialogStop | null;
  visitType?: "cleaning" | "wash";
  walkInMode?: boolean;
  onSuccess: () => void;
};

type Step =
  | "ready"           // Initial prompt: clean vehicle, then scan plate
  | "processing"      // Running OCR on captured photo
  | "verified"        // Plate confirmed & photo ready for proof
  | "mismatch"        // Wrong vehicle detected
  | "manual_fallback" // Plate unreadable, enter number with assigned match verification
  | "submitting";     // Sending to server

const EMPTY_PHOTOS: VehicleReferencePhotoSet = {
  front: null,
  rear: null,
  left: null,
  right: null,
};

export function StaffVehicleCleanDialog({
  open,
  onOpenChange,
  stop,
  visitType = "cleaning",
  walkInMode = false,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const completeVisit = useCompleteVisit();

  const [step, setStep] = useState<Step>("ready");
  const [photo, setPhoto] = useState<StaffCapturedPhoto | null>(null);
  const [ocrRaw, setOcrRaw] = useState("");
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [detectedReg, setDetectedReg] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("ready");
      setPhoto(null);
      setOcrRaw("");
      setOcrConfidence(0);
      setDetectedReg("");
      setManualInput("");
      setManualError(null);
      setSubmitError(null);
    }
  }, [open, stop?.subscriptionId]);

  if (!stop) return null;

  const expectedRegNorm = normalizeRegistration(stop.vehicleNumber);

  const handleCaptureAndScan = async () => {
    try {
      setSubmitError(null);
      setManualError(null);
      const captured = await captureStaffPhoto("rear");
      setPhoto(captured);
      setStep("processing");

      let ocrResult;
      try {
        ocrResult = await recognizePlateFromImage(captured.file);
      } catch (ocrErr) {
        console.warn("OCR client error:", ocrErr);
        ocrResult = {
          rawText: "",
          confidence: 0,
          extractedRegistration: null,
          displayRegistration: null,
        };
      }

      const raw = ocrResult.rawText || "";
      const conf = ocrResult.confidence || 0;
      const detected = ocrResult.displayRegistration
        ? normalizeRegistration(ocrResult.displayRegistration)
        : "";

      setOcrRaw(raw);
      setOcrConfidence(conf);
      setDetectedReg(detected);

      // Clean alphanumeric comparison
      const cleanExpected = expectedRegNorm.replace(/[^A-Z0-9]/g, "");
      const cleanDetected = detected.replace(/[^A-Z0-9]/g, "");

      const isExact = cleanDetected.length >= 4 && cleanDetected === cleanExpected;
      const isSubMatch = cleanDetected.length >= 4 && (
        cleanExpected.includes(cleanDetected) || cleanDetected.includes(cleanExpected)
      );

      if (isExact || (isSubMatch && conf >= 50)) {
        setStep("verified");
      } else if (cleanDetected.length >= 4) {
        // Detected a completely different plate number
        setStep("mismatch");
      } else {
        // Plate could not be parsed clearly
        setStep("manual_fallback");
      }
    } catch (err) {
      if (isCameraCancel(err)) {
        setStep("ready");
        return;
      }
      toast({
        title: "Camera error",
        description: (err as Error).message,
        variant: "destructive",
      });
      setStep("ready");
    }
  };

  const handleConfirmManualRegistration = () => {
    setManualError(null);
    const entered = normalizeRegistration(manualInput.trim());
    const cleanEntered = entered.replace(/[^A-Z0-9]/g, "");
    const cleanExpected = expectedRegNorm.replace(/[^A-Z0-9]/g, "");

    if (cleanEntered !== cleanExpected) {
      setManualError(
        `Yeh number assigned car se match nahi karta. Expected: ${stop.vehicleNumber}`,
      );
      return;
    }

    setStep("verified");
  };

  const handleSubmitCompletion = async () => {
    if (!photo) return;
    try {
      setStep("submitting");
      setSubmitError(null);

      const gps = await getStaffLocation("action");
      const result = await completeVisit.mutateAsync({
        subscriptionId: stop.subscriptionId,
        visitType,
        imageBase64: photo.dataUrl,
        exif: photo.exif,
        capturedAt: photo.capturedAt,
        walkIn: walkInMode,
        ...gps,
        ocrText: ocrRaw || "MANUAL_VERIFIED",
        ocrConfidence: ocrConfidence || null,
        confirmedRegistration: stop.vehicleNumber,
      });

      if (isOfflineQueued(result)) {
        toast({ title: "Visit saved on phone", description: queuedSavedMessage("visit") });
      } else {
        toast({ title: "Ho gaya!", description: `${stop.vehicleNumber} — cleaning complete` });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setStep("verified");
      const msg = visitUploadErrorMessage(err);
      setSubmitError(msg);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl font-bold font-display tracking-tight">
              {stop.vehicleNumber}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs">
              {stop.vehicleMake} {stop.vehicleModel}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Customer: <span className="font-medium text-foreground">{stop.customerName}</span>
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{submitError}</div>
          </div>
        )}

        {/* STEP 1: Ready to start */}
        {step === "ready" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Guided Daily Clean Workflow
              </p>
              <ol className="list-decimal list-inside text-xs space-y-1 text-muted-foreground">
                <li>Gaadi clean karein</li>
                <li>Cleaned gaadi ki number plate scan karein</li>
                <li>App plate match verify karega aur proof photo upload karega</li>
              </ol>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => void handleCaptureAndScan()}
            >
              <Camera className="mr-2 h-5 w-5" />
              Plate scan karein & photo lein
            </Button>
          </div>
        )}

        {/* PROCESSING: OCR in progress */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Number plate scan aur verify ho rahi hai…</p>
          </div>
        )}

        {/* MISMATCH: Detected wrong vehicle */}
        {step === "mismatch" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2 text-xs text-destructive">
              <p className="font-bold text-sm flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                Galat gaadi detect hui!
              </p>
              <p>
                Scan kiya gaya number: <strong className="font-mono">{detectedReg || "UNKNOWN"}</strong>
              </p>
              <p>
                Assigned gaadi: <strong className="font-mono">{stop.vehicleNumber}</strong> ({stop.vehicleMake} {stop.vehicleModel})
              </p>
              <p className="text-foreground/80 mt-1">
                Kripya sahi assigned gaadi clean karein aur uski plate scan karein.
              </p>
            </div>

            {photo && (
              <div className="relative rounded-xl overflow-hidden border max-h-48">
                <img src={photo.dataUrl} alt="Scanned car" className="w-full object-cover" />
              </div>
            )}

            <div className="space-y-2">
              <Button
                className="w-full h-11"
                onClick={() => void handleCaptureAndScan()}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Sahi gaadi dobara scan karein
              </Button>
              <Button
                variant="ghost"
                className="w-full text-xs text-muted-foreground"
                onClick={() => {
                  setManualInput("");
                  setManualError(null);
                  setStep("manual_fallback");
                }}
              >
                Plate saaf nahi aayi? Manual confirm karein
              </Button>
            </div>
          </div>
        )}

        {/* MANUAL FALLBACK: Plate unreadable */}
        {step === "manual_fallback" && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 text-xs text-amber-900">
              <p className="font-bold flex items-center gap-1">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                Number plate padh nahi paye
              </p>
              <p>
                Agar plate par dhool ya reflection thi, gaadi ka number confirm karein:
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Vehicle registration number
              </label>
              <Input
                placeholder="e.g. UP65AB1234"
                value={manualInput}
                onChange={e => {
                  setManualInput(e.target.value.toUpperCase());
                  setManualError(null);
                }}
                className="font-mono text-lg tracking-wider h-11"
                autoFocus
              />
              {manualError && (
                <p className="text-xs text-destructive font-medium">{manualError}</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => void handleCaptureAndScan()}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" /> Dobara photo lein
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmManualRegistration}
                disabled={!manualInput.trim()}
              >
                <Check className="mr-1.5 h-4 w-4" /> Confirm karein
              </Button>
            </div>
          </div>
        )}

        {/* VERIFIED: Plate confirmed, ready to submit proof */}
        {step === "verified" && (
          <div className="space-y-4 py-1">
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 flex items-center justify-between gap-2 text-green-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="text-xs font-semibold">Plate Verified</p>
                  <p className="font-mono text-sm font-bold">{stop.vehicleNumber}</p>
                </div>
              </div>
              {ocrConfidence > 0 && (
                <Badge variant="outline" className="border-green-600 text-green-800 text-[10px]">
                  {Math.round(ocrConfidence)}% OCR match
                </Badge>
              )}
            </div>

            {photo && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Cleaning Proof Photo:</p>
                <div className="relative rounded-xl overflow-hidden border max-h-48 bg-muted">
                  <img src={photo.dataUrl} alt="Cleaned vehicle proof" className="w-full object-cover" />
                </div>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Button
                className="w-full h-12 text-base font-semibold"
                onClick={() => void handleSubmitCompletion()}
                disabled={completeVisit.isPending}
              >
                {completeVisit.isPending ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Kaam complete karein
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => void handleCaptureAndScan()}
                disabled={completeVisit.isPending}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Photo dobara lein
              </Button>
            </div>
          </div>
        )}

        {/* SUBMITTING */}
        {step === "submitting" && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Server par visit upload ho rahi hai…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
