import { MaterialSymbol } from "@/lib/design-system/MaterialSymbol";
import { Button } from "@/components/ui/button";
import type { ScheduleAsset } from "@/lib/schedule-journey";
import { cn } from "@/lib/utils";

interface ScheduleAssetStepProps {
  vehicles: Array<{ id: number; make?: string; model?: string; registrationNumber?: string }>;
  solarSites: Array<{ id: number; address?: string; panelCount?: number }>;
  selected: ScheduleAsset | null;
  targetKind?: "vehicle" | "solar";
  onAddAsset?: () => void;
  onSelect: (asset: ScheduleAsset) => void;
}

export function ScheduleAssetStep({
  vehicles,
  solarSites,
  selected,
  targetKind,
  onAddAsset,
  onSelect,
}: ScheduleAssetStepProps) {
  // Scenario 1: Solar booking mode
  if (targetKind === "solar") {
    if (solarSites.length === 0) {
      return (
        <div
          className="rounded-2xl border border-dashed border-amber-300/80 p-8 text-center space-y-3 bg-amber-50/30"
          data-testid="schedule-empty-solar"
        >
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
            <MaterialSymbol name="wb_sunny" size={24} />
          </div>
          <p className="font-display font-bold text-base text-foreground">No solar site added yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Add your rooftop solar plant to schedule professional de-mineralized cleaning.
          </p>
          {onAddAsset ? (
            <Button
              type="button"
              onClick={onAddAsset}
              className="mt-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold cursor-pointer gap-1.5"
              data-testid="schedule-add-solar-btn"
            >
              <MaterialSymbol name="add" size={16} />
              Add Solar Site
            </Button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="schedule-step-asset">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MaterialSymbol name="wb_sunny" size={15} className="text-amber-600" />
              Select Solar Site
            </p>
            {onAddAsset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddAsset}
                className="h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1 px-2 cursor-pointer"
                data-testid="schedule-add-another-solar"
              >
                <MaterialSymbol name="add" size={14} />
                Add New Site
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {solarSites.map((s) => {
              const asset: ScheduleAsset = {
                kind: "solar",
                id: s.id,
                name: "Rooftop Solar Site",
                subtitle: s.panelCount ? `${s.panelCount} panels · ${s.address ?? ""}` : s.address ?? "",
                location: null,
              };
              const isSelected = selected?.kind === "solar" && selected.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-3 shadow-xs cursor-pointer",
                    isSelected
                      ? "border-amber-600 bg-amber-50/70 ring-2 ring-amber-600/20 shadow-sm"
                      : "border-slate-200/90 bg-white hover:border-amber-500/40 hover:shadow-sm",
                  )}
                  data-testid={`schedule-asset-solar-${s.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isSelected ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-600",
                      )}
                    >
                      <MaterialSymbol name="wb_sunny" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{asset.subtitle}</p>
                    </div>
                  </div>
                  {isSelected && <MaterialSymbol name="check_circle" size={18} className="text-amber-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Scenario 2: Vehicle booking mode
  if (targetKind === "vehicle") {
    if (vehicles.length === 0) {
      return (
        <div
          className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 bg-white"
          data-testid="schedule-empty-vehicle"
        >
          <div className="w-12 h-12 rounded-full bg-blue-50 text-primary mx-auto flex items-center justify-center">
            <MaterialSymbol name="directions_car" size={24} />
          </div>
          <p className="font-display font-bold text-base text-foreground">No vehicles added yet.</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Add a vehicle so CWP knows what car to service.
          </p>
          {onAddAsset ? (
            <Button
              type="button"
              onClick={onAddAsset}
              className="mt-2 rounded-xl cursor-pointer gap-1.5"
              data-testid="schedule-add-vehicle-btn"
            >
              <MaterialSymbol name="add" size={16} />
              Add Vehicle
            </Button>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-4" data-testid="schedule-step-asset">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <MaterialSymbol name="directions_car" size={15} className="text-primary" />
              Vehicles
            </p>
            {onAddAsset && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddAsset}
                className="h-8 text-xs text-primary hover:text-primary hover:bg-blue-50 gap-1 px-2 cursor-pointer"
                data-testid="schedule-add-another-vehicle"
              >
                <MaterialSymbol name="add" size={14} />
                Add New Car
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
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
                    "w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-3 shadow-xs cursor-pointer",
                    isSelected
                      ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm"
                      : "border-slate-200/90 bg-white hover:border-primary/40 hover:shadow-sm",
                  )}
                  data-testid={`schedule-asset-vehicle-${v.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary text-white" : "bg-blue-50 text-primary",
                      )}
                    >
                      <MaterialSymbol name="directions_car" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{asset.name}</p>
                      {asset.subtitle && (
                        <p className="text-xs font-mono font-medium text-slate-600 truncate mt-0.5">
                          {asset.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && <MaterialSymbol name="check_circle" size={18} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Fallback: Generic mode (no specific target specified)
  if (vehicles.length === 0 && solarSites.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3 bg-white"
        data-testid="schedule-error-no-asset"
      >
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
          <MaterialSymbol name="directions_car" size={24} />
        </div>
        <p className="font-display font-bold text-base text-foreground">No vehicles or solar sites yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          Add an asset so CWP knows what to service.
        </p>
        {onAddAsset ? (
          <Button type="button" onClick={onAddAsset} className="mt-2 rounded-xl cursor-pointer gap-1.5">
            <MaterialSymbol name="add" size={16} />
            Add Vehicle or Solar Site
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="schedule-step-asset">
      {vehicles.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MaterialSymbol name="directions_car" size={15} className="text-primary" />
            Vehicles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {vehicles.map((v) => {
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
                    "w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-3 shadow-xs cursor-pointer",
                    isSelected
                      ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm"
                      : "border-slate-200/90 bg-white hover:border-primary/40 hover:shadow-sm",
                  )}
                  data-testid={`schedule-asset-vehicle-${v.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isSelected ? "bg-primary text-white" : "bg-blue-50 text-primary",
                      )}
                    >
                      <MaterialSymbol name="directions_car" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{asset.name}</p>
                      {asset.subtitle && (
                        <p className="text-xs font-mono font-medium text-slate-600 truncate mt-0.5">
                          {asset.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {isSelected && <MaterialSymbol name="check_circle" size={18} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {solarSites.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <MaterialSymbol name="wb_sunny" size={15} className="text-amber-600" />
            Solar Sites
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {solarSites.map((s) => {
              const asset: ScheduleAsset = {
                kind: "solar",
                id: s.id,
                name: "Rooftop Solar Site",
                subtitle: s.panelCount ? `${s.panelCount} panels · ${s.address ?? ""}` : s.address ?? "",
                location: null,
              };
              const isSelected = selected?.kind === "solar" && selected.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelect(asset)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition-all flex items-center justify-between gap-3 shadow-xs cursor-pointer",
                    isSelected
                      ? "border-primary bg-blue-50/70 ring-2 ring-primary/20 shadow-sm"
                      : "border-slate-200/90 bg-white hover:border-primary/40 hover:shadow-sm",
                  )}
                  data-testid={`schedule-asset-solar-${s.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                        isSelected ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-600",
                      )}
                    >
                      <MaterialSymbol name="wb_sunny" size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{asset.subtitle}</p>
                    </div>
                  </div>
                  {isSelected && <MaterialSymbol name="check_circle" size={18} className="text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ScheduleAssetStep;
