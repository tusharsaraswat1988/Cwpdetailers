import { Camera, CheckCircle, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";
import type { GeoTaggedPhoto } from "@/lib/staff-jobs";
import { REQUIRED_SERVICE_PHOTOS } from "@/lib/staff-jobs";
import { mapsViewUrl } from "@/lib/maps";
import { StaffSyncChip } from "@/features/staff-ds";

type Props = {
  label: string;
  description: string;
  photos: GeoTaggedPhoto[];
  requiredCount?: number;
  uploadingIndex?: number | null;
  disabled?: boolean;
  onCapture: (file: File) => void;
};

export function GeoPhotoSlotGrid({
  label,
  description,
  photos,
  requiredCount = REQUIRED_SERVICE_PHOTOS,
  uploadingIndex,
  disabled,
  onCapture,
}: Props) {
  const slots = Array.from({ length: requiredCount }, (_, i) => photos[i] ?? null);
  const isUploadingAny = uploadingIndex != null;

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
            <label
              key={index}
              className={cn(
                "staff-photo-slot staff-tap staff-transition relative",
                canCapture
                  ? "cursor-pointer border-primary/40 bg-primary/5 hover:border-primary hover:bg-primary/10"
                  : "cursor-not-allowed opacity-60",
              )}
            >
              {isUploading ? (
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
              {canCapture && (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Capture ${label} photo ${index + 1}`}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) onCapture(f);
                    e.target.value = "";
                  }}
                />
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}
