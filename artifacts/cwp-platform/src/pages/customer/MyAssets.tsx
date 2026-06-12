import { useState } from "react";
import {
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
  useCreateVehicle, useCreateSolarSite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Car, Sun, Loader2, Plus } from "lucide-react";

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

  const [carForm, setCarForm] = useState({ make: "", model: "", year: "", color: "", registrationNumber: "", vehicleType: "hatchback" });
  const [solarForm, setSolarForm] = useState({ address: "", city: "Varanasi", panelCount: "" });

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        setCarForm({ make: "", model: "", year: "", color: "", registrationNumber: "", vehicleType: "hatchback" });
        toast({ title: "Vehicle added" });
      },
      onError: () => toast({ title: "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const createSolar = useCreateSolarSite({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });
        setSolarForm({ address: "", city: "Varanasi", panelCount: "" });
        toast({ title: "Solar site added" });
      },
      onError: () => toast({ title: "Failed to add solar site", variant: "destructive" }),
    },
  });

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <div className="p-6 flex justify-center"><Loader2 className="animate-spin" /></div>
      </CustomerLayout>
    );
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

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="font-display font-bold text-2xl">My Assets</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Register vehicles and solar sites for booking services.</p>
        </div>

        <Tabs defaultValue="vehicles">
          <TabsList className="w-full">
            <TabsTrigger value="vehicles" className="flex-1 gap-1"><Car size={14} /> Vehicles</TabsTrigger>
            <TabsTrigger value="solar" className="flex-1 gap-1"><Sun size={14} /> Solar</TabsTrigger>
          </TabsList>

          <TabsContent value="vehicles" className="space-y-4 mt-4">
            <div className="space-y-2">
              {loadingVehicles ? (
                <Loader2 className="animate-spin mx-auto" />
              ) : (vehicles ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No vehicles yet. Add your first car below.</p>
              ) : (
                (vehicles ?? []).map(v => (
                  <div key={v.id} className="bg-card border border-border rounded-xl p-4" data-testid={`asset-vehicle-${v.id}`}>
                    <p className="font-medium text-sm">{v.make} {v.model} {v.year ? `(${v.year})` : ""}</p>
                    <p className="text-xs text-muted-foreground">{v.registrationNumber} · {v.color}</p>
                  </div>
                ))
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="font-semibold text-sm flex items-center gap-1"><Plus size={14} /> Add vehicle</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Make</Label><Input className="mt-1" value={carForm.make} onChange={e => setCarForm(f => ({ ...f, make: e.target.value }))} data-testid="input-vehicle-make" /></div>
                <div><Label>Model</Label><Input className="mt-1" value={carForm.model} onChange={e => setCarForm(f => ({ ...f, model: e.target.value }))} data-testid="input-vehicle-model" /></div>
                <div><Label>Year</Label><Input type="number" className="mt-1" value={carForm.year} onChange={e => setCarForm(f => ({ ...f, year: e.target.value }))} /></div>
                <div><Label>Color</Label><Input className="mt-1" value={carForm.color} onChange={e => setCarForm(f => ({ ...f, color: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Registration number</Label>
                <Input className="mt-1" value={carForm.registrationNumber} onChange={e => setCarForm(f => ({ ...f, registrationNumber: e.target.value.toUpperCase() }))} data-testid="input-vehicle-reg" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={carForm.vehicleType} onValueChange={v => setCarForm(f => ({ ...f, vehicleType: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["hatchback", "sedan", "suv", "luxury"].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-primary text-secondary hover:bg-primary/90"
                disabled={!carForm.make || !carForm.model || !carForm.registrationNumber || createVehicle.isPending}
                data-testid="btn-add-vehicle"
                onClick={() => createVehicle.mutate({
                  data: {
                    customerId,
                    make: carForm.make,
                    model: carForm.model,
                    year: carForm.year ? parseInt(carForm.year) : undefined,
                    color: carForm.color || undefined,
                    registrationNumber: carForm.registrationNumber,
                    vehicleType: carForm.vehicleType as "hatchback" | "sedan" | "suv" | "luxury",
                  },
                })}
              >
                {createVehicle.isPending ? "Saving..." : "Save vehicle"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="solar" className="space-y-4 mt-4">
            <div className="space-y-2">
              {loadingSolar ? (
                <Loader2 className="animate-spin mx-auto" />
              ) : (solarSites ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No solar sites yet.</p>
              ) : (
                (solarSites ?? []).map(s => (
                  <div key={s.id} className="bg-card border border-border rounded-xl p-4" data-testid={`asset-solar-${s.id}`}>
                    <p className="font-medium text-sm">{s.address}</p>
                    <p className="text-xs text-muted-foreground">{s.panelCount} panels · {s.city ?? "Varanasi"}</p>
                  </div>
                ))
              )}
            </div>

            <div className="bg-card border border-border rounded-xl p-5 space-y-3">
              <p className="font-semibold text-sm flex items-center gap-1"><Plus size={14} /> Add solar site</p>
              <div>
                <Label>Address</Label>
                <Input className="mt-1" value={solarForm.address} onChange={e => setSolarForm(f => ({ ...f, address: e.target.value }))} data-testid="input-solar-address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>City</Label>
                  <Input className="mt-1" value={solarForm.city} onChange={e => setSolarForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <Label>Panel count</Label>
                  <Input type="number" min={1} className="mt-1" value={solarForm.panelCount} onChange={e => setSolarForm(f => ({ ...f, panelCount: e.target.value }))} data-testid="input-solar-panels" />
                </div>
              </div>
              <Button
                className="w-full bg-primary text-secondary hover:bg-primary/90"
                disabled={!solarForm.address || !solarForm.panelCount || createSolar.isPending}
                data-testid="btn-add-solar"
                onClick={() => createSolar.mutate({
                  data: {
                    customerId,
                    address: solarForm.address,
                    city: solarForm.city || "Varanasi",
                    panelCount: parseInt(solarForm.panelCount),
                  },
                })}
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
