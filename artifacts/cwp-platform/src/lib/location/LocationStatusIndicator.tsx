import { MapPin, Loader2, MapPinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStaffLocation } from "./LocationProvider";

export function LocationStatusIndicator({ className }: { className?: string }) {
  const { permissionState, gpsReady, isRefreshing } = useStaffLocation();

  if (permissionState === "unsupported" || permissionState === "denied") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive",
          className,
        )}
        data-testid="location-status"
        title="GPS off"
      >
        <MapPinOff size={11} />
        GPS Off
      </span>
    );
  }

  if (permissionState === "checking") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
          className,
        )}
        data-testid="location-status"
        title="Checking permission"
      >
        <Loader2 size={11} className="animate-spin" />
        Checking…
      </span>
    );
  }

  if (permissionState === "prompt") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700",
          className,
        )}
        data-testid="location-status"
        title="Location permission needed"
      >
        <MapPin size={11} />
        GPS Off
      </span>
    );
  }

  if (isRefreshing || !gpsReady) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
          className,
        )}
        data-testid="location-status"
        title="Checking GPS"
      >
        <Loader2 size={11} className="animate-spin" />
        Checking…
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-700",
        className,
      )}
      data-testid="location-status"
      title="GPS ready"
    >
      <MapPin size={11} />
      GPS Ready
    </span>
  );
}
