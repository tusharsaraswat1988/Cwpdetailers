import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { VehicleReferencePhotos, type VehicleReferencePhotoSet } from "@/components/shared/VehicleReferencePhotos";
import { cn } from "@/lib/utils";

function formatVehicleLabel(make: string, model: string, color?: string | null): string {
  const base = [make, model].filter(Boolean).join(" ");
  return color ? `${base} ${color}` : base;
}

type Props = {
  detectedRegistration: string;
  ocrConfidence?: number;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor?: string | null;
  ownerName: string;
  referencePhotos: VehicleReferencePhotoSet;
  editable?: boolean;
  onRegistrationChange?: (value: string) => void;
  className?: string;
  compact?: boolean;
};

export function formatPlateVehicleLabel(
  make: string,
  model: string,
  color?: string | null,
): string {
  return formatVehicleLabel(make, model, color);
}

export function PlateVerifyCard({
  detectedRegistration,
  ocrConfidence,
  vehicleMake,
  vehicleModel,
  vehicleColor,
  ownerName,
  referencePhotos,
  editable = false,
  onRegistrationChange,
  className,
  compact = false,
}: Props) {
  const autoEligible = ocrConfidence != null && ocrConfidence > 90;

  return (
    <div className={cn("rounded-lg border bg-card overflow-hidden", className)}>
      <div className={cn("space-y-3", compact ? "p-3" : "p-4")}>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detected</p>
            {ocrConfidence != null && ocrConfidence > 0 && (
              <Badge variant={autoEligible ? "default" : "secondary"} className="text-[10px]">
                {Math.round(ocrConfidence)}%
              </Badge>
            )}
          </div>
          {editable && onRegistrationChange ? (
            <Input
              value={detectedRegistration}
              onChange={e => onRegistrationChange(e.target.value.toUpperCase())}
              className="font-mono text-lg tracking-wide h-10"
              placeholder="UP65AB1234"
            />
          ) : (
            <p className="font-mono text-lg font-semibold tracking-wide">{detectedRegistration}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1 border-t">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Vehicle</p>
            <p className="text-sm font-medium leading-snug">
              {formatVehicleLabel(vehicleMake, vehicleModel, vehicleColor)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Owner</p>
            <p className="text-sm font-medium leading-snug">{ownerName}</p>
          </div>
        </div>

        <div className="pt-1 border-t">
          <VehicleReferencePhotos photos={referencePhotos} variant="staff" />
        </div>
      </div>
    </div>
  );
}
