import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleModelSelect } from "@/components/shared/VehicleModelSelect";
import type { VehicleModel } from "@/features/master-data/api";

const VEHICLE_TYPES = ["sedan", "suv", "hatchback", "luxury", "van", "truck"] as const;

export type VehicleAssetFormValues = {
  customerId: string;
  serviceLocationId: string;
  registrationNumber: string;
  vehicleType: string;
  year: string;
  color: string;
  notes: string;
};

export const EMPTY_VEHICLE_ASSET_FORM: VehicleAssetFormValues = {
  customerId: "",
  serviceLocationId: "",
  registrationNumber: "",
  vehicleType: "sedan",
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
};

export function VehicleForm({
  values,
  onChange,
  selectedModel,
  onModelSelect,
  serviceLocations,
  customers,
  showCustomerSelect = true,
}: VehicleFormProps) {
  const set = (patch: Partial<VehicleAssetFormValues>) => onChange({ ...values, ...patch });

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
      <div>
        <Label>Service location *</Label>
        <Select value={values.serviceLocationId || "none"} onValueChange={v => set({ serviceLocationId: v === "none" ? "" : v })}>
          <SelectTrigger className="mt-1" data-testid="vehicle-service-location"><SelectValue placeholder="Select location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Select location</SelectItem>
            {serviceLocations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <VehicleModelSelect modelId={selectedModel?.id} onSelect={onModelSelect} />
      <div>
        <Label>Vehicle number *</Label>
        <Input
          className="mt-1"
          value={values.registrationNumber}
          onChange={e => set({ registrationNumber: e.target.value.toUpperCase() })}
          data-testid="vehicle-registration"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Vehicle type</Label>
          <Select value={values.vehicleType} onValueChange={v => set({ vehicleType: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
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
  panelCount: "1",
  notes: "",
};

type SolarFormProps = {
  values: SolarAssetFormValues;
  onChange: (v: SolarAssetFormValues) => void;
  serviceLocations: Array<{ id: number; label: string }>;
};

export function SolarSiteForm({ values, onChange, serviceLocations }: SolarFormProps) {
  const set = (patch: Partial<SolarAssetFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <Label>Service location *</Label>
        <Select value={values.serviceLocationId || "none"} onValueChange={v => set({ serviceLocationId: v === "none" ? "" : v })}>
          <SelectTrigger className="mt-1" data-testid="solar-service-location"><SelectValue placeholder="Select location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none" disabled>Select location</SelectItem>
            {serviceLocations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Site name *</Label>
        <Input className="mt-1" value={values.siteName} onChange={e => set({ siteName: e.target.value })} data-testid="solar-site-name" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Capacity (kW) *</Label>
          <Input className="mt-1" value={values.panelCapacityKw} onChange={e => set({ panelCapacityKw: e.target.value })} data-testid="solar-capacity" />
        </div>
        <div>
          <Label>Panel count</Label>
          <Input type="number" min={1} className="mt-1" value={values.panelCount} onChange={e => set({ panelCount: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Input className="mt-1" value={values.notes} onChange={e => set({ notes: e.target.value })} />
      </div>
    </div>
  );
}
