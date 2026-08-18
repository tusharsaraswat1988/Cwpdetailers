import { useCallback, useEffect, useMemo, useState } from "react";
import type { Booking } from "@workspace/api-client-react";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import {
  loadSelectedAddress,
  resolveDefaultAddress,
  saveSelectedAddress,
  toPickerLocations,
  addressesMatch,
  type SavedLocationLike,
  type SelectedAddress,
  type ServiceLocationLike,
  type StructuredAddressLike,
} from "@/lib/selected-address";

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

export type SelectedAddressContext = {
  ready: boolean;
  recentBookings?: Booking[];
  vehicles: VehicleLike[];
  solarSites: SolarLike[];
  savedLocations?: SavedLocation[];
  serviceLocations?: ServiceLocationLike[];
  structuredAddresses?: StructuredAddressLike[];
  profileAddress?: string | null;
  planVehicleId?: number | null;
  planSolarSiteId?: number | null;
};

export function useSelectedAddress(
  customerId: number | null,
  context: SelectedAddressContext,
) {
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [initialized, setInitialized] = useState(false);

  const resolveInput = useMemo(() => ({
    recentBookings: context.recentBookings,
    vehicles: context.vehicles,
    solarSites: context.solarSites,
    savedLocations: context.savedLocations,
    serviceLocations: context.serviceLocations,
    structuredAddresses: context.structuredAddresses,
    profileAddress: context.profileAddress,
    planVehicleId: context.planVehicleId,
    planSolarSiteId: context.planSolarSiteId,
  }), [
    context.recentBookings,
    context.vehicles,
    context.solarSites,
    context.savedLocations,
    context.serviceLocations,
    context.structuredAddresses,
    context.profileAddress,
    context.planVehicleId,
    context.planSolarSiteId,
  ]);

  const inferred = useMemo(
    () => resolveDefaultAddress(resolveInput),
    [resolveInput],
  );

  const pickerLocations = useMemo((): SavedLocation[] => {
    if (customerId == null) return context.savedLocations ?? [];
    return toPickerLocations(customerId, resolveInput) as SavedLocation[];
  }, [customerId, resolveInput, context.savedLocations]);

  useEffect(() => {
    if (customerId == null || !context.ready) return;
    const stored = loadSelectedAddress(customerId);
    const next = stored ?? inferred;
    setSelected(prev => (next && addressesMatch(prev, next) ? prev : next));
    if (!stored && inferred) saveSelectedAddress(customerId, inferred);
    setInitialized(true);
  }, [customerId, context.ready, inferred]);

  const setAddress = useCallback((next: SelectedAddress) => {
    if (customerId == null) return;
    setSelected(next);
    saveSelectedAddress(customerId, next);
  }, [customerId]);

  const selectLocation = useCallback((
    loc: LocationValue,
    meta?: Pick<SelectedAddress, "assetId" | "assetType" | "assetLabel">,
  ) => {
    setAddress({ ...loc, ...meta });
  }, [setAddress]);

  const selectFromSaved = useCallback((loc: SavedLocationLike) => {
    selectLocation({
      address: loc.address,
      latitude: loc.latitude,
      longitude: loc.longitude,
      placeId: loc.placeId,
    }, { assetLabel: loc.label });
  }, [selectLocation]);

  return {
    selected,
    initialized,
    setAddress,
    selectLocation,
    selectFromSaved,
    savedLocations: pickerLocations,
  };
}
