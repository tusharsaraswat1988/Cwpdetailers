import { Camera, CheckCircle, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media-url";
import type { GeoTaggedPhoto } from "@/lib/staff-jobs";
import { REQUIRED_SERVICE_PHOTOS } from "@/lib/staff-jobs";
import { mapsViewUrl } from "@/lib/maps";

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

  return (
    <div className="space-y-2" data-testid={`geo-photo-grid-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map((photo, index) => {
          const isUploading = uploadingIndex === index;
          if (photo) {
            const hasCoords =
              Number.isFinite(photo.latitude) &&
              Number.isFinite(photo.longitude) &&
              !(photo.latitude === 0 && photo.longitude === 0);
            const badge = (
              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-1 flex items-center gap-1">
                <CheckCircle size={10} className="text-green-400 shrink-0" />
                <span className="text-[9px] text-white truncate">
                  <MapPin size={8} className="inline mr-0.5" />
                  Geo tagged
                </span>
              </div>
            );
            return (
              <div
                key={`${photo.url}-${index}`}
                className="relative aspect-square rounded-xl overflow-hidden border border-green-500/40 bg-green-500/5"
              >
                <img
                  src={resolveMediaUrl(photo.url)}
                  alt={`${label} ${index + 1}`}
                  className="h-full w-full object-cover"
                />
                {hasCoords ? (
                  <a
                    href={mapsViewUrl(photo.latitude, photo.longitude)}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
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
                "relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors",
                canCapture
                  ? "border-primary/40 bg-primary/5 cursor-pointer hover:border-primary hover:bg-primary/10"
                  : "border-border bg-muted/30 opacity-60 cursor-not-allowed",
              )}
            >
              {isUploading ? (
                <Loader2 size={20} className="animate-spin text-primary" />
              ) : (
                <>
                  <Camera size={20} className={canCapture ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-[10px] font-medium text-muted-foreground">{index + 1}/{requiredCount}</span>
                </>
              )}
              {canCapture && (
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="absolute inset-0 opacity-0 cursor-pointer"
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
