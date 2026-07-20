import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { AssetCardModel } from "@/lib/asset-dashboard";
import { Loader2 } from "lucide-react";

export type EditVehiclePayload = {
  model: VehicleModel;
  seatCategoryId: number;
  year: string;
  color: string;
  registrationNumber: string;
  location: LocationValue;
};

export type EditSolarPayload = {
  siteName: string;
  panelCount: string;
  panelCapacityKw: string;
  location: LocationValue;
};

export type VehicleEditSeed = {
  vehicleModelId?: number | null;
  make?: string | null;
  model?: string | null;
  seatCategoryId?: number | null;
  year?: number | null;
  color?: string | null;
  registrationNumber?: string | null;
};

export type SolarEditSeed = {
  siteName?: string | null;
  panelCount?: number | null;
  panelCapacityKw?: string | number | null;
};

type Props = {
  asset: AssetCardModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLocation: LocationValue | null;
  vehicleSeed?: VehicleEditSeed | null;
  solarSeed?: SolarEditSeed | null;
  onSaveVehicle: (data: EditVehiclePayload) => void;
  onSaveSolar: (data: EditSolarPayload) => void;
  saving?: boolean;
};

async function fetchVehicleModel(id: number): Promise<VehicleModel | null> {
  const res = await fetch(`/api/masters/vehicle-models/${id}/details`, { credentials: "include" });
  if (!res.ok) return null;
  const d = await res.json() as {
    id: number;
    name: string;
    brandName?: string;
    categoryName?: string;
    categorySlug?: string;
    seatName?: string;
    seatCount?: number;
    seatCategoryId: number;
  };
  return {
    id: d.id,
    brandId: 0,
    name: d.name,
    slug: "",
    brandName: d.brandName ?? "",
    categoryName: d.categoryName ?? "",
    categorySlug: d.categorySlug ?? "sedan",
    seatName: d.seatName ?? "",
    seatCount: d.seatCount ?? 0,
    vehicleCategoryId: 0,
    seatCategoryId: d.seatCategoryId,
  };
}

function fallbackModel(seed: VehicleEditSeed | null | undefined): VehicleModel | null {
  if (!seed?.vehicleModelId) return null;
  return {
    id: seed.vehicleModelId,
    brandId: 0,
    name: seed.model ?? "Vehicle",
    slug: "",
    brandName: seed.make ?? "",
    categoryName: "",
    categorySlug: "sedan",
    seatName: "",
    seatCount: 0,
    vehicleCategoryId: 0,
    seatCategoryId: seed.seatCategoryId ?? 0,
  };
}

export function EditAssetSheet({
  asset,
  open,
  onOpenChange,
  initialLocation,
  vehicleSeed,
  solarSeed,
  onSaveVehicle,
  onSaveSolar,
  saving,
}: Props) {
  const isMobile = useIsMobile();
  const modelId = vehicleSeed?.vehicleModelId ?? undefined;

  const { data: loadedModel } = useQuery({
    queryKey: ["vehicle-model-details", modelId],
    queryFn: () => fetchVehicleModel(modelId!),
    enabled: open && asset?.kind === "vehicle" && Boolean(modelId),
  });

  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [seatCategoryId, setSeatCategoryId] = useState<number | null>(null);
  const [carForm, setCarForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [solarForm, setSolarForm] = useState({ siteName: "", panelCount: "", panelCapacityKw: "" });
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [modelTouched, setModelTouched] = useState(false);

  useEffect(() => {
    if (!open || !asset) return;
    setLocation(initialLocation);
    setModelTouched(false);
    if (asset.kind === "vehicle") {
      setSeatCategoryId(vehicleSeed?.seatCategoryId ?? null);
      setCarForm({
        year: vehicleSeed?.year != null ? String(vehicleSeed.year) : "",
        color: vehicleSeed?.color ?? "",
        registrationNumber: vehicleSeed?.registrationNumber ?? "",
      });
    } else {
      setSolarForm({
        siteName: solarSeed?.siteName ?? asset.name ?? "",
        panelCount: solarSeed?.panelCount != null ? String(solarSeed.panelCount) : "",
        panelCapacityKw: solarSeed?.panelCapacityKw != null ? String(solarSeed.panelCapacityKw) : "",
      });
    }
  }, [open, asset, initialLocation, vehicleSeed, solarSeed]);

  useEffect(() => {
    if (!open || asset?.kind !== "vehicle" || modelTouched) return;
    setSelectedModel(loadedModel ?? fallbackModel(vehicleSeed));
    if (vehicleSeed?.seatCategoryId == null && loadedModel?.seatCategoryId != null) {
      setSeatCategoryId(loadedModel.seatCategoryId);
    }
  }, [open, asset?.kind, loadedModel, vehicleSeed, modelTouched]);

  const title = asset
    ? `Edit ${asset.kind === "vehicle" ? "vehicle" : "solar site"}`
    : "Edit";

  const canSaveVehicle = Boolean(
    selectedModel?.id && carForm.registrationNumber.trim() && location && seatCategoryId != null,
  );
  const canSaveSolar = Boolean(location && solarForm.panelCount && Number(solarForm.panelCount) >= 1);

  const body = !asset ? null : asset.kind === "vehicle" ? (
    <div className="space-y-4 pb-2">
      <VehicleModelSelect
        selected={selectedModel}
        modelId={selectedModel?.id || modelId}
        onSelect={model => {
          setModelTouched(true);
          setSelectedModel(model);
          if (model?.seatCategoryId != null) setSeatCategoryId(model.seatCategoryId);
        }}
      />
      <SeatCategorySelect
        value={seatCategoryId}
        onChange={setSeatCategoryId}
        model={selectedModel}
      />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Year</Label>
          <Input
            type="number"
            className="mt-1"
            value={carForm.year}
            onChange={e => setCarForm(f => ({ ...f, year: e.target.value }))}
          />
        </div>
        <div>
          <Label>Color</Label>
          <Input
            className="mt-1"
            value={carForm.color}
            onChange={e => setCarForm(f => ({ ...f, color: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <Label>Registration number *</Label>
        <Input
          className="mt-1"
          value={carForm.registrationNumber}
          onChange={e => setCarForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
          data-testid="input-edit-vehicle-reg"
        />
      </div>
      <LocationPicker value={location} onChange={setLocation} required />
      <Button
        className="w-full h-11"
        disabled={!canSaveVehicle || saving}
        onClick={() => {
          if (!selectedModel?.id || !location || seatCategoryId == null) return;
          onSaveVehicle({
            model: selectedModel,
            seatCategoryId,
            ...carForm,
            location,
          });
        }}
        data-testid="btn-save-edit-vehicle"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : "Save changes"}
      </Button>
    </div>
  ) : (
    <div className="space-y-4 pb-2">
      <div>
        <Label>Site name</Label>
        <Input
          className="mt-1"
          value={solarForm.siteName}
          onChange={e => setSolarForm(f => ({ ...f, siteName: e.target.value }))}
          data-testid="input-edit-solar-name"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Panel count *</Label>
          <Input
            type="number"
            min={1}
            className="mt-1"
            value={solarForm.panelCount}
            onChange={e => setSolarForm(f => ({ ...f, panelCount: e.target.value }))}
            data-testid="input-edit-solar-panels"
          />
        </div>
        <div>
          <Label>Capacity (kW)</Label>
          <Input
            className="mt-1"
            value={solarForm.panelCapacityKw}
            onChange={e => setSolarForm(f => ({ ...f, panelCapacityKw: e.target.value }))}
          />
        </div>
      </div>
      <LocationPicker value={location} onChange={setLocation} required />
      <Button
        className="w-full h-11"
        disabled={!canSaveSolar || saving}
        onClick={() => {
          if (!location) return;
          onSaveSolar({ ...solarForm, location });
        }}
        data-testid="btn-save-edit-solar"
      >
        {saving ? <Loader2 className="animate-spin" size={16} /> : "Save changes"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl px-5 pb-6 pt-4 max-h-[92dvh] overflow-y-auto" data-testid="edit-asset-sheet">
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto" data-testid="edit-asset-dialog">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

export default EditAssetSheet;
