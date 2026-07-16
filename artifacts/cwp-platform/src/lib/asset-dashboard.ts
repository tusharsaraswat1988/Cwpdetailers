import type { Booking } from "@workspace/api-client-react";
import {
  type CustomerPlan,
  type RawSubscription,
  activePlans,
  subscriptionToPlan,
} from "@/lib/customer-plans";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import { planEligibleForSchedule } from "@/lib/schedule-entry";

export type AssetHealthStatus = "protected" | "due_soon" | "no_plan";

export type AssetCardModel = {
  id: number;
  kind: "vehicle" | "solar";
  name: string;
  subtitle: string;
  imageUrl: string | null;
  healthStatus: AssetHealthStatus;
  healthLabel: string;
  serviceAddress: string;
  addressComplete: boolean;
  plan: CustomerPlan | null;
  planLabel: string;
  planHref: string;
  lastServiceLabel: string | null;
  nextServiceLabel: string | null;
  scheduleHref: string;
  historyHref: string;
  editAssetId: number;
};

type VehicleLike = {
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
  locationComplete?: boolean;
  refPhotoFrontUrl?: string | null;
};

type SolarLike = {
  id: number;
  address?: string;
  panelCount?: number;
  lastCleanedDate?: string | null;
  nextServiceDate?: string | null;
  serviceLat?: number | null;
  serviceLng?: number | null;
};

const UPCOMING_STATUSES = new Set([
  "pending", "scheduled", "confirmed", "en_route", "in_progress", "rescheduled",
]);

function parseDate(dateStr: string): Date {
  return new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
}

function isToday(dateStr: string): boolean {
  const d = parseDate(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function isTomorrow(dateStr: string): boolean {
  const d = parseDate(dateStr);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d.getFullYear() === tomorrow.getFullYear()
    && d.getMonth() === tomorrow.getMonth()
    && d.getDate() === tomorrow.getDate();
}

function formatDisplayDate(dateStr: string): string {
  const d = parseDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (isToday(dateStr)) return "Today";
  if (isTomorrow(dateStr)) return "Tomorrow";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long" });
}

export function formatRelativePast(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = parseDate(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 14) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function matchPlanToVehicle(
  plans: CustomerPlan[],
  subs: RawSubscription[],
  vehicleId: number,
  registration?: string,
): CustomerPlan | null {
  const sub = subs.find(s => s.vehicleId === vehicleId);
  if (sub) return subscriptionToPlan(sub);
  if (registration) {
    const byName = plans.find(p =>
      p.vehicleOrSite?.toLowerCase().includes(registration.toLowerCase()),
    );
    if (byName) return byName;
  }
  return null;
}

function matchPlanToSolar(plans: CustomerPlan[], subs: RawSubscription[], solarId: number): CustomerPlan | null {
  const sub = subs.find(s => s.solarSiteId === solarId);
  return sub ? subscriptionToPlan(sub) : null;
}

function healthFromPlan(plan: CustomerPlan | null): { status: AssetHealthStatus; label: string } {
  if (!plan) return { status: "no_plan", label: "No Active Plan" };
  if (plan.status === "RENEWAL_DUE" || plan.status === "EXPIRED") {
    return { status: "due_soon", label: "Service Due Soon" };
  }
  if (plan.status === "ACTIVE" || plan.status === "PENDING_ACTIVATION") {
    return {
      status: "protected",
      label: plan.type === "solar_amc" ? "AMC Active" : "Protected by Active Plan",
    };
  }
  return { status: "no_plan", label: "No Active Plan" };
}

function lastBookingForAsset(
  bookings: Booking[],
  assetId: number,
  kind: "vehicle" | "solar",
): Booking | undefined {
  return bookings
    .filter(b => b.status === "completed" && (kind === "vehicle" ? b.vehicleId === assetId : b.solarSiteId === assetId))
    .sort((a, b) => parseDate(b.scheduledDate).getTime() - parseDate(a.scheduledDate).getTime())[0];
}

function nextBookingForAsset(
  bookings: Booking[],
  assetId: number,
  kind: "vehicle" | "solar",
): Booking | undefined {
  return bookings
    .filter(b =>
      UPCOMING_STATUSES.has(b.status)
      && (kind === "vehicle" ? b.vehicleId === assetId : b.solarSiteId === assetId),
    )
    .sort((a, b) => parseDate(a.scheduledDate).getTime() - parseDate(b.scheduledDate).getTime())[0];
}

function buildVehicleCard(
  v: VehicleLike,
  plans: CustomerPlan[],
  subs: RawSubscription[],
  bookings: Booking[],
): AssetCardModel {
  const plan = matchPlanToVehicle(plans, subs, v.id, v.registrationNumber);
  const health = healthFromPlan(plan);
  const last = lastBookingForAsset(bookings, v.id, "vehicle");
  const next = nextBookingForAsset(bookings, v.id, "vehicle");
  const address = (v.serviceAddress ?? v.address ?? "").trim();
  const name = [v.make, v.model].filter(Boolean).join(" ") || "Vehicle";

  return {
    id: v.id,
    kind: "vehicle",
    name,
    subtitle: v.registrationNumber ?? "",
    imageUrl: v.refPhotoFrontUrl ?? null,
    healthStatus: health.status,
    healthLabel: health.label,
    serviceAddress: address || "Add service address",
    addressComplete: Boolean(v.locationComplete ?? (address && v.serviceLat != null)),
    plan,
    planLabel: plan?.name ?? "No Active Plan",
    planHref: plan ? plan.detailHref : CUSTOMER_ROUTES.plans,
    lastServiceLabel: last
      ? formatRelativePast(last.completedAt ?? last.scheduledDate)
      : null,
    nextServiceLabel: next
      ? formatDisplayDate(next.scheduledDate)
      : plan?.nextVisitDate
        ? formatDisplayDate(plan.nextVisitDate)
        : null,
    scheduleHref: CUSTOMER_ROUTES.scheduleEntry({
      vehicleId: v.id,
      planId: plan && planEligibleForSchedule(plan) ? plan.id : undefined,
      from: "assets",
    }),
    historyHref: CUSTOMER_ROUTES.serviceHistory,
    editAssetId: v.id,
  };
}

function buildSolarCard(
  s: SolarLike,
  plans: CustomerPlan[],
  subs: RawSubscription[],
  bookings: Booking[],
): AssetCardModel {
  const plan = matchPlanToSolar(plans, subs, s.id);
  const health = healthFromPlan(plan);
  const last = lastBookingForAsset(bookings, s.id, "solar");
  const next = nextBookingForAsset(bookings, s.id, "solar");
  const address = (s.address ?? "").trim();
  const panelCount = s.panelCount ?? 0;

  return {
    id: s.id,
    kind: "solar",
    name: "Solar Site",
    subtitle: panelCount > 0 ? `${panelCount} Panels` : "Solar site",
    imageUrl: null,
    healthStatus: health.status,
    healthLabel: health.label,
    serviceAddress: address || "Add service address",
    addressComplete: Boolean(address),
    plan,
    planLabel: plan?.name ?? "No Active Plan",
    planHref: plan ? plan.detailHref : CUSTOMER_ROUTES.plans,
    lastServiceLabel: last
      ? formatRelativePast(last.completedAt ?? last.scheduledDate)
      : formatRelativePast(s.lastCleanedDate),
    nextServiceLabel: next
      ? formatDisplayDate(next.scheduledDate)
      : s.nextServiceDate
        ? formatDisplayDate(s.nextServiceDate)
        : plan?.nextVisitDate
          ? formatDisplayDate(plan.nextVisitDate)
          : null,
    scheduleHref: CUSTOMER_ROUTES.scheduleEntry({
      solarSiteId: s.id,
      planId: plan && planEligibleForSchedule(plan) ? plan.id : undefined,
      from: "assets",
    }),
    historyHref: CUSTOMER_ROUTES.serviceHistory,
    editAssetId: s.id,
  };
}

export type AssetsDashboardModel = {
  vehicles: AssetCardModel[];
  solarSites: AssetCardModel[];
  totalCount: number;
  singleAssetId: number | null;
  singleAssetKind: "vehicle" | "solar" | null;
};

export function buildAssetsDashboard(input: {
  vehicles: VehicleLike[];
  solarSites: SolarLike[];
  subscriptions: RawSubscription[];
  bookings?: Booking[];
}): AssetsDashboardModel {
  const plans = activePlans(input.subscriptions);
  const bookings = input.bookings ?? [];
  const vehicles = input.vehicles.map(v => buildVehicleCard(v, plans, input.subscriptions, bookings));
  const solarSites = input.solarSites.map(s => buildSolarCard(s, plans, input.subscriptions, bookings));
  const totalCount = vehicles.length + solarSites.length;

  let singleAssetId: number | null = null;
  let singleAssetKind: "vehicle" | "solar" | null = null;
  if (totalCount === 1) {
    if (vehicles.length === 1) {
      singleAssetId = vehicles[0].id;
      singleAssetKind = "vehicle";
    } else {
      singleAssetId = solarSites[0].id;
      singleAssetKind = "solar";
    }
  }

  return { vehicles, solarSites, totalCount, singleAssetId, singleAssetKind };
}

/** Store single-asset hint for Schedule flow (localStorage, per customer). */
export function saveSingleAssetHint(
  customerId: number,
  assetId: number,
  kind: "vehicle" | "solar",
): void {
  localStorage.setItem(`cwp:single-asset:${customerId}`, JSON.stringify({ assetId, kind }));
}

export function loadSingleAssetHint(customerId: number): { assetId: number; kind: "vehicle" | "solar" } | null {
  try {
    const raw = localStorage.getItem(`cwp:single-asset:${customerId}`);
    if (!raw) return null;
    return JSON.parse(raw) as { assetId: number; kind: "vehicle" | "solar" };
  } catch {
    return null;
  }
}
