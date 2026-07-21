import { useMemo, useState, useEffect } from "react";
import {
  useListVehicles, getListVehiclesQueryKey,
  useListSolarSites, getListSolarSitesQueryKey,
  useListSubscriptions, getListSubscriptionsQueryKey,
  useGetCustomerSummary, getGetCustomerSummaryQueryKey,
  useCreateVehicle, useCreateSolarSite,
  useUpdateVehicle, useUpdateSolarSite,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccountScope } from "@/lib/account-scope";
import type { LocationValue } from "@/features/master-data/api";
import CustomerLayout from "@/components/layout/CustomerLayout";
import { useToast } from "@/hooks/use-toast";
import { Car, Sun, Plus } from "lucide-react";
import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";
import { AssetCard } from "@/components/assets/AssetCard";
import { AssetEmptyState } from "@/components/assets/AssetEmptyState";
import { AddAssetSheet } from "@/components/assets/AddAssetSheet";
import { EditAssetSheet } from "@/components/assets/EditAssetSheet";
import {
  buildAssetsDashboard,
  saveSingleAssetHint,
  type AssetCardModel,
} from "@/lib/asset-dashboard";
import type { RawSubscription } from "@/lib/customer-plans";
import {
  CustomerPage,
  CustomerHeader,
  CustomerEmptyState,
  CustomerSkeleton,
  CustomerButton,
} from "@/features/customer-ds";

type VehicleRecord = {
  id: number;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  registrationNumber?: string;
  vehicleModelId?: number | null;
  seatCategoryId?: number | null;
  serviceAddress?: string | null;
  address?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
  locationComplete?: boolean;
  refPhotoFrontUrl?: string | null;
};

type SolarRecord = {
  id: number;
  siteName?: string | null;
  address?: string;
  panelCount?: number;
  panelCapacityKw?: string | number | null;
  lastCleanedDate?: string | null;
  nextServiceDate?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

function locationFromAsset(
  asset: AssetCardModel,
  vehicles: VehicleRecord[],
  solarSites: SolarRecord[],
): LocationValue | null {
  if (asset.kind === "vehicle") {
    const v = vehicles.find(row => row.id === asset.id);
    if (!v) return null;
    const address = (v.serviceAddress ?? v.address ?? "").trim();
    if (!address || v.serviceLat == null || v.serviceLng == null) return null;
    return { address, latitude: v.serviceLat, longitude: v.serviceLng, placeId: v.placeId ?? undefined };
  }
  const s = solarSites.find(row => row.id === asset.id);
  if (!s?.address) return null;
  return {
    address: s.address,
    latitude: s.serviceLat ?? 0,
    longitude: s.serviceLng ?? 0,
    placeId: s.placeId ?? undefined,
  };
}

export default function MyAssets() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { customerId, isLoading: scopeLoading, missingCustomerLink } = useAccountScope();

  const { data: vehicles, isLoading: loadingVehicles } = useListVehicles(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListVehiclesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );
  const { data: solarSites, isLoading: loadingSolar } = useListSolarSites(
    { customerId: customerId ?? 0 },
    { query: { queryKey: getListSolarSitesQueryKey({ customerId: customerId ?? 0 }), enabled: customerId != null } },
  );
  const { data: subs } = useListSubscriptions(
    { customerId: String(customerId ?? "") } as Parameters<typeof useListSubscriptions>[0],
    {
      query: {
        queryKey: getListSubscriptionsQueryKey({ customerId: String(customerId ?? "") } as Parameters<typeof getListSubscriptionsQueryKey>[0]),
        enabled: customerId != null,
      },
    },
  );
  const { data: summary, isLoading: loadingSummary } = useGetCustomerSummary(customerId ?? 0, {
    query: {
      queryKey: getGetCustomerSummaryQueryKey(customerId ?? 0),
      enabled: customerId != null,
    },
  });

  const [addKind, setAddKind] = useState<"vehicle" | "solar" | null>(null);
  const [editAsset, setEditAsset] = useState<AssetCardModel | null>(null);

  const vehicleRows = (vehicles ?? []) as VehicleRecord[];
  const solarRows = (solarSites ?? []) as SolarRecord[];

  const dashboard = useMemo(() => {
    if (customerId == null) return null;
    return buildAssetsDashboard({
      vehicles: vehicleRows,
      solarSites: solarRows,
      subscriptions: (subs?.data ?? []) as RawSubscription[],
      bookings: summary?.recentBookings,
    });
  }, [customerId, vehicleRows, solarRows, subs, summary?.recentBookings]);

  useEffect(() => {
    if (customerId == null || !dashboard?.singleAssetId || !dashboard.singleAssetKind) return;
    saveSingleAssetHint(customerId, dashboard.singleAssetId, dashboard.singleAssetKind);
  }, [customerId, dashboard?.singleAssetId, dashboard?.singleAssetKind]);

  const createVehicle = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        setAddKind(null);
        toast({ title: "Vehicle added" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add vehicle", variant: "destructive" }),
    },
  });

  const createSolar = useCreateSolarSite({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });
        setAddKind(null);
        toast({ title: "Solar site added" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to add solar site", variant: "destructive" }),
    },
  });

  const updateVehicle = useUpdateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        setEditAsset(null);
        toast({ title: "Vehicle updated" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to update vehicle", variant: "destructive" }),
    },
  });

  const updateSolar = useUpdateSolarSite({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });
        setEditAsset(null);
        toast({ title: "Solar site updated" });
      },
      onError: (err: { response?: { data?: { error?: string } } }) =>
        toast({ title: err?.response?.data?.error ?? "Failed to update solar site", variant: "destructive" }),
    },
  });

  const loading = loadingVehicles || loadingSolar || loadingSummary;

  if (scopeLoading) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerSkeleton className="h-8 w-48" />
          <CustomerSkeleton className="h-32" />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  if (missingCustomerLink || customerId == null) {
    return (
      <CustomerLayout>
        <CustomerPage>
          <CustomerEmptyState
            title="Account not linked"
            description="Your login is not linked to a customer profile yet."
            action={<NoCustomerProfileMessage />}
            hint=""
          />
        </CustomerPage>
      </CustomerLayout>
    );
  }

  const editLocation = editAsset ? locationFromAsset(editAsset, vehicleRows, solarRows) : null;
  const editVehicle = editAsset?.kind === "vehicle"
    ? vehicleRows.find(row => row.id === editAsset.id) ?? null
    : null;
  const editSolar = editAsset?.kind === "solar"
    ? solarRows.find(row => row.id === editAsset.id) ?? null
    : null;

  return (
    <CustomerLayout>
      <div data-testid="assets-page">
      <CustomerPage>
        <CustomerHeader
          title="My Vehicles & Solar Sites"
          subtitle="What CWP takes care of for you — plans, visits, and service addresses in one place."
        />

        {loading || !dashboard ? (
          <div className="space-y-3">
            <CustomerSkeleton className="h-40" />
            <CustomerSkeleton className="h-40" />
          </div>
        ) : dashboard.totalCount === 0 ? (
          <AssetEmptyState
            onAddVehicle={() => setAddKind("vehicle")}
            onAddSolar={() => setAddKind("solar")}
          />
        ) : (
          <>
            {dashboard.vehicles.length > 0 && (
              <section aria-labelledby="vehicles-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 id="vehicles-heading" className="font-semibold text-sm flex items-center gap-1.5">
                    <Car size={16} aria-hidden />
                    Vehicles
                  </h2>
                  <CustomerButton variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => setAddKind("vehicle")}>
                    <Plus size={14} aria-hidden />
                    Add
                  </CustomerButton>
                </div>
                <div className="space-y-3">
                  {dashboard.vehicles.map(asset => (
                    <AssetCard key={asset.id} asset={asset} onEdit={setEditAsset} />
                  ))}
                </div>
              </section>
            )}

            {dashboard.solarSites.length > 0 && (
              <section aria-labelledby="solar-heading" className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 id="solar-heading" className="font-semibold text-sm flex items-center gap-1.5">
                    <Sun size={16} aria-hidden />
                    Solar Sites
                  </h2>
                  <CustomerButton variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => setAddKind("solar")}>
                    <Plus size={14} aria-hidden />
                    Add
                  </CustomerButton>
                </div>
                <div className="space-y-3">
                  {dashboard.solarSites.map(asset => (
                    <AssetCard key={asset.id} asset={asset} onEdit={setEditAsset} />
                  ))}
                </div>
              </section>
            )}

            {(dashboard.vehicles.length === 0 || dashboard.solarSites.length === 0) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {dashboard.vehicles.length === 0 && (
                  <CustomerButton variant="outline" size="sm" className="gap-1" onClick={() => setAddKind("vehicle")}>
                    <Plus size={14} /> Add Vehicle
                  </CustomerButton>
                )}
                {dashboard.solarSites.length === 0 && (
                  <CustomerButton variant="outline" size="sm" className="gap-1" onClick={() => setAddKind("solar")}>
                    <Plus size={14} /> Add Solar Site
                  </CustomerButton>
                )}
              </div>
            )}
          </>
        )}
      </CustomerPage>
      </div>

      <AddAssetSheet
        kind={addKind}
        open={addKind != null}
        onOpenChange={open => { if (!open) setAddKind(null); }}
        saving={createVehicle.isPending || createSolar.isPending}
        onSaveVehicle={({ model, seatCategoryId, year, color, registrationNumber, location }) => {
          createVehicle.mutate({
            data: {
              customerId,
              vehicleModelId: model.id,
              seatCategoryId,
              make: model.brandName,
              model: model.name,
              year: year ? parseInt(year) : undefined,
              color: color || undefined,
              registrationNumber,
              serviceAddress: location.address,
              serviceLat: location.latitude,
              serviceLng: location.longitude,
              placeId: location.placeId,
              locationLabel: "Default Service Location",
            } as Parameters<typeof createVehicle.mutate>[0]["data"],
          });
        }}
        onSaveSolar={({ panelCount, location }) => {
          createSolar.mutate({
            data: {
              customerId,
              address: location.address,
              panelCount: parseInt(panelCount),
              serviceLat: location.latitude,
              serviceLng: location.longitude,
              placeId: location.placeId,
              locationLabel: "Solar Site",
            } as Parameters<typeof createSolar.mutate>[0]["data"],
          });
        }}
      />

      <EditAssetSheet
        asset={editAsset}
        open={editAsset != null}
        onOpenChange={open => { if (!open) setEditAsset(null); }}
        initialLocation={editLocation}
        vehicleSeed={editVehicle}
        solarSeed={editSolar}
        saving={updateVehicle.isPending || updateSolar.isPending}
        onSaveVehicle={({ model, seatCategoryId, year, color, registrationNumber, location }) => {
          if (!editAsset || editAsset.kind !== "vehicle") return;
          updateVehicle.mutate({
            id: editAsset.id,
            data: {
              customerId,
              vehicleModelId: model.id,
              seatCategoryId,
              make: model.brandName,
              model: model.name,
              year: year ? parseInt(year) : undefined,
              color: color || undefined,
              registrationNumber,
              serviceAddress: location.address,
              serviceLat: location.latitude,
              serviceLng: location.longitude,
              placeId: location.placeId,
            } as Parameters<typeof updateVehicle.mutate>[0]["data"],
          });
        }}
        onSaveSolar={({ siteName, panelCount, panelCapacityKw, location }) => {
          if (!editAsset || editAsset.kind !== "solar") return;
          updateSolar.mutate({
            id: editAsset.id,
            data: {
              customerId,
              siteName: siteName || undefined,
              address: location.address,
              panelCount: parseInt(panelCount, 10),
              panelCapacityKw: panelCapacityKw || undefined,
              serviceLat: location.latitude,
              serviceLng: location.longitude,
              placeId: location.placeId,
            } as Parameters<typeof updateSolar.mutate>[0]["data"],
          });
        }}
      />
    </CustomerLayout>
  );
}
