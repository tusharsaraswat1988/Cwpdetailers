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
import { Car, Sun, Loader2, Plus, MapPin, CheckCircle2, ExternalLink } from "lucide-react";
import { VehicleReferencePhotoEditor } from "@/components/shared/VehicleReferencePhotoEditor";
import { vehiclePhotosFromRecord } from "@/components/shared/VehicleReferencePhotos";
import { mapsViewUrl } from "@/lib/maps";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";

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
    return (
      <CustomerLayout>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <div className="max-w-md mx-auto text-center space-y-2 py-12">
          <p className="font-semibold">Account not linked</p>
          <NoCustomerProfileMessage />
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
              {loadingVehicles ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full rounded-xl" />
                  <Skeleton className="h-20 w-full rounded-xl" />
                </div>
              ) :
                (vehicles ?? []).length === 0 ? (
                  <EmptyState icon={<Car size={20} />} title="No vehicles yet" description="Add your first car below to start booking" />
                ) : (
                  (vehicles ?? []).map(v => (
                    <div key={v.id} className="bg-card border border-border rounded-xl p-4 space-y-3" data-testid={`asset-vehicle-${v.id}`}>
                      <div>
                        <p className="font-medium text-sm">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</p>
                        <p className="text-xs text-muted-foreground">{v.registrationNumber} · {v.color}</p>
                        {(v as { serviceAddress?: string; locationComplete?: boolean }).locationComplete ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> Location set</p>
                            {(v as { serviceLat?: number | null; serviceLng?: number | null }).serviceLat != null &&
                              (v as { serviceLng?: number | null }).serviceLng != null && (
                              <a
                                href={mapsViewUrl(
                                  (v as { serviceLat: number }).serviceLat,
                                  (v as { serviceLng: number }).serviceLng,
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-primary inline-flex items-center gap-1 hover:underline"
                              >
                                <ExternalLink size={10} /> Map
                              </a>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1"><MapPin size={10} /> Location required before booking</p>
                        )}
                      </div>
                      <VehicleReferencePhotoEditor
                        vehicleId={v.id}
                        initialPhotos={vehiclePhotosFromRecord({
                          refPhotoFrontUrl: (v as { refPhotoFrontUrl?: string | null }).refPhotoFrontUrl,
                          refPhotoRearUrl: (v as { refPhotoRearUrl?: string | null }).refPhotoRearUrl,
                          refPhotoLeftUrl: (v as { refPhotoLeftUrl?: string | null }).refPhotoLeftUrl,
                          refPhotoRightUrl: (v as { refPhotoRightUrl?: string | null }).refPhotoRightUrl,
                        })}
                        compact
                        onUpdated={() => qc.invalidateQueries({ queryKey: getListVehiclesQueryKey({ customerId }) })}
                      />
                    </div>
                  ))
                )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <p className="font-semibold text-sm flex items-center gap-1"><Plus size={14} /> Add vehicle</p>

              <VehicleModelSelect
                selected={selectedModel}
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
              {loadingSolar ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) :
                (solarSites ?? []).length === 0 ? (
                  <EmptyState icon={<Sun size={20} />} title="No solar sites yet" description="Add your first site below to start booking" />
                ) : (
                  (solarSites ?? []).map(s => (
                    <div key={s.id} className="bg-card border border-border rounded-xl p-4" data-testid={`asset-solar-${s.id}`}>
                      <p className="font-medium text-sm">{s.address}</p>
                      <p className="text-xs text-muted-foreground">{s.panelCount} panels</p>
                      {(s as { serviceLat?: number | null; serviceLng?: number | null }).serviceLat != null &&
                        (s as { serviceLng?: number | null }).serviceLng != null && (
                        <a
                          href={mapsViewUrl(
                            (s as { serviceLat: number }).serviceLat,
                            (s as { serviceLng: number }).serviceLng,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary inline-flex items-center gap-1 mt-1 hover:underline"
                        >
                          <ExternalLink size={10} /> View on map
                        </a>
                      )}
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
