import { useState, useEffect } from "react";
import { VehicleReferencePhotos, type VehicleReferencePhotoSet } from "./VehicleReferencePhotos";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { uploadFileToCloudinary } from "@/lib/media-url";
import { Loader2, Upload } from "lucide-react";

type Slot = keyof VehicleReferencePhotoSet;

const SLOTS: { key: Slot; label: string; required?: boolean }[] = [
  { key: "front", label: "Front View", required: true },
  { key: "rear", label: "Rear View", required: true },
  { key: "left", label: "Left View" },
  { key: "right", label: "Right View" },
];

async function requestUploadUrl(file: File) {
  const res = await fetch("/api/storage/uploads/request-url", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!res.ok) throw new Error("Upload not authorized");
  return res.json();
}

async function saveReferencePhotos(vehicleId: number, photos: Partial<VehicleReferencePhotoSet>) {
  const res = await fetch(`/api/vehicles/${vehicleId}/reference-photos`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(photos),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to save photos");
  }
  return res.json();
}

type Props = {
  vehicleId: number;
  initialPhotos: VehicleReferencePhotoSet;
  onUpdated?: (photos: VehicleReferencePhotoSet) => void;
  compact?: boolean;
};

export function VehicleReferencePhotoEditor({ vehicleId, initialPhotos, onUpdated, compact }: Props) {
  const { toast } = useToast();
  const [photos, setPhotos] = useState<VehicleReferencePhotoSet>(initialPhotos);
  const [uploading, setUploading] = useState<Slot | null>(null);

  useEffect(() => {
    setPhotos(initialPhotos);
  }, [vehicleId, initialPhotos.front, initialPhotos.rear, initialPhotos.left, initialPhotos.right]);

  const handleUpload = async (slot: Slot, file: File) => {
    setUploading(slot);
    try {
      const presign = await requestUploadUrl(file);
      const url = await uploadFileToCloudinary(file, presign);
      const result = await saveReferencePhotos(vehicleId, { [slot]: url });
      const updated = (result as { photos: VehicleReferencePhotoSet }).photos;
      setPhotos(updated);
      onUpdated?.(updated);
      toast({ title: `${SLOTS.find(s => s.key === slot)?.label} saved` });
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <VehicleReferencePhotos photos={photos} />
        <div className="grid grid-cols-2 gap-2">
          {SLOTS.map(({ key, label }) => (
            <label key={key} className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(key, f);
                  e.target.value = "";
                }}
              />
              <Button type="button" variant="outline" size="sm" className="w-full text-xs pointer-events-none" disabled={uploading === key}>
                {uploading === key ? <Loader2 className="h-3 w-3 animate-spin mr-1 inline" /> : <Upload className="h-3 w-3 mr-1 inline" />}
                {photos[key] ? "Replace" : "Upload"} {label}
              </Button>
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VehicleReferencePhotos photos={photos} variant="staff" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SLOTS.map(({ key, label, required }) => (
          <label key={key} className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(key, f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" className="w-full h-auto py-2 flex-col gap-0.5 pointer-events-none" disabled={uploading === key}>
              {uploading === key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              <span className="text-[10px]">{label}{required ? " *" : ""}</span>
            </Button>
          </label>
        ))}
      </div>
    </div>
  );
}
