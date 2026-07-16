import { useCallback, useEffect, useMemo, useState } from "react";
import type { Booking } from "@workspace/api-client-react";
import type { LocationValue, SavedLocation } from "@/features/master-data/api";
import {
  loadSelectedAddress,
  resolveDefaultAddress,
  saveSelectedAddress,
  type SelectedAddress,
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

export function useSelectedAddress(
  customerId: number | null,
  context: {
    recentBookings?: Booking[];
    vehicles: VehicleLike[];
    solarSites: SolarLike[];
    savedLocations?: SavedLocation[];
  },
) {
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [initialized, setInitialized] = useState(false);

  const defaultAddress = useMemo(
    () => resolveDefaultAddress(context),
    [context.recentBookings, context.vehicles, context.solarSites],
  );

  useEffect(() => {
    if (customerId == null) return;
    const stored = loadSelectedAddress(customerId);
    setSelected(stored ?? defaultAddress);
    setInitialized(true);
  }, [customerId, defaultAddress]);

  const setAddress = useCallback((next: SelectedAddress) => {
    if (customerId == null) return;
    setSelected(next);
    saveSelectedAddress(customerId, next);
  }, [customerId]);

  const selectLocation = useCallback((loc: LocationValue, meta?: Pick<SelectedAddress, "assetId" | "assetType" | "assetLabel">) => {
    setAddress({ ...loc, ...meta });
  }, [setAddress]);

  const selectFromSaved = useCallback((loc: SavedLocation) => {
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
    savedLocations: context.savedLocations ?? [],
  };
}
