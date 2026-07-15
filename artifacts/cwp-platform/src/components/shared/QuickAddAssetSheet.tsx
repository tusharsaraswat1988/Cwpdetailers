import { useState } from "react";
import {
  useCreateVehicle, getListVehiclesQueryKey,
  useCreateSolarSite, getListSolarSitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { LocationPicker } from "@/components/shared/LocationPicker";
import type { LocationValue, VehicleModel } from "@/features/master-data/api";
import { useToast } from "@/hooks/use-toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  kind: "vehicle" | "solar";
  onCreated: (id: number) => void;
};

/**
 * Lets a customer register a vehicle/solar site without leaving the booking
 * wizard (Hick's law / minimize interruptions — the old flow bounced them to
 * a separate "My Assets" page and lost their in-progress booking context).
 */
export function QuickAddAssetSheet({ open, onOpenChange, customerId, kind, onCreated }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [carForm, setCarForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [panelCount, setPanelCount] = useState("");

  const reset = () => {
    setSelectedModel(null);
    setCarForm({ year: "", color: "", registrationNumber: "" });
    setLocation(null);
    setPanelCount("");
  };

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: (created: { id: number }) => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        toast({ title: "Vehicle added" });
        reset();
        onOpenChange(false);
        onCreated(created.id);
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const createSolar = useCreateSolarSite({
    mutation: {
      onSuccess: (created: { id: number }) => {
        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });
        toast({ title: "Solar site added" });
        reset();
        onOpenChange(false);
        onCreated(created.id);
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add solar site", variant: "destructive" }),
    },
  });

  const canSaveVehicle = Boolean(selectedModel && carForm.registrationNumber && location);
  const canSaveSolar = Boolean(location && panelCount);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{kind === "vehicle" ? "Add a vehicle" : "Add a solar site"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-4">
          {kind === "vehicle" ? (
            <>
              <VehicleModelSelect selected={selectedModel} modelId={selectedModel?.id} onSelect={setSelectedModel} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Year</Label>
                  <Input type="number" className="mt-1" value={carForm.year} onChange={e => setCarForm(f => ({ ...f, year: e.target.value }))} />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input className="mt-1" value={carForm.color} onChange={e => setCarForm(f => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <div>
                <Label>Registration number</Label>
                <Input
                  className="mt-1"
                  value={carForm.registrationNumber}
                  onChange={e => setCarForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))}
                  data-testid="input-quickadd-vehicle-reg"
                />
              </div>
              <LocationPicker value={location} onChange={setLocation} required />
              <Button
                className="w-full h-11 bg-primary text-secondary hover:bg-primary/90"
                disabled={!canSaveVehicle || createVehicle.isPending}
                data-testid="btn-quickadd-save-vehicle"
                onClick={() => {
                  if (!selectedModel || !location) return;
                  createVehicle.mutate({
                    data: {
                      customerId,
                      vehicleModelId: selectedModel.id,
                      make: selectedModel.brandName,
                      model: selectedModel.name,
                      year: carForm.year ? parseInt(carForm.year) : undefined,
                      color: carForm.color || undefined,
                      registrationNumber: carForm.registrationNumber,
                      serviceAddress: location.address,
                      serviceLat: location.latitude,
                      serviceLng: location.longitude,
                      placeId: location.placeId,
                      locationLabel: "Default Service Location",
                    } as Parameters<typeof createVehicle.mutate>[0]["data"],
                  });
                }}
              >
                {createVehicle.isPending ? "Saving…" : "Save & continue"}
              </Button>
            </>
          ) : (
            <>
              <LocationPicker value={location} onChange={setLocation} required />
              <div>
                <Label>Panel count</Label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={panelCount}
                  onChange={e => setPanelCount(e.target.value)}
                  data-testid="input-quickadd-solar-panels"
                />
              </div>
              <Button
                className="w-full h-11 bg-primary text-secondary hover:bg-primary/90"
                disabled={!canSaveSolar || createSolar.isPending}
                data-testid="btn-quickadd-save-solar"
                onClick={() => {
                  if (!location) return;
                  createSolar.mutate({
                    data: {
                      customerId,
                      address: location.address,
                      panelCount: parseInt(panelCount),
                      serviceLat: location.latitude,
                      serviceLng: location.longitude,
                      placeId: location.placeId,
                      locationLabel: "Solar Site",
                    } as Parameters<typeof createSolar.mutate>[0]["data"],
                  });
                }}
              >
                {createSolar.isPending ? "Saving…" : "Save & continue"}
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
