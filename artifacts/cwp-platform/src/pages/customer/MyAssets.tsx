import { useState } from "react";
import {
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
  useCreateVehicle, useCreateSolarSite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { LocationPicker } from "@/components/shared/LocationPicker";
import type { LocationValue, VehicleModel } from "@/features/master-data/api";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Car, Sun, Loader2, Plus, MapPin, CheckCircle2 } from "lucide-react";

export default function MyAssets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: vehicles, isLoading: loadingVehicles } = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );
  const { data: solarSites, isLoading: loadingSolar } = useListSolarSites(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );

  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [carForm, setCarForm] = useState({ year: "", color: "", registrationNumber: "" });
  const [vehicleLocation, setVehicleLocation] = useState<LocationValue | null>(null);
  const [solarForm, setSolarForm] = useState({ panelCount: "" });
  const [solarLocation, setSolarLocation] = useState<LocationValue | null>(null);

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        setSelectedModel(null);
        setCarForm({ year: "", color: "", registrationNumber: "" });
        setVehicleLocation(null);
        toast({ title: "Vehicle added" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const createSolar = useCreateSolarSite({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });
        setSolarForm({ panelCount: "" });
        setSolarLocation(null);
        toast({ title: "Solar site added" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add solar site", variant: "destructive" }),
    },
  });

  if (scopeLoading) {
    return <CustomerLayout><div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div></CustomerLayout>;
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="p-6 max-w-md mx-auto text-center space-y-2">
          <p className="font-semibold">Account not linked</p>
          <p className="text-sm text-muted-foreground">Your login is not linked to a customer profile.</p>
        </div>
      </CustomerLayout>
    );
  }

  const canSaveVehicle = selectedModel && carForm.registrationNumber && vehicleLocation;
  const canSaveSolar = solarLocation && solarForm.panelCount;

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">My Assets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Register vehicles and solar sites with service locations for booking.</p>
        </div>

        <Tabs defaultValue="vehicles">
          <TabsList className="w-full">
            <TabsTrigger value="vehicles" className="flex-1 gap-1"><Car size={14} /> Vehicles</TabsTrigger>
            <TabsTrigger value="solar" className="flex-1 gap-1"><Sun size={14} /> Solar</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <div className="space-y-2">
              {loadingVehicles ? <Loader2 className="animate-spin mx-auto" /> :
                (vehicles ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No vehicles yet. Add your first car below.</p>
                ) : (
                  (vehicles ?? []).map(v => (
                    <div key={v.id} className="bg-card border border-border rounded-xl p-4" data-testid={`asset-vehicle-${v.id}`}>
                      <p className="font-medium text-sm">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</p>
                      <p className="text-xs text-muted-foreground">{v.registrationNumber} · {v.color}</p>
                      {(v as { serviceAddress?: string; locationComplete?: boolean }).locationComplete ? (
                        <p className="text-xs text-green-600 flex items-center gap-1 mt-1"><CheckCircle2 size={10} /> Location set</p>
                      ) : (
                        <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><MapPin size={10} /> Location required before booking</p>
                      )}
                    </div>
                  ))
                )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <p className="font-semibold text-sm flex items-center gap-1"><Plus size={14} /> Add vehicle</p>

              <VehicleModelSelect
                modelId={selectedModel?.id}
                onSelect={setSelectedModel}
              />

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Year</Label><Input type="number" className="mt-1" value={carForm.year} onChange={e => setCarForm(f => ({ ...f, year: e.target.value }))} /></div>
                <div><Label>Color</Label><Input className="mt-1" value={carForm.color} onChange={e => setCarForm(f => ({ ...f, color: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Registration number</Label>
                <Input className="mt-1" value={carForm.registrationNumber} onChange={e => setCarForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))} data-testid="input-vehicle-reg" />
              </div>

              <LocationPicker
                value={vehicleLocation}
                onChange={setVehicleLocation}
                required
              />

              <Button
                className="w-full bg-primary text-secondary hover:bg-primary/90"
                disabled={!canSaveVehicle || createVehicle.isPending}
                data-testid="btn-add-vehicle"
                onClick={() => {
                  if (!selectedModel || !vehicleLocation) return;
                  createVehicle.mutate({
                    data: {
                      customerId,
                      vehicleModelId: selectedModel.id,
                      make: selectedModel.brandName,
                      model: selectedModel.name,
                      year: carForm.year ? parseInt(carForm.year) : undefined,
                      color: carForm.color || undefined,
                      registrationNumber: carForm.registrationNumber,
                      serviceAddress: vehicleLocation.address,
                      serviceLat: vehicleLocation.latitude,
                      serviceLng: vehicleLocation.longitude,
                      placeId: vehicleLocation.placeId,
                      locationLabel: "Default Service Location",
                    } as Parameters<typeof createVehicle.mutate>[0]["data"],
                  });
                }}
              >
                {createVehicle.isPending ? "Saving..." : "Save vehicle"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="solar" className="space-y-4 mt-4">
            <div className="space-y-2">
              {loadingSolar ? <Loader2 className="animate-spin mx-auto" /> :
                (solarSites ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No solar sites yet.</p>
                ) : (
                  (solarSites ?? []).map(s => (
                    <div key={s.id} className="bg-card border border-border rounded-xl p-4" data-testid={`asset-solar-${s.id}`}>
                      <p className="font-medium text-sm">{s.address}</p>
                      <p className="text-xs text-muted-foreground">{s.panelCount} panels</p>
                    </div>
                  ))
                )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <p className="font-semibold text-sm flex items-center gap-1"><Plus size={14} /> Add solar site</p>

              <LocationPicker
                value={solarLocation}
                onChange={setSolarLocation}
                required
              />

              <div>
                <Label>Panel count</Label>
                <Input type="number" min={1} className="mt-1" value={solarForm.panelCount} onChange={e => setSolarForm(f => ({ ...f, panelCount: e.target.value }))} data-testid="input-solar-panels" />
              </div>

              <Button
                className="w-full bg-primary text-secondary hover:bg-primary/90"
                disabled={!canSaveSolar || createSolar.isPending}
                data-testid="btn-add-solar"
                onClick={() => {
                  if (!solarLocation) return;
                  createSolar.mutate({
                    data: {
                      customerId,
                      address: solarLocation.address,
                      panelCount: parseInt(solarForm.panelCount),
                      serviceLat: solarLocation.latitude,
                      serviceLng: solarLocation.longitude,
                      placeId: solarLocation.placeId,
                      locationLabel: "Solar Site",
                    } as Parameters<typeof createSolar.mutate>[0]["data"],
                  });
                }}
              >
                {createSolar.isPending ? "Saving..." : "Save solar site"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </CustomerLayout>
  );
}
