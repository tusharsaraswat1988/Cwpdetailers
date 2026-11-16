import { useState } from "react";
import { Camera, CheckCircle, Loader2, MapPin, RotateCcw, AlertTriangle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";
import type { GeoTaggedPhoto } from "@/lib/staff-jobs";
import { REQUIRED_SERVICE_PHOTOS } from "@/lib/staff-jobs";
import { mapsViewUrl } from "@/lib/maps";
import { StaffSyncChip } from "@/features/staff-ds";
import {
  captureStaffPhotoWithGps,
  isCameraCancel,
  isCameraPermissionDenied,
  type CapturedStaffPhotoWithGps,
} from "@/lib/native/captureStaffPhoto";
import { openNativeAppSettings } from "@/lib/location/nativeGeolocation";
import { useStaffLanguage } from "@/lib/staffLanguage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  description: string;
  photos: GeoTaggedPhoto[];
  requiredCount?: number;
  uploadingIndex?: number | null;
  disabled?: boolean;
  onCapture: (file: File, evidence?: CapturedStaffPhotoWithGps) => void;
  onCaptureError?: (err: unknown) => void;
};

export function GeoPhotoSlotGrid({
  label,
  description,
  photos,
  requiredCount = REQUIRED_SERVICE_PHOTOS,
  uploadingIndex,
  disabled,
  onCapture,
  onCaptureError,
}: Props) {
  const { t, isHindi } = useStaffLanguage();
  const [pendingPreview, setPendingPreview] = useState<CapturedStaffPhotoWithGps | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const slots = Array.from({ length: requiredCount }, (_, i) => photos[i] ?? null);
  const isUploadingAny = uploadingIndex != null;

  const handleTriggerCapture = async () => {
    setIsCapturing(true);
    setPermissionError(null);
    try {
      const captured = await captureStaffPhotoWithGps("rear");
      setPendingPreview(captured);
    } catch (err) {
      if (isCameraCancel(err)) return;
      if (isCameraPermissionDenied(err)) {
        setPermissionError(t("camera_permission_denied"));
        return;
      }
      onCaptureError?.(err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setPendingPreview(null);
    void handleTriggerCapture();
  };

  const handleConfirm = () => {
    if (!pendingPreview) return;
    const photoToUpload = pendingPreview;
    setPendingPreview(null);
    onCapture(photoToUpload.file, photoToUpload);
  };

  return (
    <div
      className="space-y-2"
      data-testid={`geo-photo-grid-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {isUploadingAny ? <StaffSyncChip state="uploading" /> : null}
      </div>

      {permissionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rose-800 dark:text-rose-300">{permissionError}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isHindi
                  ? "फोन की सेटिंग्स में जाकर CWP Detailers ऐप को कैमरा परमिशन दें।"
                  : "Enable camera permission for CWP Detailers in Android Settings."}
              </p>
            </div>
          </div>
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
        </div>
      )}

      <div className="staff-photo-grid">
        {slots.map((photo, index) => {
          const isUploading = uploadingIndex === index;
          if (photo) {
            const hasCoords =
              Number.isFinite(photo.latitude) &&
              Number.isFinite(photo.longitude) &&
              !(photo.latitude === 0 && photo.longitude === 0);
            const badge = (
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/55 px-1.5 py-1">
                <CheckCircle size={10} className="shrink-0 text-[hsl(var(--tone-success))]" aria-hidden />
                <span className="truncate text-[9px] text-white">
                  <MapPin size={8} className="mr-0.5 inline" aria-hidden />
                  Geo tagged
                </span>
              </div>
            );
            return (
              <div
                key={`${photo.url}-${index}`}
                className="staff-photo-slot relative"
                data-filled="true"
              >
                <img
                  src={resolveMediaUrl(photo.url)}
                  alt={`${label} ${index + 1}`}
                />
                {hasCoords ? (
                  <a
                    href={mapsViewUrl(photo.latitude, photo.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute inset-0 block"
                    title="Open capture location on Google Maps"
                    onClick={e => e.stopPropagation()}
                  >
                    {badge}
                  </a>
                ) : (
                  badge
                )}
              </div>
            );
          }

          const canCapture = !disabled && photos.length === index && uploadingIndex == null;

          return (
            <div
              key={index}
              className={cn(
                "staff-photo-slot staff-tap staff-transition relative",
                canCapture
                  ? "cursor-pointer border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                  : "cursor-not-allowed opacity-60",
              )}
            >
              {isUploading || (canCapture && isCapturing) ? (
                <Loader2 size={20} className="animate-spin text-primary" aria-hidden />
              ) : (
                <>
                  <Camera
                    size={20}
                    className={canCapture ? "text-primary" : "text-muted-foreground"}
                    aria-hidden
                  />
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {index + 1}/{requiredCount}
                  </span>
                </>
              )}
              {canCapture && !isCapturing && (
                <button
                  type="button"
                  className="absolute inset-0 cursor-pointer"
                  aria-label={`Capture ${label} photo ${index + 1}`}
                  onClick={() => void handleTriggerCapture()}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Photo Preview & Retake Modal */}
      <Dialog open={pendingPreview != null} onOpenChange={open => { if (!open) setPendingPreview(null); }}>
        <DialogContent className="max-w-sm p-4 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center justify-between">
              <span>{t("photo_preview_title")}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {pendingPreview?.location ? (
                  pendingPreview.gpsSource === "fresh_shutter" ? (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <CheckCircle size={12} /> {t("gps_verified")}
                    </span>
                  ) : pendingPreview.gpsSource === "last_known_fallback" ? (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <MapPin size={12} /> {t("gps_basement_fallback")}
                    </span>
                  ) : (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <AlertTriangle size={12} /> {t("gps_weak_warning")}
                    </span>
                  )
                ) : null}
              </span>
            </DialogTitle>
          </DialogHeader>

          {pendingPreview?.dataUrl && (
            <div className="aspect-[4/3] rounded-xl overflow-hidden bg-black border border-border">
              <img
                src={pendingPreview.dataUrl}
                alt="Preview"
                className="h-full w-full object-contain"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 text-xs font-semibold gap-1.5"
              onClick={handleRetake}
              disabled={isCapturing}
            >
              <RotateCcw size={14} />
              {t("retake_photo")}
            </Button>
            <Button
              type="button"
              className="flex-1 h-12 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
              disabled={isCapturing}
            >
              <CheckCircle size={14} />
              {t("confirm_photo_btn")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
