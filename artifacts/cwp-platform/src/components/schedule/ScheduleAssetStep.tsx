import { Link } from "wouter";
import { Car, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScheduleAsset } from "@/lib/schedule-journey";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { cn } from "@/lib/utils";

interface ScheduleAssetStepProps {
  vehicles: Array<{ id: number; make?: string; model?: string; registrationNumber?: string }>;
  solarSites: Array<{ id: number; address?: string; panelCount?: number }>;
  selected: ScheduleAsset | null;
  onSelect: (asset: ScheduleAsset) => void;
}

export function ScheduleAssetStep({ vehicles, solarSites, selected, onSelect }: ScheduleAssetStepProps) {
  if (vehicles.length === 0 && solarSites.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center space-y-3" data-testid="schedule-error-no-asset">
        <p className="font-medium">No vehicles or solar sites yet</p>
        <p className="text-sm text-muted-foreground">Add an asset so CWP knows what to service.</p>
        <Link href={CUSTOMER_ROUTES.assets}>
          <Button>Add Vehicle or Solar Site</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="schedule-step-asset">
      {vehicles.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Car size={12} /> Vehicles
          </p>
          {vehicles.map(v => {
            const asset: ScheduleAsset = {
              kind: "vehicle",
              id: v.id,
              name: [v.make, v.model].filter(Boolean).join(" ") || "Vehicle",
              subtitle: v.registrationNumber ?? "",
              location: null,
            };
            const isSelected = selected?.kind === "vehicle" && selected.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(asset)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                )}
                data-testid={`schedule-asset-vehicle-${v.id}`}
              >
                <p className="font-medium text-sm">{asset.name}</p>
                <p className="text-xs text-muted-foreground">{asset.subtitle}</p>
              </button>
            );
          })}
        </div>
      )}
      {solarSites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Sun size={12} /> Solar Sites
          </p>
          {solarSites.map(s => {
            const asset: ScheduleAsset = {
              kind: "solar",
              id: s.id,
              name: "Solar Site",
              subtitle: s.panelCount ? `${s.panelCount} panels` : s.address ?? "",
              location: null,
            };
            const isSelected = selected?.kind === "solar" && selected.id === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(asset)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-all",
                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                )}
                data-testid={`schedule-asset-solar-${s.id}`}
              >
                <p className="font-medium text-sm truncate">{s.address ?? "Solar site"}</p>
                <p className="text-xs text-muted-foreground">{asset.subtitle}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ScheduleAssetStep;
