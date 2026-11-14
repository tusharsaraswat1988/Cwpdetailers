import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Camera,
  CarFront,
  EyeOff,
  UserX,
  Lock,
  AlertTriangle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";
import { captureStaffPhoto, isCameraCancel, type StaffCapturedPhoto } from "@/lib/native/captureStaffPhoto";
import { getStaffLocation } from "@/lib/location";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { useRecordCarNotAvailable } from "../api";
import {
  saveDcmsLocalRecord,
  type DcmsLocalCompletionType,
} from "../lib/dcmsLocalStorage";
import type { CleanDialogStop } from "./StaffVehicleCleanDialog";

export type StaffActionOption = {
  id: DcmsLocalCompletionType;
  title: string;
  subtitle: string;
  icon: typeof Sparkles;
  category: "primary" | "exception";
  badgeText?: string;
  actionColor: string;
};

const ACTION_OPTIONS: StaffActionOption[] = [
  {
    id: "completed",
    title: "Car Found — Cleaning Completed",
    subtitle: "Car mil gayi. Plate verify karein aur clean photo capture karein.",
    icon: Sparkles,
    category: "primary",
    badgeText: "Standard Flow",
    actionColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "car_not_available",
    title: "Car Not Available",
    subtitle: "Assigned parking bay me gaadi maujood nahi hai.",
    icon: CarFront,
    category: "exception",
    badgeText: "Vehicle Absent",
    actionColor: "text-amber-800 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
  },
  {
    id: "plate_not_visible",
    title: "Vehicle Number Not Visible",
    subtitle: "Car cover laga hai ya number plate gandi / dabi hui hai.",
    icon: EyeOff,
    category: "exception",
    badgeText: "Plate Obscured",
    actionColor: "text-orange-800 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20",
  },
  {
    id: "customer_skip",
    title: "Customer Requested Skip",
    subtitle: "Customer ne aaj car saaf na karne ki request ki hai.",
    icon: UserX,
    category: "exception",
    badgeText: "Customer Request",
    actionColor: "text-blue-800 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
  },
  {
    id: "access_denied",
    title: "Unable to Access Parking",
    subtitle: "Gate pe guard ne entry nahi di ya basement locked hai.",
    icon: Lock,
    category: "exception",
    badgeText: "Access Denied",
    actionColor: "text-rose-800 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20",
  },
  {
    id: "issue_reported",
    title: "Report Vehicle Issue",
    subtitle: "Car me pehle se scratch, flat tyre ya koi nuksan hai.",
    icon: AlertTriangle,
    category: "exception",
    badgeText: "Report Issue",
    actionColor: "text-purple-800 bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: CleanDialogStop | null;
  staffId?: number | null;
  walkInMode?: boolean;
  onStartClean: (stop: CleanDialogStop) => void;
  onSuccess: () => void;
};

export function StaffExecutionActionsSheet({
  open,
  onOpenChange,
  stop,
  staffId,
  walkInMode = false,
  onStartClean,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const recordCarNotAvailable = useRecordCarNotAvailable();

  const [selectedException, setSelectedException] = useState<StaffActionOption | null>(null);
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<StaffCapturedPhoto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!stop) return null;

  const handleSelectOption = (opt: StaffActionOption) => {
    if (opt.id === "completed") {
      onOpenChange(false);
      onStartClean(stop);
      return;
    }
    setSelectedException(opt);
    setNotes("");
    setPhoto(null);
    setSubmitError(null);
  };

  const handleCaptureEvidencePhoto = async () => {
    try {
      const captured = await captureStaffPhoto("rear");
      setPhoto(captured);
    } catch (err) {
      if (isCameraCancel(err)) return;
      toast({
        title: "Camera error",
        description: err instanceof Error ? err.message : "Failed to capture evidence",
        variant: "destructive",
      });
    }
  };

  const handleSubmitException = async () => {
    if (!selectedException) return;

    try {
      setIsSubmitting(true);
      setSubmitError(null);

      // Save locally first for high reliability in basement / low-connectivity
      if (staffId) {
        saveDcmsLocalRecord(staffId, {
          subscriptionId: stop.subscriptionId,
          vehicleNumber: stop.vehicleNumber,
          status: selectedException.id,
          actionLabel: selectedException.title,
          notes: notes.trim() || undefined,
        });
      }

      const gps = await getStaffLocation("action");
      const result = await recordCarNotAvailable.mutateAsync({
        subscriptionId: stop.subscriptionId,
        walkIn: walkInMode,
        reason: `${selectedException.id.toUpperCase()}: ${notes.trim() || selectedException.title}`,
        imageBase64: photo?.dataUrl ?? "",
        exif: photo?.exif,
        capturedAt: photo?.capturedAt ?? new Date().toISOString(),
        ...gps,
      });

      if (isOfflineQueued(result)) {
        toast({
          title: "Status phone pe save ho gaya",
          description: queuedSavedMessage("visit"),
        });
      } else {
        toast({
          title: "Task status recorded",
          description: `${stop.vehicleNumber}: ${selectedException.title}`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      const msg = visitUploadErrorMessage(err);
      setSubmitError(msg);
      toast({ title: "Recording failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4">
        {selectedException ? (
          /* EXCEPTION DETAILS STEP */
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setSelectedException(null)}
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold truncate">
                  {selectedException.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate">
                  {stop.vehicleNumber} • {stop.vehicleMake} {stop.vehicleModel}
                </DialogDescription>
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 text-xs">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <selectedException.icon size={14} className="text-primary" />
                {selectedException.title}
              </p>
              <p className="text-muted-foreground">{selectedException.subtitle}</p>
              <p className="text-[11px] text-muted-foreground/80 italic">
                Notice: Is car ka cleaning visit record ho jayega aur customer ka cleaning quota safe rahega.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Remark / Reason (Optional)
              </label>
              <Textarea
                placeholder="Ex: Bay 42 pe koi gaadi nahi thi, guard ne bola car service pe gayi hai..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs min-h-[70px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Proof / Location Photo (Optional)</span>
                {photo && <span className="text-[11px] text-emerald-600 font-medium">Photo attached</span>}
              </label>

              {photo ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-black max-h-36 flex items-center justify-center">
                  <img src={photo.dataUrl} alt="Evidence" className="max-h-36 object-contain" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 text-xs h-7 px-2"
                    onClick={() => void handleCaptureEvidencePhoto()}
                  >
                    Retake
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 border-dashed text-xs text-muted-foreground flex items-center justify-center gap-2"
                  onClick={() => void handleCaptureEvidencePhoto()}
                >
                  <Camera size={14} />
                  Empty Bay / Gate Photo capture karein
                </Button>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-11 text-xs"
                onClick={() => setSelectedException(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-11 text-xs font-semibold"
                onClick={() => void handleSubmitException()}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="mr-1.5" />
                    Confirm & Save
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          /* OPTION SELECTION STEP */
          <div className="space-y-3">
            <DialogHeader className="text-left space-y-1">
              <div className="flex items-center justify-between gap-2">
                <DialogTitle className="text-lg font-bold font-display tracking-tight text-foreground">
                  Task Actions
                </DialogTitle>
                <Badge variant="outline" className="font-mono text-xs font-bold text-foreground">
                  {stop.vehicleNumber}
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground">
                Customer: <span className="font-medium text-foreground">{stop.customerName}</span> •{" "}
                {stop.vehicleMake} {stop.vehicleModel}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 pt-1" data-testid="staff-actions-options-list">
              {ACTION_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isPrimary = opt.category === "primary";

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectOption(opt)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isPrimary
                        ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-950 dark:text-emerald-100"
                        : "border-border/80 bg-card hover:bg-muted/50 text-foreground"
                    }`}
                    data-testid={`staff-action-${opt.id}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${
                          isPrimary
                            ? "bg-emerald-600 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate leading-tight">
                            {opt.title}
                          </p>
                          {opt.badgeText && (
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md ${
                                isPrimary
                                  ? "bg-emerald-600/20 text-emerald-800 dark:text-emerald-200"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {opt.badgeText}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {opt.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
