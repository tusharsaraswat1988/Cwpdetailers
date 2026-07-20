import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import { SeatCategorySelect } from "@/components/shared/SeatCategorySelect";
import type { VehicleModel } from "@/features/master-data/api";
import { Plus } from "lucide-react";

const VEHICLE_TYPES = ["sedan", "suv", "hatchback", "luxury", "van", "truck"] as const;

export type VehicleAssetFormValues = {
  customerId: string;
  serviceLocationId: string;
  registrationNumber: string;
  vehicleType: string;
  /** Seating override for pricing (required when saving a vehicle). */
  seatCategoryId: string;
  year: string;
  color: string;
  notes: string;
};

export const EMPTY_VEHICLE_ASSET_FORM: VehicleAssetFormValues = {
  customerId: "",
  serviceLocationId: "",
  registrationNumber: "",
  vehicleType: "sedan",
  seatCategoryId: "",
  year: "",
  color: "",
  notes: "",
};

type VehicleFormProps = {
  values: VehicleAssetFormValues;
  onChange: (v: VehicleAssetFormValues) => void;
  selectedModel: VehicleModel | null;
  onModelSelect: (m: VehicleModel | null) => void;
  serviceLocations: Array<{ id: number; label: string }>;
  customers?: Array<{ id: number; name: string }>;
  showCustomerSelect?: boolean;
  hideServiceLocation?: boolean;
  lockServiceLocation?: boolean;
  onAddServiceLocation?: () => void;
};

export function VehicleForm({
  values,
  onChange,
  selectedModel,
  onModelSelect,
  serviceLocations,
  customers,
  showCustomerSelect = true,
  hideServiceLocation = false,
  lockServiceLocation = false,
  onAddServiceLocation,
}: VehicleFormProps) {
  const set = (patch: Partial<VehicleAssetFormValues>) => onChange({ ...values, ...patch });
  const lockedLocation = serviceLocations.find(l => String(l.id) === values.serviceLocationId);

  return (
    <div className="space-y-4">
      {showCustomerSelect && customers && (
        <div>
          <Label>Customer</Label>
          <Select value={values.customerId || "none"} onValueChange={v => set({ customerId: v === "none" ? "" : v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select customer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none" disabled>Select customer</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {!hideServiceLocation && (
        <div className="space-y-2">
          <Label>Service address *</Label>
          {lockServiceLocation && lockedLocation ? (
            <p className="mt-1.5 text-sm rounded-md border border-border bg-muted/30 px-3 py-2">
              {lockedLocation.label}
            </p>
          ) : serviceLocations.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-3 space-y-2">
              <p className="text-sm text-muted-foreground">No addresses on file yet.</p>
              {onAddServiceLocation && (
                <Button type="button" size="sm" variant="outline" onClick={onAddServiceLocation}>
                  <Plus size={14} className="mr-1" /> Add address with a name
                </Button>
              )}
            </div>
          ) : (
            <>
              <Select value={values.serviceLocationId || "none"} onValueChange={v => set({ serviceLocationId: v === "none" ? "" : v })}>
                <SelectTrigger className="mt-1" data-testid="vehicle-service-location"><SelectValue placeholder="Select an address" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Select an address</SelectItem>
                  {serviceLocations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {onAddServiceLocation && (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-0 text-xs" onClick={onAddServiceLocation}>
                  <Plus size={12} className="mr-1" /> Add another address
                </Button>
              )}
            </>
          )}
        </div>
      )}
      <VehicleModelSelect
        selected={selectedModel}
        modelId={selectedModel?.id}
        onSelect={model => {
          onModelSelect(model);
          // Default seater from model; advisor can still change for 5 vs 7 variants
          if (model?.seatCategoryId != null) {
            set({ seatCategoryId: String(model.seatCategoryId) });
          }
        }}
      />
      <SeatCategorySelect
        value={values.seatCategoryId ? parseInt(values.seatCategoryId, 10) : null}
        onChange={id => set({ seatCategoryId: id != null ? String(id) : "" })}
        model={selectedModel}
      />
      <div>
        <Label>Vehicle number *</Label>
        <Input
          className="mt-1"
          value={values.registrationNumber}
          onChange={e => set({ registrationNumber: e.target.value.toUpperCase() })}
          placeholder="e.g. UP65FQ0948"
          data-testid="vehicle-registration"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vehicle type</Label>
          {selectedModel ? (
            <p className="mt-1.5 text-sm capitalize rounded-md border border-border bg-muted/30 px-3 py-2">
              {values.vehicleType}
              <span className="text-xs text-muted-foreground block normal-case">From master data category</span>
            </p>
          ) : (
            <Select value={values.vehicleType} onValueChange={v => set({ vehicleType: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label>Year</Label>
          <Input type="number" className="mt-1" value={values.year} onChange={e => set({ year: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Color</Label>
        <Input className="mt-1" value={values.color} onChange={e => set({ color: e.target.value })} />
      </div>
      <div>
        <Label>Notes</Label>
        <Input className="mt-1" value={values.notes} onChange={e => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}

export type SolarAssetFormValues = {
  customerId: string;
  serviceLocationId: string;
  siteName: string;
  panelCapacityKw: string;
  panelCount: string;
  notes: string;
};

export const EMPTY_SOLAR_ASSET_FORM: SolarAssetFormValues = {
  customerId: "",
  serviceLocationId: "",
  siteName: "",
  panelCapacityKw: "",
  panelCount: "",
  notes: "",
};

export { SolarSiteForm } from "./SolarSiteForm";
