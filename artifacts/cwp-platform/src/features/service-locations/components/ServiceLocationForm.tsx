import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleMapPicker } from "@/components/shared/GoogleMapPicker";
import { isGoogleMapsConfigured } from "@/lib/maps";
import type { LocationValue } from "@/features/master-data/api";
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
  placeId: string;
};

export const EMPTY_SERVICE_LOCATION_FORM: ServiceLocationFormValues = {
  label: "",
  address: "",
  city: "",
  locationType: "other",
  status: "active",
  latitude: "",
  longitude: "",
  placeId: "",
};

type ServiceLocationFormProps = {
  values: ServiceLocationFormValues;
  onChange: (values: ServiceLocationFormValues) => void;
  idPrefix?: string;
};

function guessCityFromAddress(address: string): string | undefined {
  // "…, Varanasi, Uttar Pradesh 221001, India" → Varanasi
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return undefined;
  // Prefer a part that looks like a city (not a PIN, not India/state-only)
  for (let i = parts.length - 2; i >= 0; i--) {
    const p = parts[i]!;
    if (/^\d{5,6}/.test(p)) continue;
    if (/india/i.test(p)) continue;
    if (/pradesh|bengal|nadu|rashtra|gujarat|rajasthan|karnataka|kerala|bihar|odisha|punjab|haryana|delhi/i.test(p) && parts.length > 3) {
      continue;
    }
    return p;
  }
  return parts[parts.length - 3] ?? parts[0];
}

export function ServiceLocationForm({
  values,
  onChange,
  idPrefix = "service-location",
}: ServiceLocationFormProps) {
  const set = (patch: Partial<ServiceLocationFormValues>) => onChange({ ...values, ...patch });
  const mapsEnabled = isGoogleMapsConfigured();

  const mapValue: LocationValue | null =
    values.latitude && values.longitude && !Number.isNaN(parseFloat(values.latitude)) && !Number.isNaN(parseFloat(values.longitude))
      ? {
          address: values.address || `${values.latitude}, ${values.longitude}`,
          latitude: parseFloat(values.latitude),
          longitude: parseFloat(values.longitude),
          placeId: values.placeId || undefined,
        }
      : null;

  const handleMapChange = (loc: LocationValue) => {
    const guessedCity = guessCityFromAddress(loc.address);
    set({
      address: loc.address,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      placeId: loc.placeId ?? "",
      city: values.city.trim() || guessedCity || "",
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor={`${idPrefix}-label`}>Site label *</Label>
        <Input
          id={`${idPrefix}-label`}
          data-testid={`${idPrefix}-label`}
          value={values.label}
          onChange={e => set({ label: e.target.value })}
          className="mt-1"
          placeholder="e.g. Home, Office, Factory"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Site type</Label>
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

      <div className="space-y-2">
        <Label>Location on map *</Label>
        {mapsEnabled ? (
          <>
            <GoogleMapPicker
              value={mapValue}
              onChange={handleMapChange}
              mapHeightClass="h-48"
            />
            {values.address && (
              <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`${idPrefix}-resolved-address`}>
                {values.address}
              </p>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2.5 space-y-2">
            <p className="text-xs text-amber-800">
              Google Maps is not configured (`VITE_GOOGLE_MAPS_API_KEY`). Add the key to enable search and pin drop.
            </p>
            <div>
              <Label htmlFor={`${idPrefix}-address`}>Address *</Label>
              <Input
                id={`${idPrefix}-address`}
                data-testid={`${idPrefix}-address`}
                value={values.address}
                onChange={e => set({ address: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor={`${idPrefix}-city`}>City</Label>
        <Input
          id={`${idPrefix}-city`}
          data-testid={`${idPrefix}-city`}
          value={values.city}
          onChange={e => set({ city: e.target.value })}
          className="mt-1"
          placeholder="Filled from map when possible"
        />
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
    placeId: values.placeId.trim() || undefined,
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
  placeId?: string | null;
}): ServiceLocationFormValues {
  return {
    label: row.label,
    address: row.address ?? "",
    city: row.city ?? "",
    locationType: row.locationType,
    status: row.status,
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
    placeId: row.placeId ?? "",
  };
}
