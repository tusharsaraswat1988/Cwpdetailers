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
  Droplets,
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
    title: "गाड़ी मिल गई — सफाई करें (Clean Vehicle)",
    subtitle: "गाड़ी मौजूद है। नंबर प्लेट और सफाई की फोटो लेकर सबमिट करें।",
    icon: Sparkles,
    category: "primary",
    badgeText: "Standard Clean",
    actionColor: "text-emerald-700 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20",
  },
  {
    id: "car_not_available",
    title: "गाड़ी मौजूद नहीं है (Car Not Available)",
    subtitle: "असाइन की गई बे या पार्किंग में गाड़ी नहीं मिली। खाली जगह की फोटो लें।",
    icon: CarFront,
    category: "exception",
    badgeText: "Vehicle Absent",
    actionColor: "text-amber-800 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20",
  },
  {
    id: "plate_not_visible",
    title: "नंबर प्लेट नहीं दिख रही (Plate Obscured)",
    subtitle: "कार कवर चढ़ा है या नंबर प्लेट ढकी/गंदी है। फोटो लेकर दर्ज करें।",
    icon: EyeOff,
    category: "exception",
    badgeText: "Plate Obscured",
    actionColor: "text-orange-800 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20",
  },
  {
    id: "customer_skip",
    title: "ग्राहक ने मना किया (Customer Skip)",
    subtitle: "ग्राहक ने आज गाड़ी धोने से मना किया है या यात्रा पर हैं।",
    icon: UserX,
    category: "exception",
    badgeText: "Customer Request",
    actionColor: "text-blue-800 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
  },
  {
    id: "access_denied",
    title: "पार्किंग में प्रवेश नहीं मिला (Access Denied)",
    subtitle: "गेट गार्ड ने एंट्री नहीं दी या बेसमेंट बंद मिला।",
    icon: Lock,
    category: "exception",
    badgeText: "Access Denied",
    actionColor: "text-rose-800 bg-rose-500/10 border-rose-500/30 hover:bg-rose-500/20",
  },
  {
    id: "water_unavailable",
    title: "पानी उपलब्ध नहीं (Water Unavailable)",
    subtitle: "सोसायटी या पार्किंग में पानी की सुविधा उपलब्ध नहीं है।",
    icon: Droplets,
    category: "exception",
    badgeText: "No Water",
    actionColor: "text-cyan-800 bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20",
  },
  {
    id: "already_cleaned",
    title: "गाड़ी पहले से साफ है (Already Cleaned)",
    subtitle: "मालिक या ड्राइवर ने गाड़ी पहले ही धो ली है।",
    icon: CheckCircle2,
    category: "exception",
    badgeText: "Already Done",
    actionColor: "text-teal-800 bg-teal-500/10 border-teal-500/30 hover:bg-teal-500/20",
  },
  {
    id: "issue_reported",
    title: "गाड़ी में डैमेज या समस्या (Vehicle Damage/Issue)",
    subtitle: "गाड़ी पर पहले से गहरा स्क्रैच, डेंट या पंचर है। फोटो प्रमाण लें।",
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
        {selectedException ? (
          /* EXCEPTION DETAILS STEP */
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-[44px] min-w-[44px] p-0 flex items-center justify-center rounded-xl"
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
              <p className="text-[11px] text-muted-foreground/90 italic">
                सूचना: इस गाड़ी का एक्सेप्शन दर्ज हो जाएगा, ग्राहक का कोटा सुरक्षित रहेगा और एडमिन को सूचित किया जाएगा।
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                कारण / टिप्पणी (वैकल्पिक)
              </label>
              <Textarea
                placeholder="उदा: बे में गाड़ी मौजूद नहीं थी, गार्ड ने बताया गाड़ी सर्विस सेंटर गई है..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="text-xs min-h-[70px] resize-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>खाली बे / साइट का फोटो (अनिवार्य प्रमाण)</span>
                {photo ? (
                  <span className="text-[11px] text-emerald-600 font-medium">✓ फोटो ली गई</span>
                ) : (
                  <span className="text-[11px] text-rose-600 font-medium">* फोटो जरूरी है</span>
                )}
              </label>

              {photo ? (
                <div className="relative rounded-xl overflow-hidden border border-border bg-black max-h-36 flex items-center justify-center">
                  <img src={photo.dataUrl} alt="Evidence" className="max-h-36 object-contain" />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 text-xs min-h-[36px] px-3 font-semibold rounded-lg shadow-sm"
                    onClick={() => void handleCaptureEvidencePhoto()}
                  >
                    दोबारा लें
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 border-dashed border-primary/40 bg-primary/5 text-xs text-primary font-semibold flex items-center justify-center gap-2 hover:bg-primary/10"
                  onClick={() => void handleCaptureEvidencePhoto()}
                  data-testid="btn-capture-exception-photo"
                >
                  <Camera size={16} />
                  <span>खाली बे / गेट की फोटो खींचें</span>
                </Button>
              )}
              {!photo && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  कृपया आगे बढ़ने के लिए खाली पार्किंग या स्थान का फोटो लें।
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12 text-xs"
                onClick={() => setSelectedException(null)}
                disabled={isSubmitting}
              >
                रद्द करें
              </Button>
              <Button
                className="flex-1 h-12 text-xs font-semibold"
                onClick={() => void handleSubmitException()}
                disabled={isSubmitting || !photo}
                data-testid="btn-confirm-exception"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    सेव हो रहा है...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} className="mr-1.5" />
                    दर्ज करें व सेव करें
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
