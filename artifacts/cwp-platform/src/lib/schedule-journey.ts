import type { CustomerPlan, RawSubscription } from "@/lib/customer-plans";
import { eligibleBookingPlans } from "@/lib/customer-plans";
import type { LocationValue } from "@/features/master-data/api";
import type { CatalogService } from "@/features/master-data/api";
import type { CoverageServiceSummary } from "@/lib/coverage-client";

export type ScheduleStep = "asset" | "plan" | "service" | "date" | "time" | "review";

export type AssetKind = "vehicle" | "solar";

export type ScheduleAsset = {
  kind: AssetKind;
  id: number;
  name: string;
  subtitle: string;
  location: LocationValue | null;
};

export type PlanMode = "plan" | "one_time";

const STEP_ORDER: ScheduleStep[] = ["asset", "plan", "service", "date", "time", "review"];

export function plansForAsset(
  subs: RawSubscription[],
  asset: ScheduleAsset | null,
): CustomerPlan[] {
  if (!asset) return [];
  const eligible = eligibleBookingPlans(subs);
  return eligible.filter(plan => {
    const raw = subs.find(s => s.id === plan.id);
    if (!raw) return false;
    if (asset.kind === "vehicle") return raw.vehicleId === asset.id;
    return raw.solarSiteId === asset.id;
  });
}

export function countAssets(vehicles: unknown[], solarSites: unknown[]): number {
  return vehicles.length + solarSites.length;
}

export function shouldSkipStep(
  step: ScheduleStep,
  input: {
    assetCount: number;
    asset: ScheduleAsset | null;
    eligiblePlanCount: number;
    planMode: PlanMode | null;
    selectedPlan: CustomerPlan | null;
    serviceCount: number;
    serviceSelected: boolean;
    dateSelected: boolean;
    timeSelected: boolean;
  },
): boolean {
  switch (step) {
    case "asset":
      return input.assetCount === 1 || input.asset != null;
    case "plan":
      if (input.planMode != null) return true;
      if (input.eligiblePlanCount === 0) return true;
      if (input.eligiblePlanCount === 1) return true;
      return false;
    case "service":
      return input.serviceSelected && input.serviceCount <= 1;
    case "date":
      return input.dateSelected;
    case "time":
      return input.timeSelected;
    case "review":
      return false;
    default:
      return false;
  }
}

export function resolveActiveStep(
  input: Parameters<typeof shouldSkipStep>[1],
): ScheduleStep {
  for (const step of STEP_ORDER) {
    if (!shouldSkipStep(step, input)) return step;
  }
  return "review";
}

export function nextStep(current: ScheduleStep): ScheduleStep | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx < STEP_ORDER.length - 1 ? STEP_ORDER[idx + 1] : null;
}

export function prevStep(current: ScheduleStep): ScheduleStep | null {
  const idx = STEP_ORDER.indexOf(current);
  return idx > 0 ? STEP_ORDER[idx - 1] : null;
}

export function filterServicesForCoverage(
  catalog: CatalogService[],
  coverageServices: CoverageServiceSummary[] | undefined,
  assetKind: AssetKind,
): CatalogService[] {
  let filtered = catalog;
  if (assetKind === "solar") {
    filtered = catalog.filter(s =>
      s.category === "solar_cleaning"
      || (s.categorySlug ?? "").includes("solar"),
    );
  } else {
    filtered = catalog.filter(s =>
      s.category !== "solar_cleaning"
      && !(s.categorySlug ?? "").includes("solar"),
    );
  }
  if (!coverageServices?.length) return filtered;
  const ids = new Set(coverageServices.map(s => s.id));
  return filtered.filter(s => ids.has(s.id));
}

export function inferPlanMode(eligiblePlanCount: number): PlanMode {
  return eligiblePlanCount > 0 ? "plan" : "one_time";
}

export function stepTitle(step: ScheduleStep, assetKind?: AssetKind): string {
  const map: Record<ScheduleStep, string> = {
    asset: "Which vehicle or solar site?",
    plan: "Use your plan or schedule a one-time visit?",
    service: "Which service do you need?",
    date: "When should we come?",
    time: "What time works best?",
    review: "Review your request",
  };
  if (step === "asset" && assetKind === "vehicle") return "Which vehicle?";
  if (step === "asset" && assetKind === "solar") return "Which solar site?";
  return map[step];
}

export const SCHEDULE_ERROR_COPY = {
  no_asset: {
    title: "Add a vehicle or solar site first",
    description: "CWP needs to know what we're servicing before we can schedule a visit.",
    cta: "Go to Assets",
  },
  no_coverage: {
    title: "We don't serve this address yet",
    description: "Try a different service address or contact CWP for help.",
    cta: "Change address",
  },
  no_services: {
    title: "No services available here",
    description: "None of our services are available at this address right now.",
    cta: "Change address",
  },
  no_slots: {
    title: "No time slots left today",
    description: "Pick another date or choose an earlier day.",
    cta: "Pick another date",
  },
  offline: {
    title: "You're offline",
    description: "Check your connection and try again.",
    cta: "Retry",
  },
} as const;
