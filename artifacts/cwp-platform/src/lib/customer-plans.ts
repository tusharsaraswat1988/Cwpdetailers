/**
 * Customer-facing plan view models.
 * Maps backend subscription/contract APIs to "My Plans" terminology.
 * Backend endpoints remain unchanged — display mapping only.
 */

export type PlanStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "PAUSED"
  | "COMPLETED"
  | "PENDING_ACTIVATION"
  | "RENEWAL_DUE";

export type PlanServiceLine = {
  label: string;
  used: number;
  total: number;
  remaining: number;
};

export type CustomerPlan = {
  id: number;
  name: string;
  type: string;
  status: PlanStatus;
  displayStatus: string;
  serviceLines: PlanServiceLine[];
  totalRemaining: number;
  totalAllocated: number;
  totalUsed: number;
  expiryDate: string | null;
  nextVisitDate: string | null;
  vehicleOrSite: string | null;
  dueAmount: number;
  source?: "subscription" | "dcms";
  detailHref: string;
  canRenew: boolean;
  isDailyCleaning: boolean;
};

export type RawSubscription = {
  id: number;
  type?: string | null;
  status?: string | null;
  serviceName?: string | null;
  endDate?: string | null;
  nextServiceDate?: string | null;
  nextDueDate?: string | null;
  totalServices?: number | null;
  servicesRemaining?: number | null;
  servicesUsed?: number | null;
  dueAmount?: string | number | null;
  vehicleName?: string | null;
  vehicleId?: number | null;
  solarSiteId?: number | null;
  source?: "subscription" | "dcms";
};

const PLAN_TYPE_LABELS: Record<string, string> = {
  daily_cleaning: "Daily Car Cleaning",
  monthly_wash: "Monthly Wash",
  solar_amc: "Solar AMC",
  detailing_plan: "Detailing Plan",
};

export function planTypeLabel(type?: string | null): string {
  if (!type) return "Service Plan";
  return PLAN_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function mapSubscriptionStatus(status?: string | null): PlanStatus {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "paused":
      return "PAUSED";
    case "expired":
      return "EXPIRED";
    case "expiring":
      return "RENEWAL_DUE";
    case "cancelled":
    case "completed":
      return "COMPLETED";
    case "pending":
      return "PENDING_ACTIVATION";
    default:
      return "ACTIVE";
  }
}

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  ACTIVE: "Active",
  EXPIRED: "Expired",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  PENDING_ACTIVATION: "Pending Activation",
  RENEWAL_DUE: "Renewal Due",
};

function visitsUsed(sub: RawSubscription): number {
  if (sub.totalServices != null && sub.servicesRemaining != null) {
    return sub.totalServices - sub.servicesRemaining;
  }
  return sub.servicesUsed ?? 0;
}

function formatExpiry(date?: string | null): string | null {
  if (!date) return null;
  const d = new Date(date + (date.includes("T") ? "" : "T00:00:00"));
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function subscriptionToPlan(sub: RawSubscription): CustomerPlan {
  const type = sub.type ?? "plan";
  const isDailyCleaning = type === "daily_cleaning";
  const used = visitsUsed(sub);
  const total = sub.totalServices ?? 0;
  const remaining = sub.servicesRemaining ?? (total > 0 ? total - used : 0);
  const status = mapSubscriptionStatus(sub.status);
  const name = sub.serviceName ?? planTypeLabel(type);

  const serviceLines: PlanServiceLine[] = [];
  if (total > 0) {
    serviceLines.push({
      label: isDailyCleaning ? "Included Services" : "Visits",
      used,
      total,
      remaining,
    });
  }

  const detailHref = isDailyCleaning
    ? "/customer/daily-cleaning"
    : `/customer/plans/${sub.id}`;

  return {
    id: sub.id,
    name,
    type,
    status,
    displayStatus: PLAN_STATUS_LABELS[status],
    serviceLines,
    totalRemaining: remaining,
    totalAllocated: total,
    totalUsed: used,
    expiryDate: formatExpiry(sub.endDate),
    nextVisitDate: sub.nextServiceDate ?? sub.nextDueDate ?? null,
    vehicleOrSite: sub.vehicleName ?? null,
    dueAmount: Number(sub.dueAmount ?? 0),
    source: sub.source,
    detailHref,
    canRenew: status === "RENEWAL_DUE" || status === "EXPIRED" || status === "PAUSED",
    isDailyCleaning,
  };
}

export function subscriptionsToPlans(subs: RawSubscription[]): CustomerPlan[] {
  return subs.map(subscriptionToPlan);
}

export function activePlans(subs: RawSubscription[]): CustomerPlan[] {
  return subscriptionsToPlans(subs.filter(s => s.status === "active" || s.status === "paused" || s.status === "expiring"));
}

export function eligibleBookingPlans(subs: RawSubscription[]): CustomerPlan[] {
  return activePlans(subs).filter(p =>
    p.status === "ACTIVE" && (p.totalAllocated === 0 || p.totalRemaining > 0),
  );
}

export function totalRemainingVisits(plans: CustomerPlan[]): number {
  return plans.reduce((sum, p) => sum + p.totalRemaining, 0);
}

/** API field → customer UI label (backend unchanged). */
export const API_TERMINOLOGY_MAP = {
  walletBalance: "remainingEntitlements (legacy ₹ field — not shown to customers)",
  "GET /api/customers/:id/wallet": "Not used in customer My Plans UI",
  "GET /api/customers/:id/wallet/transactions": "Usage history sourced from bookings/subscriptions instead",
  "GET /api/subscriptions?customerId=": "My Plans list",
  "POST /api/customers/:id/wallet/credit": "Renew Plan (admin-only; customer contacts support)",
  wallet_transaction_type_credit: "Service added",
  wallet_transaction_type_debit: "Service used",
} as const;
