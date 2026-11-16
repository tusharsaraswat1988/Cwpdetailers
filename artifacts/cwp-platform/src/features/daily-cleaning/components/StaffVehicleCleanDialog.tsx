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
  MapPin,
  Settings,
} from "lucide-react";
import {
  captureStaffPhotoWithGps,
  isCameraCancel,
  type CapturedStaffPhoto,
} from "@/lib/native/captureStaffPhoto";
import { openNativeAppSettings } from "@/lib/location/nativeGeolocation";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { recognizePlateFromImage, normalizeRegistration } from "../lib/plateOcr";
import { useCompleteVisit } from "../api";
import type { VehicleReferencePhotoSet } from "@/components/shared/VehicleReferencePhotos";
import { useStaffLanguage, formatStaffOperationalError } from "@/lib/staffLanguage";

export type CleanDialogStop = {
  subscriptionId: number;
  customerId?: number;
  vehicleId?: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  societyName?: string | null;
  parkingLevel?: string | null;
  parkingBay?: string | null;
  referencePhotos?: VehicleReferencePhotoSet;
  todayStatus: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: CleanDialogStop | null;
  visitType?: "cleaning" | "wash";
  walkInMode?: boolean;
  onSuccess: (isQueued?: boolean) => void;
};

type Step =
  | "ready"           // Initial prompt: take photo near car
  | "processing"      // Verifying plate & location
  | "verified"        // Confirmed & ready to submit proof
  | "mismatch"        // Wrong vehicle photo detected
  | "manual_fallback" // Plate unreadable, enter number with assigned match verification
  | "submitting";     // Sending to server

export function StaffVehicleCleanDialog({
  open,
  onOpenChange,
  stop,
  visitType = "cleaning",
  walkInMode = false,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { t } = useStaffLanguage();
  const completeVisit = useCompleteVisit();

  const [step, setStep] = useState<Step>("ready");
  const [photo, setPhoto] = useState<CapturedStaffPhoto | null>(null);
  const [capturedLocation, setCapturedLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    gpsUnavailable?: boolean;
    gpsUnavailableReason?: string;
    weakGpsFallback?: boolean;
  } | null>(null);

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
      setCapturedLocation(null);
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

      // Capture photo and lock device location at the EXACT moment of shutter trigger
      const captured = await captureStaffPhotoWithGps("rear");

      const isBasement = Boolean(stop.societyName || stop.parkingLevel || stop.parkingBay);
      if (captured.gpsSource === "permission_denied") {
        setSubmitError(isHindi ? "लोकेशन परमिशन बंद है। कृपया फोन सेटिंग्स में लोकेशन चालू करें।" : "Location permission denied. Please enable location in phone settings.");
        setStep("ready");
        return;
      }

      if ((captured.gpsUnavailable || captured.gpsSource === "low_accuracy") && !isBasement) {
        // Open street location cannot bypass GPS per SEC-024
        setSubmitError(isHindi ? "खुली सड़क पर सही GPS जरूरी है। कृपया फोन का GPS ऑन करें और खुले में आकर दोबारा फोटो लें।" : "Accurate GPS is mandatory for street cleanings. Turn on GPS and retake photo.");
        setStep("ready");
        return;
      }

      setPhoto(captured);
      setCapturedLocation({
        ...captured.location,
        gpsUnavailable: captured.gpsUnavailable,
        gpsUnavailableReason: captured.gpsUnavailableReason,
        weakGpsFallback: captured.weakGpsFallback,
      });
      setStep("processing");

      let ocrResult;
      try {
        ocrResult = await recognizePlateFromImage(captured.file);
      } catch (ocrErr) {
        console.warn("OCR recognition error:", ocrErr);
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

      // Alphanumeric comparison against assigned vehicle
      const cleanExpected = expectedRegNorm.replace(/[^A-Z0-9]/g, "");
      const cleanDetected = detected.replace(/[^A-Z0-9]/g, "");

      const isExact = cleanDetected.length >= 4 && cleanDetected === cleanExpected;
      const isSubMatch = cleanDetected.length >= 4 && (
        cleanExpected.includes(cleanDetected) || cleanDetected.includes(cleanExpected)
      );

      if (isExact || (isSubMatch && conf >= 50)) {
        setStep("verified");
      } else if (cleanDetected.length >= 4) {
        setStep("mismatch");
      } else {
        setStep("manual_fallback");
      }
    } catch (err) {
      if (isCameraCancel(err)) {
        setStep("ready");
        return;
      }
      const formatted = formatStaffOperationalError(err, isHindi);
      setSubmitError(formatted.description);
      toast({
        title: formatted.title,
        description: formatted.description,
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

    // Allow full match or last 4 digits match
    const isFullMatch = cleanEntered === cleanExpected;
    const isTailMatch = cleanEntered.length >= 4 && cleanExpected.endsWith(cleanEntered);

    if (!isFullMatch && !isTailMatch) {
      setManualError(t("manual_plate_match_error"));
      return;
    }

    setStep("verified");
  };

  const handleSubmitCompletion = async () => {
    if (!photo || !capturedLocation) return;
    try {
      setStep("submitting");
      setSubmitError(null);

      // Send locked capture-time GPS coordinates directly to server
      const result = await completeVisit.mutateAsync({
        subscriptionId: stop.subscriptionId,
        visitType,
        imageBase64: photo.dataUrl,
        exif: photo.exif,
        capturedAt: photo.capturedAt,
        walkIn: walkInMode,
        latitude: capturedLocation.latitude,
        longitude: capturedLocation.longitude,
        accuracy: capturedLocation.accuracy,
        gpsUnavailable: capturedLocation.gpsUnavailable,
        gpsUnavailableReason: capturedLocation.gpsUnavailableReason,
        ocrText: ocrRaw || "MANUAL_VERIFIED",
        ocrConfidence: ocrConfidence || null,
        confirmedRegistration: stop.vehicleNumber,
      });

      const isQueued = isOfflineQueued(result);
      if (isQueued) {
        toast({ title: t("photo_uploading"), description: queuedSavedMessage("visit") });
      } else {
        toast({ title: t("photo_success"), description: `${stop.vehicleNumber} — ${t("cleaning_complete")}` });
      }

      onSuccess(isQueued);
      onOpenChange(false);
    } catch (err) {
      setStep("verified");
      const msg = visitUploadErrorMessage(err);
      setSubmitError(msg);
      toast({ title: t("photo_failed_retry"), description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-2xl font-bold font-display tracking-tight text-foreground">
              {stop.vehicleNumber}
            </DialogTitle>
            <Badge variant="outline" className="font-mono text-xs px-2.5 py-1">
              {stop.vehicleMake} {stop.vehicleModel}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Customer: <span className="font-medium text-foreground">{stop.customerName}</span>
          </DialogDescription>
        </DialogHeader>

        {submitError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
            </div>
            {/permission|सेटिंग्स|settings|परमिशन/i.test(submitError) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-11 text-xs font-semibold gap-1.5"
                onClick={() => void openNativeAppSettings()}
              >
                <Settings size={14} />
                {t("open_app_settings")}
              </Button>
            )}
          </div>
        )}

        {/* STEP 1: Ready to start */}
        {step === "ready" && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-2 text-sm">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> {t("photo_take_near_car")}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                सफाई पूरी करने के बाद गाड़ी की नंबर प्लेट और रियर व्यू की फोटो लें। लोकेशन और प्लेट अपने आप वेरिफाई हो जाएंगे।
              </p>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold"
              onClick={() => void handleCaptureAndScan()}
              data-testid="dialog-capture-plate-btn"
            >
              <Camera className="mr-2 h-5 w-5" />
              {t("photo_take_near_car")}
            </Button>
          </div>
        )}

        {/* STEP 2: Processing OCR & Location */}
        {step === "processing" && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("photo_scanning_plate")}</p>
            <p className="text-xs text-muted-foreground">{t("loc_searching")}</p>
          </div>
        )}

        {/* STEP 3: Verified plate match */}
        {step === "verified" && (
          <div className="space-y-4">
            {photo?.dataUrl && (
              <div className="relative rounded-2xl overflow-hidden border border-border aspect-[4/3] bg-muted">
                <img
                  src={photo.dataUrl}
                  alt="Vehicle proof"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-emerald-600/90 text-white text-xs px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1">
                  <CheckCircle2 size={13} />
                  {t("plate_match_success")}
                </div>
                {capturedLocation?.gpsUnavailable ? (
                  <div className="absolute bottom-2 left-2 bg-amber-600/90 backdrop-blur-sm text-white text-[11px] px-2.5 py-0.5 rounded-md flex items-center gap-1 font-medium">
                    <AlertTriangle size={11} className="text-amber-200" />
                    <span>बेसमेंट पार्किंग (कमजोर GPS)</span>
                  </div>
                ) : capturedLocation?.weakGpsFallback ? (
                  <div className="absolute bottom-2 left-2 bg-blue-600/90 backdrop-blur-sm text-white text-[11px] px-2.5 py-0.5 rounded-md flex items-center gap-1 font-medium">
                    <MapPin size={11} className="text-blue-200" />
                    <span>कैंपस GPS लॉक</span>
                  </div>
                ) : capturedLocation ? (
                  <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1">
                    <MapPin size={11} className="text-emerald-400" />
                    <span>GPS Lock ±{Math.round(capturedLocation.accuracy ?? 10)}m</span>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12 text-xs font-semibold"
                onClick={() => void handleCaptureAndScan()}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {t("retry")}
              </Button>
              <Button
                className="flex-[2] h-12 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => void handleSubmitCompletion()}
                data-testid="dialog-submit-verified-btn"
              >
                <Check className="mr-1.5 h-4 w-4" />
                {t("complete_cleaning_action")}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Mismatch detected */}
        {step === "mismatch" && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 space-y-2 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-destructive" />
              <p className="text-sm font-bold text-destructive">
                {t("plate_mismatch_warning")}
              </p>
              <p className="text-xs text-muted-foreground">
                Assigned: <span className="font-bold text-foreground">{stop.vehicleNumber}</span>
              </p>
            </div>

            <Button
              className="w-full h-12 text-sm font-semibold"
              onClick={() => void handleCaptureAndScan()}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("photo_take_near_car")}
            </Button>
          </div>
        )}

        {/* STEP 5: Manual Plate Input Fallback */}
        {step === "manual_fallback" && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1.5">
              <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                {t("manual_plate_prompt")}
              </p>
              <p className="text-xs text-muted-foreground">
                गाड़ी: <span className="font-bold text-foreground">{stop.vehicleNumber}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="गाड़ी नंबर लिखें (जैसे 1234)"
                value={manualInput}
                onChange={e => {
                  setManualInput(e.target.value);
                  setManualError(null);
                }}
                className="h-12 text-base font-bold text-center tracking-wider uppercase rounded-xl"
                autoFocus
                data-testid="manual-plate-input"
              />
              {manualError && (
                <p className="text-xs text-destructive font-medium text-center">{manualError}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-12 text-xs font-semibold"
                onClick={() => void handleCaptureAndScan()}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                {t("retry")}
              </Button>
              <Button
                className="flex-1 h-12 text-sm font-semibold"
                onClick={handleConfirmManualRegistration}
                data-testid="dialog-confirm-manual-plate-btn"
              >
                {t("confirm_plate_btn")}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6: Submitting */}
        {step === "submitting" && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("photo_uploading")}</p>
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
