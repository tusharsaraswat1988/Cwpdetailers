import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import {
  useSavedLocations,
  useCreateSavedLocation,
  useUpdateSavedLocation,
  useDeleteSavedLocation,
  useSetDefaultSavedLocation,
  type SavedLocation,
  type SavedLocationWrite,
  type LocationValue,
} from "@/features/master-data/api";
import {
  useGetCustomer,
  useListVehicles,
  useListSolarSites,
  useListSubscriptions,
  getListSubscriptionsQueryKey,
} from "@workspace/api-client-react";
import { useCustomerLocationSources } from "@/hooks/use-customer-location-sources";
import { useSelectedAddress } from "@/hooks/use-selected-address";
import {
  saveSelectedAddress,
  loadSelectedAddress,
  savedLocationToLocationValue,
} from "@/lib/selected-address";
import type { SelectedAddress } from "@/lib/selected-address";
import { activePlans, type RawSubscription } from "@/lib/customer-plans";
import { guessCityFromAddress } from "@workspace/address-model";

interface CustomerAddressContextValue {
  customerId: number | null;
  selectedAddress: SelectedAddress | null;
  selectAddress: (loc: LocationValue, meta?: { assetLabel?: string }) => void;
  shortAddressLabel: string;
  isAddressPickerOpen: boolean;
  setAddressPickerOpen: (open: boolean) => void;
  openAddressPicker: () => void;
  closeAddressPicker: () => void;
  savedLocations: SavedLocation[];
  isLoading: boolean;
  saveNewAddress: (data: SavedLocationWrite) => Promise<SavedLocation>;
  updateAddress: (id: number, data: SavedLocationWrite) => Promise<SavedLocation>;
  deleteAddress: (id: number) => Promise<void>;
  setDefaultAddress: (id: number) => Promise<SavedLocation>;
  currentCityName?: string;
}

const CustomerAddressContext = createContext<CustomerAddressContextValue | null>(null);

function querySettled(q: { isSuccess: boolean; isError: boolean }) {
  return q.isSuccess || q.isError;
}

export function CustomerAddressProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { customerId, currentCityName } = useAccountScope();
  const [isAddressPickerOpen, setAddressPickerOpen] = useState(false);

  const savedQuery = useSavedLocations(customerId ?? undefined);
  const {
    serviceLocations,
    structuredAddresses,
    ready: locationCatalogReady,
  } = useCustomerLocationSources(customerId);

  const customerQuery = useGetCustomer(customerId ?? 0, {
    query: { enabled: customerId != null },
  });

  const vehiclesQuery = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { enabled: customerId != null } },
  );

  const solarQuery = useListSolarSites(
    { customerId: customerId ?? 0 },
    { query: { enabled: customerId != null } },
  );

  const subsQuery = useListSubscriptions(
    { customerId: customerId ?? undefined },
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: customerId ?? undefined }),
        enabled: customerId != null,
      },
    },
  );

  const vehicleRows = useMemo(
    () => (vehiclesQuery.data ?? []) as any[],
    [vehiclesQuery.data],
  );
  const solarRows = useMemo(
    () => (solarQuery.data ?? []) as any[],
    [solarQuery.data],
  );
  const rawSubs = useMemo(
    () => (subsQuery.data?.data ?? []) as RawSubscription[],
    [subsQuery.data?.data],
  );

  const planVehicleId = useMemo(() => {
    const primary = activePlans(rawSubs)[0];
    return primary?.vehicleId ?? null;
  }, [rawSubs]);

  const planSolarSiteId = useMemo(() => {
    const primary = activePlans(rawSubs)[0];
    return primary?.solarSiteId ?? null;
  }, [rawSubs]);

  const ready = useMemo(() => {
    if (customerId == null) return false;
    return (
      locationCatalogReady &&
      querySettled(vehiclesQuery) &&
      querySettled(solarQuery) &&
      querySettled(savedQuery) &&
      querySettled(customerQuery)
    );
  }, [
    customerId,
    locationCatalogReady,
    vehiclesQuery,
    solarQuery,
    savedQuery,
    customerQuery,
  ]);

  const addressContext = useMemo(
    () => ({
      ready,
      vehicles: vehicleRows,
      solarSites: solarRows,
      savedLocations: savedQuery.data,
      serviceLocations,
      structuredAddresses,
      profileAddress: customerQuery.data?.address ?? null,
      planVehicleId,
      planSolarSiteId,
    }),
    [
      ready,
      vehicleRows,
      solarRows,
      savedQuery.data,
      serviceLocations,
      structuredAddresses,
      customerQuery.data?.address,
      planVehicleId,
      planSolarSiteId,
    ],
  );

  const {
    selected: internalSelected,
    selectLocation: internalSelectLocation,
    setAddress: internalSetAddress,
  } = useSelectedAddress(customerId, addressContext);

  const createSavedLocation = useCreateSavedLocation();
  const updateSavedLocation = useUpdateSavedLocation();
  const deleteSavedLocation = useDeleteSavedLocation();
  const setDefaultSavedLocation = useSetDefaultSavedLocation();

  const selectAddress = useCallback(
    (loc: LocationValue, meta?: { assetLabel?: string }) => {
      internalSelectLocation(loc, meta);
      if (customerId != null) {
        saveSelectedAddress(customerId, {
          ...loc,
          assetLabel: meta?.assetLabel ?? (loc as any).label,
        });
      }
    },
    [internalSelectLocation, customerId],
  );

  // Sync selected address if an update to saved locations changed the selected location
  useEffect(() => {
    if (!internalSelected?.savedLocationId || !savedQuery.data || !customerId) return;
    const matching = savedQuery.data.find(
      (s) => s.id === internalSelected.savedLocationId,
    );
    if (matching) {
      const matchLoc = savedLocationToLocationValue(matching);
      if (
        matching.label !== internalSelected.assetLabel ||
        matching.address !== internalSelected.address
      ) {
        const next: SelectedAddress = {
          ...matchLoc,
          assetLabel: matching.label,
        };
        internalSetAddress(next);
        saveSelectedAddress(customerId, next);
      }
    }
  }, [savedQuery.data, internalSelected, customerId, internalSetAddress]);

  const saveNewAddress = useCallback(
    async (data: SavedLocationWrite): Promise<SavedLocation> => {
      const created = await createSavedLocation.mutateAsync(data);
      if (created && customerId != null) {
        const loc = savedLocationToLocationValue(created);
        selectAddress(loc, { assetLabel: created.label });
      }
      return created;
    },
    [createSavedLocation, customerId, selectAddress],
  );

  const updateAddress = useCallback(
    async (id: number, data: SavedLocationWrite): Promise<SavedLocation> => {
      const updated = await updateSavedLocation.mutateAsync({ id, ...data });
      if (updated && customerId != null) {
        // If this updated location matches the currently selected address, update it immediately!
        if (
          internalSelected?.savedLocationId === id ||
          internalSelected?.address === data.address
        ) {
          const loc = savedLocationToLocationValue(updated);
          selectAddress(loc, { assetLabel: updated.label });
        }
      }
      return updated;
    },
    [updateSavedLocation, customerId, internalSelected, selectAddress],
  );

  const deleteAddress = useCallback(
    async (id: number): Promise<void> => {
      if (customerId == null) return;
      await deleteSavedLocation.mutateAsync({ id, customerId });
    },
    [deleteSavedLocation, customerId],
  );

  const setDefaultAddress = useCallback(
    async (id: number): Promise<SavedLocation> => {
      if (customerId == null) throw new Error("Customer not logged in");
      return setDefaultSavedLocation.mutateAsync({ id, customerId });
    },
    [setDefaultSavedLocation, customerId],
  );

  const shortAddressLabel = useMemo(() => {
    if (internalSelected?.assetLabel && internalSelected.assetLabel !== "Saved") {
      const label = internalSelected.assetLabel;
      if (internalSelected.area) return `${label} · ${internalSelected.area}`;
      return label;
    }
    if (internalSelected?.area) {
      return internalSelected.cityName
        ? `${internalSelected.area}, ${internalSelected.cityName}`
        : internalSelected.area;
    }
    if (internalSelected?.address) {
      const parts = internalSelected.address
        .split(/[,\n]/)
        .map((p) => p.trim())
        .filter(Boolean);
      return parts.length > 2
        ? `${parts[0]}, ${parts[1]}`
        : parts[0] || "Select Location";
    }
    return currentCityName || "Select Location";
  }, [
    internalSelected?.assetLabel,
    internalSelected?.area,
    internalSelected?.cityName,
    internalSelected?.address,
    currentCityName,
  ]);

  const value = useMemo(
    () => ({
      customerId,
      selectedAddress: internalSelected,
      selectAddress,
      shortAddressLabel,
      isAddressPickerOpen,
      setAddressPickerOpen,
      openAddressPicker: () => setAddressPickerOpen(true),
      closeAddressPicker: () => setAddressPickerOpen(false),
      savedLocations: savedQuery.data ?? [],
      isLoading: savedQuery.isLoading,
      saveNewAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      currentCityName,
    }),
    [
      customerId,
      internalSelected,
      selectAddress,
      shortAddressLabel,
      isAddressPickerOpen,
      savedQuery.data,
      savedQuery.isLoading,
      saveNewAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      currentCityName,
    ],
  );

  return (
    <CustomerAddressContext.Provider value={value}>
      {children}
    </CustomerAddressContext.Provider>
  );
}

export function useCustomerAddress() {
  const ctx = useContext(CustomerAddressContext);
  if (!ctx) {
    throw new Error(
      "useCustomerAddress must be used within a CustomerAddressProvider",
    );
  }
  return ctx;
}
