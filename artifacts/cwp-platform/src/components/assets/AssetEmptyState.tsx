import { Car, Sun, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetEmptyStateProps {
  tab?: "vehicle" | "solar" | "all";
  onAddVehicle: () => void;
  onAddSolar: () => void;
}

export function AssetEmptyState({ tab = "all", onAddVehicle, onAddSolar }: AssetEmptyStateProps) {
  if (tab === "vehicle") {
    return (
      <div
        className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-9 text-center space-y-4 shadow-[0_2px_8px_rgba(11,29,54,0.04)]"
        data-testid="assets-empty-state-vehicle"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center">
          <Car size={26} aria-hidden />
        </div>

        <div className="max-w-sm mx-auto">
          <h2 className="font-display font-bold text-lg text-foreground">No Vehicles Added Yet</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Add your car with registration number, brand, and parking address to schedule daily cleaning, wash, and detailing visits.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Button
            className="gap-2 h-11 px-5 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs cursor-pointer"
            onClick={onAddVehicle}
            data-testid="empty-add-vehicle"
          >
            <Plus size={16} aria-hidden />
            Add Vehicle (Car)
          </Button>
        </div>
      </div>
    );
  }

  if (tab === "solar") {
    return (
      <div
        className="rounded-2xl border border-slate-200/90 bg-white p-7 sm:p-9 text-center space-y-4 shadow-[0_2px_8px_rgba(11,29,54,0.04)]"
        data-testid="assets-empty-state-solar"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
          <Sun size={26} aria-hidden />
        </div>

        <div className="max-w-sm mx-auto">
          <h2 className="font-display font-bold text-lg text-foreground">No Solar Sites Added Yet</h2>
          <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
            Add your rooftop solar plant to schedule regular panel de-dusting, maintain generation efficiency, and track cleaning history.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Button
            className="gap-2 h-11 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer"
            onClick={onAddSolar}
            data-testid="empty-add-solar"
          >
            <Plus size={16} aria-hidden />
            Add Solar Rooftop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 text-center space-y-4 shadow-[0_2px_8px_rgba(11,29,54,0.04)]"
      data-testid="assets-empty-state"
    >
      <div className="mx-auto flex items-center justify-center gap-2">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-primary border border-blue-100 flex items-center justify-center">
          <Car size={22} aria-hidden />
        </div>
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
          <Sun size={22} aria-hidden />
        </div>
      </div>

      <div className="max-w-sm mx-auto">
        <h2 className="font-display font-bold text-lg text-foreground">No Assets Registered</h2>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Manage your cars and rooftop solar installations in separate sections with doorstep service tracking.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2.5 justify-center max-w-xs mx-auto pt-2">
        <Button
          className="gap-1.5 h-11 min-h-11 rounded-xl bg-primary hover:bg-[#1264db] text-white font-semibold text-xs shadow-xs cursor-pointer"
          onClick={onAddVehicle}
          data-testid="empty-add-vehicle"
        >
          <Plus size={16} aria-hidden />
          Add Vehicle
        </Button>
        <Button
          variant="outline"
          className="gap-1.5 h-11 min-h-11 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-xs text-foreground cursor-pointer"
          onClick={onAddSolar}
          data-testid="empty-add-solar"
        >
          <Sun size={16} className="text-amber-600" aria-hidden />
          Add Solar Site
        </Button>
      </div>
    </div>
  );
}

export default AssetEmptyState;
