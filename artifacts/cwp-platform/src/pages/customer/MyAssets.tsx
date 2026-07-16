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

import { Button } from "@/components/ui/button";

import { useToast } from "@/hooks/use-toast";

import { Car, Sun, Plus } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { NoCustomerProfileMessage } from "@/components/shared/NoCustomerProfileMessage";

import { AssetCard } from "@/components/assets/AssetCard";

import { AssetEmptyState } from "@/components/assets/AssetEmptyState";

import { AddAssetSheet } from "@/components/assets/AddAssetSheet";

import { EditAssetAddressSheet } from "@/components/assets/EditAssetAddressSheet";

import {

  buildAssetsDashboard,

  saveSingleAssetHint,

  type AssetCardModel,

} from "@/lib/asset-dashboard";

import type { RawSubscription } from "@/lib/customer-plans";



type VehicleRecord = {

  id: number;

  make?: string;

  model?: string;

  year?: number;

  color?: string;

  registrationNumber?: string;

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

  address?: string;

  panelCount?: number;

  lastCleanedDate?: string | null;

  nextServiceDate?: string | null;

  serviceLat?: number | null;

  serviceLng?: number | null;

  placeId?: string | null;

};



function locationFromAsset(asset: AssetCardModel, vehicles: VehicleRecord[], solarSites: SolarRecord[]): LocationValue | null {

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

        toast({ title: "Address updated" });

      },

      onError: () => toast({ title: "Failed to update address", variant: "destructive" }),

    },

  });



  const updateSolar = useUpdateSolarSite({

    mutation: {

      onSuccess: () => {

        qc.invalidateQueries({ queryKey: getListSolarSitesQueryKey() });

        setEditAsset(null);

        toast({ title: "Address updated" });

      },

      onError: () => toast({ title: "Failed to update address", variant: "destructive" }),

    },

  });



  const loading = loadingVehicles || loadingSolar || loadingSummary;



  if (scopeLoading) {

    return (

      <CustomerLayout>

        <div className="space-y-3">

          <Skeleton className="h-8 w-48" />

          <Skeleton className="h-32 rounded-xl" />

        </div>

      </CustomerLayout>

    );

  }



  if (missingCustomerLink || customerId == null) {

    return (

      <CustomerLayout>

        <div className="max-w-md mx-auto text-center space-y-2 py-12">

          <p className="font-semibold">Account not linked</p>

          <NoCustomerProfileMessage />

        </div>

      </CustomerLayout>

    );

  }



  const editLocation = editAsset ? locationFromAsset(editAsset, vehicleRows, solarRows) : null;



  return (

    <CustomerLayout>

      <div className="space-y-5" data-testid="assets-page">

        <header>

          <h1 className="font-display font-bold text-xl">My Vehicles & Solar Sites</h1>

          <p className="text-muted-foreground text-sm mt-1">

            What CWP takes care of for you — plans, visits, and service addresses in one place.

          </p>

        </header>



        {loading || !dashboard ? (

          <div className="space-y-3">

            <Skeleton className="h-40 rounded-xl" />

            <Skeleton className="h-40 rounded-xl" />

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

                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => setAddKind("vehicle")}>

                    <Plus size={14} aria-hidden />

                    Add

                  </Button>

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

                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary" onClick={() => setAddKind("solar")}>

                    <Plus size={14} aria-hidden />

                    Add

                  </Button>

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

                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddKind("vehicle")}>

                    <Plus size={14} /> Add Vehicle

                  </Button>

                )}

                {dashboard.solarSites.length === 0 && (

                  <Button variant="outline" size="sm" className="gap-1" onClick={() => setAddKind("solar")}>

                    <Plus size={14} /> Add Solar Site

                  </Button>

                )}

              </div>

            )}

          </>

        )}

      </div>



      <AddAssetSheet

        kind={addKind}

        open={addKind != null}

        onOpenChange={open => { if (!open) setAddKind(null); }}

        saving={createVehicle.isPending || createSolar.isPending}

        onSaveVehicle={({ model, year, color, registrationNumber, location }) => {

          createVehicle.mutate({

            data: {

              customerId,

              vehicleModelId: model.id,

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



      <EditAssetAddressSheet

        asset={editAsset}

        open={editAsset != null}

        onOpenChange={open => { if (!open) setEditAsset(null); }}

        initialLocation={editLocation}

        saving={updateVehicle.isPending || updateSolar.isPending}

        onSave={(asset, location) => {

          if (asset.kind === "vehicle") {

            const v = vehicleRows.find(row => row.id === asset.id);

            if (!v) return;

            updateVehicle.mutate({

              id: asset.id,

              data: {

                customerId,

                registrationNumber: v.registrationNumber ?? "",

                make: v.make ?? "",

                model: v.model ?? "",

                serviceAddress: location.address,

                serviceLat: location.latitude,

                serviceLng: location.longitude,

                placeId: location.placeId,

              } as Parameters<typeof updateVehicle.mutate>[0]["data"],

            });

          } else {

            const s = solarRows.find(row => row.id === asset.id);

            updateSolar.mutate({

              id: asset.id,

              data: {

                customerId,

                address: location.address,

                panelCount: s?.panelCount ?? 1,

                serviceLat: location.latitude,

                serviceLng: location.longitude,

                placeId: location.placeId,

              } as Parameters<typeof updateSolar.mutate>[0]["data"],

            });

          }

        }}

      />

    </CustomerLayout>

  );

}

