import { useEffect, useState } from "react";
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
import type { CustomerServiceLocationRow } from "@/features/service-locations/api";
import { categorySlugToVehicleType } from "@/lib/vehicleMaster";
import { getApiErrorMessage } from "@/lib/apiError";

export type ServiceLocationOption = {
  id: number;
  label: string;
  address?: string | null;
  city?: string | null;
};

type Props = {
  customerId: number;
  /** All customer addresses — used in the picker. */
  serviceLocations: ServiceLocationOption[];
  /** Pre-selected address id (optional). */
  serviceLocationId?: number | null;
  /** Prefer vehicle or solar when opening the create form. */
  defaultTab?: "vehicle" | "solar_site";
  onCreated: (asset: AssetListRow) => void;
  onCancel?: () => void;
  /** Open “add address” flow in parent. */
  onAddAddress?: () => void;
};

function locationLabel(loc: ServiceLocationOption) {
  const name = loc.label?.trim() || "Untitled";
  const line = [loc.address, loc.city].filter(Boolean).join(", ");
  return line ? `${name} — ${line}` : name;
}

export function InlineVehicleSolarForm({
  customerId,
  serviceLocations,
  serviceLocationId: initialLocationId = null,
  defaultTab = "vehicle",
  onCreated,
  onCancel,
  onAddAddress,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"vehicle" | "solar_site">(defaultTab);
  const [selectedLocationId, setSelectedLocationId] = useState<string>(
    initialLocationId != null ? String(initialLocationId) : "",
  );

  const [vehicleForm, setVehicleForm] = useState({
    ...EMPTY_VEHICLE_ASSET_FORM,
    customerId: String(customerId),
    serviceLocationId: initialLocationId != null ? String(initialLocationId) : "",
  });
  const [solarForm, setSolarForm] = useState({
    ...EMPTY_SOLAR_ASSET_FORM,
    customerId: String(customerId),
    serviceLocationId: initialLocationId != null ? String(initialLocationId) : "",
  });
  const [selectedModel, setSelectedModel] = useState<VehicleModel | null>(null);
  const [saving, setSaving] = useState(false);

  // Keep forms in sync when parent passes a newly created address
  useEffect(() => {
    if (initialLocationId == null) return;
    const id = String(initialLocationId);
    setSelectedLocationId(id);
    setVehicleForm(prev => ({ ...prev, serviceLocationId: id }));
    setSolarForm(prev => ({ ...prev, serviceLocationId: id }));
  }, [initialLocationId]);

  const locationOptions = serviceLocations.map(l => ({
    id: l.id,
    label: locationLabel(l),
    address: l.address,
    city: l.city,
  }));

  const selectLocation = (id: string) => {
    setSelectedLocationId(id);
    setVehicleForm(prev => ({ ...prev, serviceLocationId: id }));
    setSolarForm(prev => ({ ...prev, serviceLocationId: id }));
  };

  const handleModelSelect = (model: VehicleModel | null) => {
    setSelectedModel(model);
    if (model) {
      setVehicleForm(prev => ({
        ...prev,
        vehicleType: categorySlugToVehicleType(model.categorySlug),
        seatCategoryId: model.seatCategoryId != null ? String(model.seatCategoryId) : prev.seatCategoryId,
      }));
    }
  };

  const resolveLocationId = (): number | null => {
    const fromForm = tab === "solar_site" ? solarForm.serviceLocationId : vehicleForm.serviceLocationId;
    const raw = fromForm || selectedLocationId;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const handleSave = async () => {
    const locationId = resolveLocationId();
    if (!locationId) {
      toast({
        title: "Choose a service address",
        description: serviceLocations.length
          ? "Select an address from the list, or add a new one."
          : "Add a named service address first.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (tab === "vehicle") {
        if (!selectedModel) {
          toast({
            title: "Select make & model",
            description: "Search and pick a vehicle from master data (e.g. Hyundai Creta).",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        if (!vehicleForm.registrationNumber.trim()) {
          toast({ title: "Vehicle number is required", variant: "destructive" });
          setSaving(false);
          return;
        }
        if (!vehicleForm.seatCategoryId) {
          toast({
            title: "Seater is required",
            description: "Same model can be 5 or 7 seater — pick the actual seating for wash rates.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        const result = await createAsset({
          assetType: "vehicle",
          customerId,
          serviceLocationId: locationId,
          registrationNumber: vehicleForm.registrationNumber.trim(),
          vehicleModelId: selectedModel.id,
          seatCategoryId: parseInt(vehicleForm.seatCategoryId, 10),
          year: vehicleForm.year ? parseInt(vehicleForm.year, 10) : undefined,
          color: vehicleForm.color || undefined,
          notes: vehicleForm.notes || undefined,
        });
        await qc.invalidateQueries({ queryKey: ["book-services", "assets", customerId] });
        onCreated(result.asset);
        toast({ title: "Vehicle added" });
      } else {
        const panels = parseInt(solarForm.panelCount, 10);
        if (!solarForm.siteName.trim()) {
          toast({ title: "Site name is required", variant: "destructive" });
          setSaving(false);
          return;
        }
        if (!Number.isFinite(panels) || panels < 1) {
          toast({
            title: "Panel count is required",
            description: "Enter how many panels — this drives the rate-card quote.",
            variant: "destructive",
          });
          setSaving(false);
          return;
        }
        const result = await createAsset({
          assetType: "solar_site",
          customerId,
          serviceLocationId: locationId,
          siteName: solarForm.siteName.trim(),
          panelCapacityKw: solarForm.panelCapacityKw.trim() || undefined,
          panelCount: panels,
          notes: solarForm.notes || undefined,
        });
        await qc.invalidateQueries({ queryKey: ["book-services", "assets", customerId] });
        onCreated(result.asset);
        toast({ title: "Solar site added", description: `${panels} panels — pricing uses the solar rate card.` });
      }
    } catch (e) {
      toast({
        title: "Could not register item",
        description: getApiErrorMessage(e, "Something went wrong. Please try again."),
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
            onChange={next => {
              setVehicleForm(next);
              if (next.serviceLocationId) setSelectedLocationId(next.serviceLocationId);
            }}
            selectedModel={selectedModel}
            onModelSelect={handleModelSelect}
            serviceLocations={locationOptions}
            showCustomerSelect={false}
            lockServiceLocation={false}
            onAddServiceLocation={onAddAddress}
          />
        </TabsContent>
        <TabsContent value="solar_site" className="mt-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            Panel count sets the cleaning quote from the rate card. Capacity (kW) is optional and does not affect price.
          </p>
          <SolarSiteForm
            values={solarForm}
            onChange={next => {
              setSolarForm(next);
              if (next.serviceLocationId) selectLocation(next.serviceLocationId);
            }}
            serviceLocations={locationOptions}
            onAddAddress={onAddAddress}
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

/** Helper for parents building options from API rows. */
export function toLocationOptions(rows: CustomerServiceLocationRow[]): ServiceLocationOption[] {
  return rows.map(l => ({
    id: l.id,
    label: l.label,
    address: l.address,
    city: l.city,
  }));
}
