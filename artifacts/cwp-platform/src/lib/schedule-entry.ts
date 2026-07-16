import type { LocationValue } from "@/features/master-data/api";
import {
  eligibleBookingPlans,
  type CustomerPlan,
  type RawSubscription,
} from "@/lib/customer-plans";
import { loadSingleAssetHint } from "@/lib/asset-dashboard";
import { loadSelectedAddress, type SelectedAddress } from "@/lib/selected-address";
import {
  countAssets,
  resolveActiveStep,
  type PlanMode,
  type ScheduleAsset,
  type ScheduleStep,
} from "@/lib/schedule-journey";

export type ScheduleEntrySource = "home" | "plans" | "assets" | "fab";

export type ScheduleEntryParams = {
  vehicleId?: number;
  solarSiteId?: number;
  planId?: number;
  mode?: "one_time";
  from?: ScheduleEntrySource;
};

type VehicleRow = {
  id: number;
  make?: string;
  model?: string;
  registrationNumber?: string;
  serviceAddress?: string | null;
  address?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

type SolarRow = {
  id: number;
  address?: string;
  panelCount?: number;
  serviceLat?: number | null;
  serviceLng?: number | null;
  placeId?: string | null;
};

export type ScheduleEntryContext = {
  params: ScheduleEntryParams;
  asset: ScheduleAsset | null;
  planMode: PlanMode | null;
  selectedPlan: CustomerPlan | null;
  address: LocationValue | null;
  redirectDailyCleaning: boolean;
  initialStep: ScheduleStep;
};

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseScheduleEntryParams(
  search?: string | URLSearchParams,
): ScheduleEntryParams {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(
      typeof search === "string"
        ? (search.startsWith("?") ? search.slice(1) : search)
        : "",
    );

  const from = params.get("from");
  const validFrom = from === "home" || from === "plans" || from === "assets" || from === "fab"
    ? from
    : undefined;

  return {
    vehicleId: parsePositiveInt(params.get("vehicleId")),
    solarSiteId: parsePositiveInt(params.get("solarSiteId")),
    planId: parsePositiveInt(params.get("planId")),
    mode: params.get("mode") === "one_time" ? "one_time" : undefined,
    from: validFrom,
  };
}

const SCHEDULE_PATH = "/customer/schedule";

export function buildScheduleEntryUrl(params?: ScheduleEntryParams): string {
  if (!params) return SCHEDULE_PATH;

  const qs = new URLSearchParams();
  if (params.vehicleId != null) qs.set("vehicleId", String(params.vehicleId));
  if (params.solarSiteId != null) qs.set("solarSiteId", String(params.solarSiteId));
  if (params.planId != null) qs.set("planId", String(params.planId));
  if (params.mode === "one_time") qs.set("mode", "one_time");
  if (params.from) qs.set("from", params.from);

  const query = qs.toString();
  return query ? `${SCHEDULE_PATH}?${query}` : SCHEDULE_PATH;
}

function locationFromRecord(row: VehicleRow | SolarRow, kind: "vehicle" | "solar"): LocationValue | null {
  const address = kind === "vehicle"
    ? ((row as VehicleRow).serviceAddress ?? (row as VehicleRow).address ?? "").trim()
    : ((row as SolarRow).address ?? "").trim();
  const lat = row.serviceLat;
  const lng = row.serviceLng;
  if (!address || lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { address, latitude: lat, longitude: lng, placeId: row.placeId ?? undefined };
}

function enrichAsset(
  asset: ScheduleAsset,
  vehicles: VehicleRow[],
  solarSites: SolarRow[],
): ScheduleAsset {
  const row = asset.kind === "vehicle"
    ? vehicles.find(v => v.id === asset.id)
    : solarSites.find(s => s.id === asset.id);
  if (!row) return asset;
  return { ...asset, location: locationFromRecord(row, asset.kind) };
}

function vehicleAsset(v: VehicleRow, vehicles: VehicleRow[], solarSites: SolarRow[]): ScheduleAsset {
  return enrichAsset({
    kind: "vehicle",
    id: v.id,
    name: [v.make, v.model].filter(Boolean).join(" ") || "Vehicle",
    subtitle: v.registrationNumber ?? "",
    location: null,
  }, vehicles, solarSites);
}

function solarAsset(s: SolarRow, vehicles: VehicleRow[], solarSites: SolarRow[]): ScheduleAsset {
  return enrichAsset({
    kind: "solar",
    id: s.id,
    name: "Solar Site",
    subtitle: s.panelCount ? `${s.panelCount} panels` : "",
    location: null,
  }, vehicles, solarSites);
}

function assetFromPlanRaw(
  raw: RawSubscription,
  vehicles: VehicleRow[],
  solarSites: SolarRow[],
): ScheduleAsset | null {
  if (raw.vehicleId) {
    const v = vehicles.find(row => row.id === raw.vehicleId);
    return v ? vehicleAsset(v, vehicles, solarSites) : null;
  }
  if (raw.solarSiteId) {
    const s = solarSites.find(row => row.id === raw.solarSiteId);
    return s ? solarAsset(s, vehicles, solarSites) : null;
  }
  return null;
}

export function resolveAssetFromEntry(input: {
  params: ScheduleEntryParams;
  vehicles: VehicleRow[];
  solarSites: SolarRow[];
  subscriptions: RawSubscription[];
  singleAssetHint?: { assetId: number; kind: "vehicle" | "solar" } | null;
}): ScheduleAsset | null {
  const { params, vehicles, solarSites, subscriptions, singleAssetHint } = input;
  const total = countAssets(vehicles, solarSites);

  if (params.vehicleId) {
    const v = vehicles.find(row => row.id === params.vehicleId);
    if (v) return vehicleAsset(v, vehicles, solarSites);
  }
  if (params.solarSiteId) {
    const s = solarSites.find(row => row.id === params.solarSiteId);
    if (s) return solarAsset(s, vehicles, solarSites);
  }

  if (params.planId) {
    const raw = subscriptions.find(s => s.id === params.planId);
    if (raw) {
      const fromPlan = assetFromPlanRaw(raw, vehicles, solarSites);
      if (fromPlan) return fromPlan;
    }
  }

  if (total === 1) {
    if (vehicles.length === 1) return vehicleAsset(vehicles[0], vehicles, solarSites);
    if (solarSites.length === 1) return solarAsset(solarSites[0], vehicles, solarSites);
  }

  if (singleAssetHint) {
    if (singleAssetHint.kind === "vehicle") {
      const v = vehicles.find(row => row.id === singleAssetHint.assetId);
      if (v) return vehicleAsset(v, vehicles, solarSites);
    } else {
      const s = solarSites.find(row => row.id === singleAssetHint.assetId);
      if (s) return solarAsset(s, vehicles, solarSites);
    }
  }

  return null;
}

export function resolvePlanFromEntry(input: {
  params: ScheduleEntryParams;
  subscriptions: RawSubscription[];
}): { planMode: PlanMode | null; selectedPlan: CustomerPlan | null; redirectDailyCleaning: boolean } {
  if (input.params.mode === "one_time") {
    return { planMode: "one_time", selectedPlan: null, redirectDailyCleaning: false };
  }

  if (!input.params.planId) {
    return { planMode: null, selectedPlan: null, redirectDailyCleaning: false };
  }

  const plan = eligibleBookingPlans(input.subscriptions).find(p => p.id === input.params.planId);
  if (!plan) {
    return { planMode: null, selectedPlan: null, redirectDailyCleaning: false };
  }

  if (plan.isDailyCleaning) {
    return { planMode: null, selectedPlan: null, redirectDailyCleaning: true };
  }

  return { planMode: "plan", selectedPlan: plan, redirectDailyCleaning: false };
}

export function resolveBookingAddressForEntry(input: {
  asset: ScheduleAsset | null;
  selectedAddress?: SelectedAddress | null;
}): LocationValue | null {
  if (input.asset?.location) {
    return input.asset.location;
  }

  const stored = input.selectedAddress;
  if (!stored) return null;

  if (input.asset && stored.assetId != null && stored.assetType != null) {
    if (stored.assetId === input.asset.id && stored.assetType === input.asset.kind) {
      return stored;
    }
    return null;
  }

  return stored;
}

export function resolveScheduleEntryContext(input: {
  params: ScheduleEntryParams;
  vehicles: VehicleRow[];
  solarSites: SolarRow[];
  subscriptions: RawSubscription[];
  customerId?: number;
  singleAssetHint?: { assetId: number; kind: "vehicle" | "solar" } | null;
  selectedAddress?: SelectedAddress | null;
}): ScheduleEntryContext {
  const hint = input.singleAssetHint
    ?? (input.customerId != null ? loadSingleAssetHint(input.customerId) : null);
  const storedAddress = input.selectedAddress
    ?? (input.customerId != null ? loadSelectedAddress(input.customerId) : null);

  const planResolution = resolvePlanFromEntry({
    params: input.params,
    subscriptions: input.subscriptions,
  });

  let asset = resolveAssetFromEntry({
    params: input.params,
    vehicles: input.vehicles,
    solarSites: input.solarSites,
    subscriptions: input.subscriptions,
    singleAssetHint: hint,
  });

  const address = resolveBookingAddressForEntry({ asset, selectedAddress: storedAddress });

  const assetCount = countAssets(input.vehicles, input.solarSites);
  const initialStep = resolveActiveStep({
    assetCount,
    asset,
    eligiblePlanCount: 0,
    planMode: planResolution.planMode,
    selectedPlan: planResolution.selectedPlan,
    serviceCount: 0,
    serviceSelected: false,
    dateSelected: false,
    timeSelected: false,
  });

  return {
    params: input.params,
    asset,
    planMode: planResolution.planMode,
    selectedPlan: planResolution.selectedPlan,
    address,
    redirectDailyCleaning: planResolution.redirectDailyCleaning,
    initialStep,
  };
}

export function planEligibleForSchedule(plan: CustomerPlan): boolean {
  return plan.status === "ACTIVE" && (plan.totalAllocated === 0 || plan.totalRemaining > 0);
}
