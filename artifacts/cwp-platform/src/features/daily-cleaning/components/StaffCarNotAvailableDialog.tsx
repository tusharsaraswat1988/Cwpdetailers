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
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, AlertCircle, MapPin } from "lucide-react";
import { captureStaffPhoto, isCameraCancel } from "@/lib/native/captureStaffPhoto";
import { getStaffLocation } from "@/lib/location";
import { isOfflineQueued, queuedSavedMessage } from "@/services/queuedResult";
import { visitUploadErrorMessage } from "../lib/visitUploadError";
import { useRecordCarNotAvailable } from "../api";
import type { CleanDialogStop } from "./StaffVehicleCleanDialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop: CleanDialogStop | null;
  walkInMode?: boolean;
  onSuccess: () => void;
};

export function StaffCarNotAvailableDialog({
  open,
  onOpenChange,
  stop,
  walkInMode = false,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const recordCarNotAvailable = useRecordCarNotAvailable();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!stop) return null;

  const handleCaptureAndRecord = async () => {
    try {
      setErrorMsg(null);
      const photo = await captureStaffPhoto("rear");
      setIsSubmitting(true);

      const gps = await getStaffLocation("action");
      const result = await recordCarNotAvailable.mutateAsync({
        subscriptionId: stop.subscriptionId,
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
          description: `${stop.vehicleNumber} — car nahi mili, cleaning count nahi kata`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      if (isCameraCancel(err)) return;
      const msg = visitUploadErrorMessage(err);
      setErrorMsg(msg);
      toast({ title: "Record failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-xl font-bold font-display tracking-tight text-amber-900">
              Gaadi nahi mili?
            </DialogTitle>
            <Badge variant="outline" className="border-amber-500/40 text-amber-800 bg-amber-500/10 text-xs">
              Exception Flow
            </Badge>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Customer aur vehicle confirm karein:
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-base font-bold">{stop.vehicleNumber}</span>
            <span className="text-xs text-muted-foreground">{stop.vehicleMake} {stop.vehicleModel}</span>
          </div>
          <p className="text-sm text-foreground">
            Customer: <span className="font-medium">{stop.customerName}</span>
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2 text-xs text-amber-950">
          <p className="font-semibold flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-amber-700 shrink-0" />
            Jagah ki photo aur GPS proof zaroori hai
          </p>
          <p className="text-amber-900 leading-relaxed">
            Proof ke liye ki aap service location par gaye the, khali parking spot ki photo lein.
            Customer ka cleaning credit <strong>nahi katega</strong>. Plate scan ki zaroorat nahi hai.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Wapas
          </Button>
          <Button
            className="flex-1 min-h-[2.75rem] bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => void handleCaptureAndRecord()}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-1.5 h-4 w-4" />
            )}
            Photo lein & record karein
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
