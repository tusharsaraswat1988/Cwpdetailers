import { resolveMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

export type VehicleReferencePhotoSet = {
  front: string | null;
  rear: string | null;
  left: string | null;
  right: string | null;
};

/** Map API vehicle record fields to a photo set. */
export function vehiclePhotosFromRecord(vehicle: {
  refPhotoFrontUrl?: string | null;
  refPhotoRearUrl?: string | null;
  refPhotoLeftUrl?: string | null;
  refPhotoRightUrl?: string | null;
}): VehicleReferencePhotoSet {
  return {
    front: vehicle.refPhotoFrontUrl ?? null,
    rear: vehicle.refPhotoRearUrl ?? null,
    left: vehicle.refPhotoLeftUrl ?? null,
    right: vehicle.refPhotoRightUrl ?? null,
  };
}

const SLOT_LABELS: { key: keyof VehicleReferencePhotoSet; label: string; required?: boolean }[] = [
  { key: "front", label: "Front", required: true },
  { key: "rear", label: "Rear", required: true },
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
];

type Props = {
  photos: VehicleReferencePhotoSet;
  variant?: "thumbnails" | "staff";
  className?: string;
  onPhotoClick?: (slot: keyof VehicleReferencePhotoSet) => void;
};

export function VehicleReferencePhotos({ photos, variant = "thumbnails", className, onPhotoClick }: Props) {
  const hasRequired = Boolean(photos.front && photos.rear);
  const thumbClass = variant === "staff" ? "w-20 h-16" : "w-16 h-14";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Reference photos</p>
        {!hasRequired && (
          <span className="text-[10px] text-amber-600">Front & rear required</span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SLOT_LABELS.map(({ key, label, required }) => {
          const url = photos[key];
          return (
            <button
              key={key}
              type="button"
              disabled={!url || !onPhotoClick}
              onClick={() => url && onPhotoClick?.(key)}
              className={cn(
                "rounded-lg border overflow-hidden text-left",
                url ? "border-border bg-muted" : "border-dashed border-muted-foreground/30 bg-muted/30",
                onPhotoClick && url && "hover:ring-2 hover:ring-primary/40",
              )}
            >
              {url ? (
                <img
                  src={resolveMediaUrl(url)}
                  alt={`${label} view`}
                  className={cn(thumbClass, "w-full object-cover")}
                />
              ) : (
                <div className={cn(thumbClass, "w-full flex items-center justify-center text-[10px] text-muted-foreground px-1 text-center")}>
                  No {label.toLowerCase()}
                </div>
              )}
              <p className="text-[10px] text-center py-0.5 text-muted-foreground">
                {label}{required ? " *" : ""}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function hasRequiredReferencePhotos(photos: VehicleReferencePhotoSet): boolean {
  return Boolean(photos.front && photos.rear);
}
