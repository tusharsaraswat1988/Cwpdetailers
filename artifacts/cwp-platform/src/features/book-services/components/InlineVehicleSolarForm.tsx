import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Car, Sun } from "lucide-react";
import { createAsset, type AssetListRow } from "@/features/assets/api";
import {
  EMPTY_SOLAR_ASSET_FORM,
  EMPTY_VEHICLE_ASSET_FORM,
  SolarSiteForm,
  VehicleForm,
} from "@/features/assets/components/AssetForms";
import type { VehicleModel } from "@/features/master-data/api";

type Props = {
  customerId: number;
  serviceLocationId: number;
  onCreated: (asset: AssetListRow) => void;
  onCancel?: () => void;
};

export function InlineVehicleSolarForm({ customerId, serviceLocationId, onCreated, onCancel }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"vehicle" | "solar_site">("vehicle");
  const [vehicleForm, setVehicleForm] = useState({
    ...EMPTY_VEHICLE_ASSET_FORM,
    customerId: String(customerId),
    serviceLocationId: String(serviceLocationId),
  });
  const [solarForm, setSolarForm] = useState({
    ...EMPTY_SOLAR_ASSET_FORM,
    customerId: String(customerId),
    serviceLocationId: String(serviceLocationId),
  });
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [saving, setSaving] = useState(false);

  const serviceLocations = [{ id: serviceLocationId, label: "Selected address" }];

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === "vehicle") {
        if (!vehicleForm.registrationNumber.trim() || !selectedModel) {
          toast({ title: "Vehicle model and number are required", variant: "destructive" });
          return;
        }
        const result = await createAsset({
          assetType: "vehicle",
          customerId,
          serviceLocationId,
          registrationNumber: vehicleForm.registrationNumber.trim(),
          vehicleModelId: selectedModel.id,
          vehicleType: vehicleForm.vehicleType,
          year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
          color: vehicleForm.color || undefined,
          notes: vehicleForm.notes || undefined,
        });
        await qc.invalidateQueries({ queryKey: ["book-services", "assets", customerId, serviceLocationId] });
        onCreated(result.asset);
        toast({ title: "Vehicle added" });
      } else {
        if (!solarForm.siteName.trim() || !solarForm.panelCapacityKw.trim()) {
          toast({ title: "Site name and capacity are required", variant: "destructive" });
          return;
        }
        const result = await createAsset({
          assetType: "solar_site",
          customerId,
          serviceLocationId,
          siteName: solarForm.siteName.trim(),
          panelCapacityKw: solarForm.panelCapacityKw.trim(),
          panelCount: solarForm.panelCount ? parseInt(solarForm.panelCount, 10) : 1,
          notes: solarForm.notes || undefined,
        });
        await qc.invalidateQueries({ queryKey: ["book-services", "assets", customerId, serviceLocationId] });
        onCreated(result.asset);
        toast({ title: "Solar site added" });
      }
    } catch (e) {
      toast({
        title: "Could not register item",
        description: e instanceof Error ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="inline-add-vehicle-solar">
      <p className="text-sm font-medium text-foreground">Register vehicle or solar site</p>
      <Tabs value={tab} onValueChange={v => setTab(v as "vehicle" | "solar_site")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vehicle" className="text-xs">
            <Car size={14} className="mr-1" /> Vehicle
          </TabsTrigger>
          <TabsTrigger value="solar_site" className="text-xs">
            <Sun size={14} className="mr-1" /> Solar site
          </TabsTrigger>
        </TabsList>
        <TabsContent value="vehicle" className="mt-3">
          <VehicleForm
            values={vehicleForm}
            onChange={setVehicleForm}
            selectedModel={selectedModel}
            onModelSelect={setSelectedModel}
            serviceLocations={serviceLocations}
            showCustomerSelect={false}
          />
        </TabsContent>
        <TabsContent value="solar_site" className="mt-3">
          <SolarSiteForm
            values={solarForm}
            onChange={setSolarForm}
            serviceLocations={serviceLocations}
          />
        </TabsContent>
      </Tabs>
      <div className="flex gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving} data-testid="btn-save-inline-vehicle">
          {saving ? "Saving…" : "Save & continue"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
