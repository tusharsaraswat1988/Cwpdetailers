import { Car, Sun, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AssetEmptyStateProps {
  onAddVehicle: () => void;
  onAddSolar: () => void;
}

export function AssetEmptyState({ onAddVehicle, onAddSolar }: AssetEmptyStateProps) {
  return (
    <div
      className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center space-y-4"
      data-testid="assets-empty-state"
    >
      <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Car size={22} className="text-muted-foreground" aria-hidden />
      </div>
      <div>
        <h2 className="font-semibold text-base">No assets yet</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
          Add your first Vehicle or Solar Site to start scheduling services.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <Button className="gap-1.5" onClick={onAddVehicle} data-testid="empty-add-vehicle">
          <Plus size={16} aria-hidden />
          Add Vehicle
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onAddSolar} data-testid="empty-add-solar">
          <Sun size={16} aria-hidden />
          Add Solar Site
        </Button>
      </div>
    </div>
  );
}

export default AssetEmptyState;
