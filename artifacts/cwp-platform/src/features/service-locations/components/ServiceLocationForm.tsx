import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SERVICE_LOCATION_TYPE_LABELS,
  type ServiceLocationStatus,
  type ServiceLocationType,
} from "../api";

export type ServiceLocationFormValues = {
  label: string;
  address: string;
  city: string;
  locationType: ServiceLocationType;
  status: ServiceLocationStatus;
  latitude: string;
  longitude: string;
};

export const EMPTY_SERVICE_LOCATION_FORM: ServiceLocationFormValues = {
  label: "",
  address: "",
  city: "",
  locationType: "other",
  status: "active",
  latitude: "",
  longitude: "",
};

type ServiceLocationFormProps = {
  values: ServiceLocationFormValues;
  onChange: (values: ServiceLocationFormValues) => void;
  idPrefix?: string;
};

export function ServiceLocationForm({
  values,
  onChange,
  idPrefix = "service-location",
}: ServiceLocationFormProps) {
  const set = (patch: Partial<ServiceLocationFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-label`}>Site label</Label>
        <Input
          id={`${idPrefix}-label`}
          data-testid={`${idPrefix}-label`}
          value={values.label}
          onChange={e => set({ label: e.target.value })}
          className="mt-1"
          placeholder="e.g. Head Office, Factory, Primary"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-address`}>Address</Label>
        <Input
          id={`${idPrefix}-address`}
          data-testid={`${idPrefix}-address`}
          value={values.address}
          onChange={e => set({ address: e.target.value })}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <Input
          id={`${idPrefix}-city`}
          data-testid={`${idPrefix}-city`}
          value={values.city}
          onChange={e => set({ city: e.target.value })}
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Location type</Label>
          <Select value={values.locationType} onValueChange={v => set({ locationType: v as ServiceLocationType })}>
            <SelectTrigger className="mt-1" data-testid={`${idPrefix}-type`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SERVICE_LOCATION_TYPE_LABELS) as ServiceLocationType[]).map(t => (
                <SelectItem key={t} value={t}>{SERVICE_LOCATION_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={values.status} onValueChange={v => set({ status: v as ServiceLocationStatus })}>
            <SelectTrigger className="mt-1" data-testid={`${idPrefix}-status`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`${idPrefix}-lat`}>Latitude (optional)</Label>
          <Input
            id={`${idPrefix}-lat`}
            value={values.latitude}
            onChange={e => set({ latitude: e.target.value })}
            className="mt-1"
            placeholder="25.3176"
          />
        </div>
        <div>
          <Label htmlFor={`${idPrefix}-lng`}>Longitude (optional)</Label>
          <Input
            id={`${idPrefix}-lng`}
            value={values.longitude}
            onChange={e => set({ longitude: e.target.value })}
            className="mt-1"
            placeholder="82.9739"
          />
        </div>
      </div>
    </div>
  );
}

export function serviceLocationFormToPayload(values: ServiceLocationFormValues) {
  const lat = values.latitude.trim() ? parseFloat(values.latitude) : undefined;
  const lng = values.longitude.trim() ? parseFloat(values.longitude) : undefined;
  return {
    label: values.label.trim(),
    address: values.address.trim() || undefined,
    city: values.city.trim() || undefined,
    locationType: values.locationType,
    status: values.status,
    latitude: Number.isFinite(lat) ? lat : undefined,
    longitude: Number.isFinite(lng) ? lng : undefined,
  };
}

export function serviceLocationToFormValues(row: {
  label: string;
  address?: string | null;
  city?: string | null;
  locationType: ServiceLocationType;
  status: ServiceLocationStatus;
  latitude?: number | null;
  longitude?: number | null;
}): ServiceLocationFormValues {
  return {
    label: row.label,
    address: row.address ?? "",
    city: row.city ?? "",
    locationType: row.locationType,
    status: row.status,
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
  };
}
