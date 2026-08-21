import type { Booking } from "@workspace/api-client-react";
import type { LocationValue } from "@/features/master-data/api";

export type SelectedAddress = LocationValue & {
  assetId?: number;
  assetType?: "vehicle" | "solar";
  assetLabel?: string;
};

export type SavedLocationLike = {
  id: number;
  customerId?: number;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  placeId?: string | null;
  isDefault?: boolean;
  savedLocationId?: number;
  houseNumber?: string | null;
  area?: string | null;
  cityName?: string | null;
  pincode?: string | null;
};

export type ServiceLocationLike = {
  id: number;
  label: string;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  isDefault?: boolean;
};

export type StructuredAddressLike = {
  id: number;
  nickname?: string | null;
  formattedAddress?: string | null;
  houseNumber?: string | null;
  buildingName?: string | null;
  area?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  isDefault?: boolean;
};

type VehicleLike = {
  id: number;
  registrationNumber?: string;
  make?: string;
  model?: string;
  serviceAddress?: string | null;
  address?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

type SolarLike = {
  id: number;
  address?: string;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

type AddressCandidate = SelectedAddress & {
  isDefault?: boolean;
};

export type ResolveAddressInput = {
  recentBookings?: Booking[];
  vehicles: VehicleLike[];
  solarSites: SolarLike[];
  savedLocations?: SavedLocationLike[];
  serviceLocations?: ServiceLocationLike[];
  structuredAddresses?: StructuredAddressLike[];
  profileAddress?: string | null;
  planVehicleId?: number | null;
  planSolarSiteId?: number | null;
};

const STORAGE_PREFIX = "cwp:selected-address:";
const EMPTY_HOME_LINE = "Add where we should arrive";

function storageKey(customerId: number): string {
  return `${STORAGE_PREFIX}${customerId}`;
}

export function hasMapPin(loc: { latitude?: number | null; longitude?: number | null }): boolean {
  const lat = loc.latitude;
  const lng = loc.longitude;
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

function normalizeLine(line: string): string {
  return line.trim().toLowerCase().replace(/\s+/g, " ");
}

function addressKey(line: string, lat?: number | null, lng?: number | null): string {
  const n = normalizeLine(line);
  if (hasMapPin({ latitude: lat, longitude: lng })) {
    return `${n}|${Number(lat).toFixed(5)}|${Number(lng).toFixed(5)}`;
  }
  return n;
}

function coords(lat?: number | null, lng?: number | null): { latitude: number; longitude: number } {
  if (hasMapPin({ latitude: lat, longitude: lng })) {
    return { latitude: lat as number, longitude: lng as number };
  }
  return { latitude: 0, longitude: 0 };
}

export function loadSelectedAddress(customerId: number): SelectedAddress | null {
  try {
    const raw = localStorage.getItem(storageKey(customerId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SelectedAddress;
    if (!parsed.address?.trim() || !Number.isFinite(parsed.latitude) || !Number.isFinite(parsed.longitude)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSelectedAddress(customerId: number, address: SelectedAddress): void {
  localStorage.setItem(storageKey(customerId), JSON.stringify(address));
}

function locationFromVehicle(v: VehicleLike): SelectedAddress | null {
  const line = (v.serviceAddress ?? v.address ?? "").trim();
  if (!line) return null;
  const assetLabel = [v.registrationNumber, v.make, v.model].filter(Boolean).join(" · ");
  return {
    address: line,
    ...coords(v.serviceLat, v.serviceLng),
    placeId: v.placeId ?? undefined,
    assetId: v.id,
    assetType: "vehicle",
    assetLabel: assetLabel || undefined,
  };
}

function locationFromSolar(s: SolarLike): SelectedAddress | null {
  const line = (s.address ?? "").trim();
  if (!line) return null;
  return {
    address: line,
    ...coords(s.serviceLat, s.serviceLng),
    placeId: s.placeId ?? undefined,
    assetId: s.id,
    assetType: "solar",
    assetLabel: "Solar site",
  };
}

function lineFromStructured(row: StructuredAddressLike): string {
  const formatted = (row.formattedAddress ?? "").trim();
  if (formatted) return formatted;
  return [row.houseNumber, row.buildingName, row.area, row.postalCode].filter(Boolean).join(", ").trim();
}

function findUpcomingBooking(bookings: Booking[] | undefined): Booking | undefined {
  return (bookings ?? []).find(b =>
    b.status === "pending"
    || b.status === "scheduled"
    || b.status === "confirmed"
    || b.status === "en_route"
    || b.status === "in_progress"
    || b.status === "rescheduled",
  );
}

function pushCandidate(list: AddressCandidate[], seen: Set<string>, next: AddressCandidate | null) {
  const line = next?.address?.trim();
  if (!next || !line) return;
  const key = addressKey(line, next.latitude, next.longitude);
  if (seen.has(key)) return;
  seen.add(key);
  list.push({ ...next, address: line });
}

/** Known service locations for this customer, de-duplicated, default first. */
export function collectAddressCandidates(input: ResolveAddressInput): AddressCandidate[] {
  const list: AddressCandidate[] = [];
  const seen = new Set<string>();

  for (const loc of input.savedLocations ?? []) {
    pushCandidate(list, seen, {
      address: loc.address,
      latitude: loc.latitude ?? 0,
      longitude: loc.longitude ?? 0,
      placeId: loc.placeId ?? undefined,
      assetLabel: loc.label || undefined,
      isDefault: loc.isDefault,
      savedLocationId: loc.id,
      houseNumber: loc.houseNumber ?? undefined,
      area: loc.area ?? undefined,
      cityName: loc.cityName ?? undefined,
      pincode: loc.pincode ?? undefined,
    });
  }

  for (const loc of input.serviceLocations ?? []) {
    const line = [loc.address?.trim(), loc.city?.trim()].filter(Boolean).join(", ");
    if (!line) continue;
    pushCandidate(list, seen, {
      address: line,
      ...coords(loc.latitude, loc.longitude),
      placeId: loc.placeId ?? undefined,
      assetLabel: loc.label || undefined,
      isDefault: loc.isDefault,
    });
  }

  for (const row of input.structuredAddresses ?? []) {
    pushCandidate(list, seen, {
      address: lineFromStructured(row),
      ...coords(row.latitude, row.longitude),
      placeId: row.placeId ?? undefined,
      assetLabel: row.nickname?.trim() || undefined,
      isDefault: row.isDefault,
    });
  }

  if (input.planVehicleId != null) {
    const vehicle = input.vehicles.find(v => v.id === input.planVehicleId);
    if (vehicle) pushCandidate(list, seen, locationFromVehicle(vehicle));
  }
  if (input.planSolarSiteId != null) {
    const solar = input.solarSites.find(s => s.id === input.planSolarSiteId);
    if (solar) pushCandidate(list, seen, locationFromSolar(solar));
  }

  for (const v of input.vehicles) {
    pushCandidate(list, seen, locationFromVehicle(v));
  }
  for (const s of input.solarSites) {
    pushCandidate(list, seen, locationFromSolar(s));
  }

  const profile = (input.profileAddress ?? "").trim();
  if (profile) {
    pushCandidate(list, seen, { address: profile, latitude: 0, longitude: 0, assetLabel: "Home" });
  }

  const upcoming = findUpcomingBooking(input.recentBookings);
  if (upcoming?.address?.trim()) {
    pushCandidate(list, seen, {
      address: upcoming.address.trim(),
      latitude: upcoming.locationLat ?? 0,
      longitude: upcoming.locationLng ?? 0,
      assetLabel: upcoming.vehicleInfo?.trim() || undefined,
    });
  }

  return list;
}

/**
 * Urban Company-style location: last choice → default → single address →
 * active plan asset → first known location.
 */
export function resolveDefaultAddress(input: ResolveAddressInput): SelectedAddress | null {
  const candidates = collectAddressCandidates(input);

  const preferred = candidates.find(c => c.isDefault);
  if (preferred) return preferred;
  if (candidates.length === 1) return candidates[0] ?? null;

  if (input.planVehicleId != null) {
    const fromPlan = candidates.find(c => c.assetType === "vehicle" && c.assetId === input.planVehicleId);
    if (fromPlan) return fromPlan;
  }
  if (input.planSolarSiteId != null) {
    const fromPlan = candidates.find(c => c.assetType === "solar" && c.assetId === input.planSolarSiteId);
    if (fromPlan) return fromPlan;
  }

  return candidates[0] ?? null;
}

export function toPickerLocations(
  customerId: number,
  input: ResolveAddressInput,
): SavedLocationLike[] {
  return collectAddressCandidates(input).map((c, index) => ({
    id: c.savedLocationId ?? index + 1,
    customerId,
    label: c.assetLabel?.trim() || "Saved",
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
    placeId: c.placeId,
    savedLocationId: c.savedLocationId,
  }));
}

export function addressesMatch(
  a: { address?: string; latitude?: number; longitude?: number } | null | undefined,
  b: { address?: string; latitude?: number; longitude?: number } | null | undefined,
): boolean {
  if (!a?.address?.trim() || !b?.address?.trim()) return false;
  if (hasMapPin(a) && hasMapPin(b)) {
    return Math.abs((a.latitude ?? 0) - (b.latitude ?? 0)) < 1e-6
      && Math.abs((a.longitude ?? 0) - (b.longitude ?? 0)) < 1e-6;
  }
  return normalizeLine(a.address) === normalizeLine(b.address);
}

export function selectedToHomeAddress(
  selected: SelectedAddress | null,
): { line: string; assetLabel?: string; complete: boolean } {
  if (selected?.address?.trim()) {
    return {
      line: selected.address.trim(),
      assetLabel: selected.assetLabel,
      complete: hasMapPin(selected),
    };
  }
  return {
    line: EMPTY_HOME_LINE,
    complete: false,
  };
}
