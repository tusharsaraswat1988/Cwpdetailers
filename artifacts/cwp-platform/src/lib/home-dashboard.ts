import type { Booking } from "@workspace/api-client-react";
import { CUSTOMER_ROUTES } from "@/lib/customer-routes";
import {
  type CustomerPlan,
  type RawSubscription,
  activePlans,
} from "@/lib/customer-plans";
import { selectedToHomeAddress, resolveDefaultAddress, type SelectedAddress } from "@/lib/selected-address";

export type HomeHeroKind =
  | "in_progress"
  | "en_route"
  | "scheduled_today"
  | "feedback_due"
  | "renewal_due"
  | "clear";

export type HomeAdaptiveCta = {
  label: string;
  href: string;
  testId: string;
};

export type HomeActionItem = {
  label: string;
  href: string;
  testId: string;
};

export type HomeCurrentAddress = {
  line: string;
  assetLabel?: string;
  href: string;
  complete: boolean;
};

export type HomeOperationalHero = {
  kind: HomeHeroKind;
  eyebrow: string;
  title: string;
  subtitle?: string;
  status: string;
  pulse?: boolean;
};

export type HomeDashboardModel = {
  currentAddress: HomeCurrentAddress;
  hero: HomeOperationalHero;
  cta: HomeAdaptiveCta;
  primaryPlan: CustomerPlan | null;
  actionQueue: HomeActionItem[];
};

type VehicleLike = {
  id: number;
  registrationNumber?: string;
  make?: string;
  model?: string;
  serviceAddress?: string | null;
  address?: string | null;
};

type SolarLike = {
  id: number;
  address?: string;
};

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T00:00:00`);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
  );
}

function formatServiceName(booking: Booking): string {
  return (booking.serviceName ?? booking.serviceType ?? "Service").replace(/_/g, " ");
}

function assetLabelFromBooking(booking: Booking): string | undefined {
  return booking.vehicleInfo?.trim() || undefined;
}

/** Primary plan for Current Plan widget — most actionable active plan. */
export function pickPrimaryPlan(plans: CustomerPlan[]): CustomerPlan | null {
  if (plans.length === 0) return null;
  const renewal = plans.find(p => p.status === "RENEWAL_DUE" || p.status === "EXPIRED");
  if (renewal) return renewal;
  const active = plans.filter(p => p.status === "ACTIVE");
  if (active.length === 0) {
    return plans.find(p => p.status === "PAUSED") ?? plans[0] ?? null;
  }
  return [...active].sort((a, b) => b.totalRemaining - a.totalRemaining)[0] ?? null;
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

function buildHero(
  upcoming: Booking | undefined,
  hasPendingFeedback: boolean,
  primaryPlan: CustomerPlan | null,
): HomeOperationalHero {
  if (hasPendingFeedback) {
    return {
      kind: "feedback_due",
      eyebrow: "Feedback",
      title: "Feedback pending",
      subtitle: "How was your last visit?",
      status: "feedback due",
      pulse: false,
    };
  }

  if (upcoming?.status === "in_progress") {
    return {
      kind: "in_progress",
      eyebrow: "Happening now",
      title: formatServiceName(upcoming),
      subtitle: [upcoming.scheduledTime, assetLabelFromBooking(upcoming)].filter(Boolean).join(" · "),
      status: "in progress",
      pulse: true,
    };
  }

  if (upcoming?.status === "en_route") {
    return {
      kind: "en_route",
      eyebrow: "On the way",
      title: "Technician on the way",
      subtitle: [formatServiceName(upcoming), upcoming.staffName].filter(Boolean).join(" · "),
      status: "en route",
      pulse: true,
    };
  }

  if (upcoming && isToday(upcoming.scheduledDate)) {
    return {
      kind: "scheduled_today",
      eyebrow: "Today",
      title: "Today's scheduled service",
      subtitle: [formatServiceName(upcoming), upcoming.scheduledTime, assetLabelFromBooking(upcoming)].filter(Boolean).join(" · "),
      status: upcoming.status === "pending" ? "pending" : "scheduled",
      pulse: false,
    };
  }

  if (primaryPlan && (primaryPlan.status === "RENEWAL_DUE" || primaryPlan.status === "EXPIRED")) {
    return {
      kind: "renewal_due",
      eyebrow: "Plan",
      title: "Renewal due",
      subtitle: primaryPlan.name,
      status: "renewal due",
      pulse: false,
    };
  }

  return {
    kind: "clear",
    eyebrow: "Today",
    title: "No service today",
    status: "clear",
    pulse: false,
  };
}

function buildAdaptiveCta(input: {
  upcoming?: Booking;
  hasPendingFeedback: boolean;
  pendingDues: number;
  plans: CustomerPlan[];
  primaryPlan: CustomerPlan | null;
  vehicleCount: number;
  solarCount: number;
}): HomeAdaptiveCta {
  const { upcoming, hasPendingFeedback, pendingDues, plans, primaryPlan, vehicleCount, solarCount } = input;
  const hasAssets = vehicleCount > 0 || solarCount > 0;
  const pausedPlan = plans.find(p => p.status === "PAUSED");
  const creditPlan = plans.find(p =>
    p.status === "ACTIVE" && !p.isDailyCleaning && (p.totalAllocated === 0 || p.totalRemaining > 0),
  );

  if (hasPendingFeedback) {
    const href = primaryPlan?.isDailyCleaning
      ? primaryPlan.detailHref
      : CUSTOMER_ROUTES.serviceHistory;
    return { label: "Rate Your Visit", href, testId: "home-cta-feedback" };
  }

  if (upcoming && (upcoming.status === "in_progress" || upcoming.status === "en_route")) {
    return {
      label: "Track Today's Service",
      href: CUSTOMER_ROUTES.scheduledServiceDetail(upcoming.id),
      testId: "home-cta-track",
    };
  }

  if (upcoming && isToday(upcoming.scheduledDate)) {
    return {
      label: "View Today's Service",
      href: CUSTOMER_ROUTES.scheduledServiceDetail(upcoming.id),
      testId: "home-cta-today",
    };
  }

  if (upcoming) {
    return {
      label: "View Scheduled Service",
      href: CUSTOMER_ROUTES.scheduledServiceDetail(upcoming.id),
      testId: "home-cta-upcoming",
    };
  }

  if (pendingDues > 0) {
    return {
      label: "View Your Bill",
      href: CUSTOMER_ROUTES.invoices,
      testId: "home-cta-invoice",
    };
  }

  if (plans.some(p => p.status === "RENEWAL_DUE" || p.status === "EXPIRED")) {
    return {
      label: "Renew Plan",
      href: primaryPlan ? primaryPlan.detailHref : CUSTOMER_ROUTES.plans,
      testId: "home-cta-renew",
    };
  }

  if (pausedPlan) {
    return {
      label: "Contact CWP to Resume",
      href: CUSTOMER_ROUTES.plans,
      testId: "home-cta-paused",
    };
  }

  if (creditPlan) {
    return {
      label: "Schedule Next Visit",
      href: CUSTOMER_ROUTES.scheduleEntry({ planId: creditPlan.id, from: "home" }),
      testId: "home-cta-schedule-plan",
    };
  }

  if (primaryPlan?.isDailyCleaning && primaryPlan.status === "ACTIVE") {
    return {
      label: "View Daily Cleaning Plan",
      href: primaryPlan.detailHref,
      testId: "home-cta-dcms",
    };
  }

  if (hasAssets && plans.length === 0) {
    return {
      label: "Purchase Plan",
      href: CUSTOMER_ROUTES.plans,
      testId: "home-cta-get-plan",
    };
  }

  if (!hasAssets) {
    return {
      label: "Add Your Vehicle",
      href: CUSTOMER_ROUTES.assets,
      testId: "home-cta-add-asset",
    };
  }

  return {
    label: "Schedule a Service",
    href: CUSTOMER_ROUTES.scheduleEntry({ from: "home" }),
    testId: "home-cta-schedule",
  };
}

function buildActionQueue(
  cta: HomeAdaptiveCta,
  pendingDues: number,
  plans: CustomerPlan[],
): HomeActionItem[] {
  const items: HomeActionItem[] = [];

  if (pendingDues > 0 && !cta.href.includes("/invoices")) {
    items.push({
      label: `₹${pendingDues.toLocaleString("en-IN")} outstanding`,
      href: CUSTOMER_ROUTES.invoices,
      testId: "home-action-dues",
    });
  }

  if (plans.some(p => p.status === "RENEWAL_DUE") && cta.testId !== "home-cta-renew") {
    items.push({
      label: "Plan renewal due",
      href: CUSTOMER_ROUTES.plans,
      testId: "home-action-renewal",
    });
  }

  return items.slice(0, 2);
}

export function buildHomeDashboard(input: {
  recentBookings?: Booking[];
  pendingDues?: number;
  subscriptions: RawSubscription[];
  hasPendingFeedback: boolean;
  vehicles: VehicleLike[];
  solarSites: SolarLike[];
  selectedAddress?: SelectedAddress | null;
}): HomeDashboardModel {
  const plans = activePlans(input.subscriptions);
  const primaryPlan = pickPrimaryPlan(plans);
  const upcoming = findUpcomingBooking(input.recentBookings);
  const pendingDues = Number(input.pendingDues ?? 0);
  const hasAssets = input.vehicles.length > 0 || input.solarSites.length > 0;
  const effectiveAddress = input.selectedAddress ?? resolveDefaultAddress({
    recentBookings: input.recentBookings,
    vehicles: input.vehicles,
    solarSites: input.solarSites,
  });

  const addressView = selectedToHomeAddress(effectiveAddress, hasAssets);
  const currentAddress: HomeCurrentAddress = {
    line: addressView.line,
    assetLabel: addressView.assetLabel,
    href: CUSTOMER_ROUTES.assets,
    complete: addressView.complete,
  };
  const hero = buildHero(upcoming, input.hasPendingFeedback, primaryPlan);
  const cta = buildAdaptiveCta({
    upcoming,
    hasPendingFeedback: input.hasPendingFeedback,
    pendingDues,
    plans,
    primaryPlan,
    vehicleCount: input.vehicles.length,
    solarCount: input.solarSites.length,
  });
  const actionQueue = buildActionQueue(cta, pendingDues, plans);

  return { currentAddress, hero, cta, primaryPlan, actionQueue };
}
