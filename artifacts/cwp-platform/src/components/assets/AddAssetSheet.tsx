import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "@/components/shared/LocationPicker";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { SeatCategorySelect } from "@/components/shared/SeatCategorySelect";
import type { LocationValue, VehicleModel } from "@/features/master-data/api";
import { Loader2 } from "lucide-react";

type AddKind = "vehicle" | "solar";

interface AddAssetSheetProps {
  kind: AddKind | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveVehicle: (data: {
    model: VehicleModel;
    seatCategoryId: number;
    year: string;
    color: string;
    registrationNumber: string;
    location: LocationValue;
  }) => void;
  onSaveSolar: (data: { panelCount: string; location: LocationValue }) => void;
  saving?: boolean;
}

export function AddAssetSheet({
  kind,
  open,
  onOpenChange,
  onSaveVehicle,
  onSaveSolar,
  saving,
}: AddAssetSheetProps) {
  const isMobile = useIsMobile();
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [seatCategoryId, setSeatCategoryId] = useState<number | null>(null);
  const [carForm, setCarForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [panelCount, setPanelCount] = useState("");
  const [location, setLocation] = useState<LocationValue | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedModel(null);
      setSeatCategoryId(null);
      setCarForm({ year: "", color: "", registrationNumber: "" });
      setPanelCount("");
      setLocation(null);
    }
  }, [open]);

  const title = kind === "vehicle" ? "Add vehicle" : "Add solar site";

  const canSaveVehicle = selectedModel && carForm.registrationNumber && location && seatCategoryId != null;
  const canSaveSolar = location && panelCount;

  const body = kind === "vehicle" ? (
    <div className="space-y-4 pb-2">
      <VehicleModelSelect
        selected={selectedModel}
        modelId={selectedModel?.id}
        onSelect={model => {
          setSelectedModel(model);
          setSeatCategoryId(model?.seatCategoryId ?? null);
        }}
      />
      <SeatCategorySelect
        value={seatCategoryId}
        onChange={setSeatCategoryId}
        model={selectedModel}
      />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Year</Label><Input type="number" className="mt-1" value={carForm.year} onChange={e => setCarForm(f => ({ ...f, year: e.target.value }))} /></div>
        <div><Label>Color</Label><Input className="mt-1" value={carForm.color} onChange={e => setCarForm(f => ({ ...f, color: e.target.value }))} /></div>
      </div>
      <div>
        <Label>Registration number</Label>
        <Input className="mt-1" value={carForm.registrationNumber} onChange={e => setCarForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))} data-testid="input-vehicle-reg" />
      </div>
      <LocationPicker value={location} onChange={setLocation} required />
      <Button
        className="w-full h-11"
        disabled={!canSaveVehicle || saving}
        onClick={() => selectedModel && location && seatCategoryId != null && onSaveVehicle({
          model: selectedModel,
          seatCategoryId,
          ...carForm,
          location,
        })}
        data-testid="btn-add-vehicle"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : "Save vehicle"}
      </Button>
    </div>
  ) : (
    <div className="space-y-4 pb-2">
      <LocationPicker value={location} onChange={setLocation} required />
      <div>
        <Label>Panel count</Label>
        <Input type="number" min={1} className="mt-1" value={panelCount} onChange={e => setPanelCount(e.target.value)} data-testid="input-solar-panels" />
      </div>
      <Button
        className="w-full h-11"
        disabled={!canSaveSolar || saving}
        onClick={() => location && onSaveSolar({ panelCount, location })}
        data-testid="btn-add-solar"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : "Save solar site"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-6 pt-4 max-h-[92dvh] overflow-y-auto" data-testid="add-asset-sheet">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="font-display">{title}</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default AddAssetSheet;
