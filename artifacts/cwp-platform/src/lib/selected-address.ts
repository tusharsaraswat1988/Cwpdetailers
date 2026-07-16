import type { Booking } from "@workspace/api-client-react";
import type { LocationValue } from "@/features/master-data/api";

export type SelectedAddress = LocationValue & {
  assetId?: number;
  assetType?: "vehicle" | "solar";
  assetLabel?: string;
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

const STORAGE_PREFIX = "cwp:selected-address:";

function storageKey(customerId: number): string {
  return `${STORAGE_PREFIX}${customerId}`;
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
  const lat = v.serviceLat;
  const lng = v.serviceLng;
  if (!line || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const assetLabel = [v.registrationNumber, v.make, v.model].filter(Boolean).join(" · ");
  return {
    address: line,
    latitude: lat,
    longitude: lng,
    placeId: v.placeId ?? undefined,
    assetId: v.id,
    assetType: "vehicle",
    assetLabel: assetLabel || undefined,
  };
}

function locationFromSolar(s: SolarLike): SelectedAddress | null {
  const line = (s.address ?? "").trim();
  const lat = s.serviceLat;
  const lng = s.serviceLng;
  if (!line || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    if (line) {
      return { address: line, latitude: 0, longitude: 0, assetId: s.id, assetType: "solar", assetLabel: "Solar site" };
    }
    return null;
  }
  return {
    address: line,
    latitude: lat,
    longitude: lng,
    placeId: s.placeId ?? undefined,
    assetId: s.id,
    assetType: "solar",
    assetLabel: "Solar site",
  };
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

/** Resolve default service address from booking → vehicle → solar. */
export function resolveDefaultAddress(input: {
  recentBookings?: Booking[];
  vehicles: VehicleLike[];
  solarSites: SolarLike[];
}): SelectedAddress | null {
  const upcoming = findUpcomingBooking(input.recentBookings);
  if (upcoming?.address?.trim()) {
    return {
      address: upcoming.address.trim(),
      latitude: upcoming.locationLat ?? 0,
      longitude: upcoming.locationLng ?? 0,
      assetLabel: upcoming.vehicleInfo?.trim() || undefined,
    };
  }

  const vehicle = input.vehicles.find(v => (v.serviceAddress ?? v.address ?? "").trim().length > 0);
  const fromVehicle = vehicle ? locationFromVehicle(vehicle) : null;
  if (fromVehicle) return fromVehicle;

  const solar = input.solarSites.find(s => (s.address ?? "").trim().length > 0);
  if (solar) return locationFromSolar(solar);

  return null;
}

export function selectedToHomeAddress(
  selected: SelectedAddress | null,
  hasAssets: boolean,
): { line: string; assetLabel?: string; complete: boolean } {
  if (selected?.address?.trim()) {
    return {
      line: selected.address.trim(),
      assetLabel: selected.assetLabel,
      complete: selected.latitude !== 0 || selected.longitude !== 0
        ? Number.isFinite(selected.latitude) && Number.isFinite(selected.longitude)
        : true,
    };
  }
  return {
    line: hasAssets ? "Add where we should arrive" : "Add your vehicle or solar site",
    complete: false,
  };
}
