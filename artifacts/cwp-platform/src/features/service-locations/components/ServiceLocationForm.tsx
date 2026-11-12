import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GoogleMapPicker } from "@/components/shared/GoogleMapPicker";
import { isGoogleMapsConfigured } from "@/lib/maps";
import type { LocationValue } from "@/features/master-data/api";
import { useSocieties, useSocietyTowers } from "@/features/societies/api";
import { Building2 } from "lucide-react";
import {
  SERVICE_LOCATION_TYPE_LABELS,
  type ServiceLocationStatus,
  type ServiceLocationType,
} from "../api";

export type ServiceLocationFormValues = {
  label: string;
  address: string;
  city: string;
  cityId?: number | null;
  societyId?: number | null;
  towerId?: number | null;
  flatNumber?: string;
  parkingLevel?: string;
  parkingBay?: string;
  parkingNotes?: string;
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
  cityId: null,
  societyId: null,
  towerId: null,
  flatNumber: "",
  parkingLevel: "",
  parkingBay: "",
  parkingNotes: "",
  locationType: "residence",
  status: "active",
  latitude: "",
  longitude: "",
  placeId: "",
};

import { guessCityFromAddress } from "@/features/customers/lib/serviceAddress";

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
  const mapsEnabled = isGoogleMapsConfigured();

  const societiesQuery = useSocieties({ limit: 100 });
  const towersQuery = useSocietyTowers(values.societyId);

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
          placeholder="e.g. Home, Office, Flat 1204"
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

      {/* Society and High-Rise Parking Details */}
      <div className="rounded-lg border p-3 bg-muted/20 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Building2 className="h-4 w-4 text-primary" />
          <span>Gated Society & Parking (Noida High-Rise / Apartment)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          If this location is inside an apartment complex, selecting your society and tower helps cleaners find your car slot quickly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor={`${idPrefix}-society`}>Society / Apartment</Label>
            <Select
              value={values.societyId ? String(values.societyId) : "none"}
              onValueChange={v => {
                if (v === "none") {
                  set({ societyId: null, towerId: null });
                } else {
                  const sId = parseInt(v, 10);
                  const found = societiesQuery.data?.data.find(s => s.id === sId);
                  set({
                    societyId: sId,
                    towerId: null,
                    ...(found?.address && !values.address ? { address: found.address } : {}),
                    ...(found?.cityName && !values.city ? { city: found.cityName } : {}),
                    ...(found?.cityId && !values.cityId ? { cityId: found.cityId } : {}),
                    ...(found?.latitude && !values.latitude ? { latitude: String(found.latitude) } : {}),
                    ...(found?.longitude && !values.longitude ? { longitude: String(found.longitude) } : {}),
                  });
                }
              }}
            >
              <SelectTrigger className="mt-1" id={`${idPrefix}-society`}>
                <SelectValue placeholder="Select society..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not in a listed society / Independent</SelectItem>
                {societiesQuery.data?.data?.map(soc => (
                  <SelectItem key={soc.id} value={String(soc.id)}>
                    {soc.name} {soc.cityName ? `(${soc.cityName})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {values.societyId ? (
            <div>
              <Label htmlFor={`${idPrefix}-tower`}>Tower / Block</Label>
              <Select
                value={values.towerId ? String(values.towerId) : "none"}
                onValueChange={v => set({ towerId: v === "none" ? null : parseInt(v, 10) })}
              >
                <SelectTrigger className="mt-1" id={`${idPrefix}-tower`}>
                  <SelectValue placeholder="Select tower..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select tower</SelectItem>
                  {towersQuery.data?.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        {values.societyId ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div>
              <Label htmlFor={`${idPrefix}-flat`}>Flat / Unit No.</Label>
              <Input
                id={`${idPrefix}-flat`}
                placeholder="e.g. 1204"
                value={values.flatNumber || ""}
                onChange={e => set({ flatNumber: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-parking-level`}>Parking Level</Label>
              <Input
                id={`${idPrefix}-parking-level`}
                placeholder="e.g. B1, B2, Podium"
                value={values.parkingLevel || ""}
                onChange={e => set({ parkingLevel: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-parking-bay`}>Parking Slot / Bay</Label>
              <Input
                id={`${idPrefix}-parking-bay`}
                placeholder="e.g. B2-148"
                value={values.parkingBay || ""}
                onChange={e => set({ parkingBay: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        ) : null}

        {values.societyId ? (
          <div>
            <Label htmlFor={`${idPrefix}-parking-notes`}>Parking Notes / Landmark</Label>
            <Input
              id={`${idPrefix}-parking-notes`}
              placeholder="e.g. Near pillar 42, next to lift lobby 3"
              value={values.parkingNotes || ""}
              onChange={e => set({ parkingNotes: e.target.value })}
              className="mt-1"
            />
          </div>
        ) : null}
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
    cityId: values.cityId ?? undefined,
    societyId: values.societyId ?? undefined,
    towerId: values.towerId ?? undefined,
    flatNumber: values.flatNumber?.trim() || undefined,
    parkingLevel: values.parkingLevel?.trim() || undefined,
    parkingBay: values.parkingBay?.trim() || undefined,
    parkingNotes: values.parkingNotes?.trim() || undefined,
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
  cityId?: number | null;
  societyId?: number | null;
  towerId?: number | null;
  flatNumber?: string | null;
  parkingLevel?: string | null;
  parkingBay?: string | null;
  parkingNotes?: string | null;
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
    cityId: row.cityId ?? null,
    societyId: row.societyId ?? null,
    towerId: row.towerId ?? null,
    flatNumber: row.flatNumber ?? "",
    parkingLevel: row.parkingLevel ?? "",
    parkingBay: row.parkingBay ?? "",
    parkingNotes: row.parkingNotes ?? "",
    locationType: row.locationType,
    status: row.status,
    latitude: row.latitude != null ? String(row.latitude) : "",
    longitude: row.longitude != null ? String(row.longitude) : "",
    placeId: row.placeId ?? "",
  };
}
