export type WalkInServiceKind = "car_wash" | "solar_clean" | "daily_clean" | "daily_wash";

export type WalkInEntitlementStatus = "active" | "exhausted" | "expired" | "not_active" | "inactive";

export type WalkInIncludedService = {
  key: string;
  serviceKind: WalkInServiceKind;
  displayName: string;
  remaining: number;
  total: number | null;
  status: WalkInEntitlementStatus;
  recommended: boolean;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  visitType?: "cleaning" | "wash";
  solarSiteId?: number;
};

export type WalkInPackageCard = {
  key: string;
  packageName: string;
  packagePrice: string | null;
  expiresAt: string | null;
  status: WalkInEntitlementStatus;
  source: "entitlement" | "dcms" | "legacy_subscription" | null;
  vehicleId?: number;
  vehicleLabel?: string;
  packageId?: number;
  includedServices: WalkInIncludedService[];
};

export type WalkInCustomerContext = {
  customer: {
    id: number;
    name: string;
    phone: string;
    city: string | null;
    status: string;
    branchId: number | null;
    branchName: string | null;
  };
  vehicle: {
    id: number;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    label: string;
  } | null;
  vehicles: Array<{
    id: number;
    registrationNumber: string;
    make: string | null;
    model: string | null;
    label: string;
  }>;
  membershipStatus: "active" | "inactive" | "suspended" | "none";
  packages: WalkInPackageCard[];
  eligibleToday: WalkInIncludedService[];
  hasActivePackage: boolean;
};

export type WalkInDcmsStop = {
  subscriptionId: number;
  customerName: string;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  planName: string;
  remainingCleanings: number;
  remainingWashes: number;
  todayStatus: "pending" | "completed" | "rejected";
  visitType: "cleaning" | "wash";
};

function formatWalkInError(err: { error?: string; resource?: string; action?: string }, status: number): string {
  if (err.error === "Permission denied") {
    if (err.resource === "bookings" && err.action === "edit") {
      return "You do not have permission to create or update bookings. Contact your supervisor.";
    }
    if (err.resource === "staff" && err.action === "view") {
      return "You do not have permission to access staff walk-in entry. Contact your supervisor.";
    }
    const detail = err.resource && err.action
      ? `You do not have permission to ${err.action} ${err.resource.replace(/_/g, " ")}.`
      : "You do not have permission to perform this walk-in action. Contact your supervisor.";
    return detail;
  }
  if (err.error) return err.error;
  return status === 403
    ? "Access denied — contact your supervisor"
    : "Request failed";
}

async function walkInFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as {
      error?: string;
      resource?: string;
      action?: string;
    };
    throw new Error(formatWalkInError(err, res.status));
  }
  return res.json() as Promise<T>;
}

export async function searchWalkIn(q: string) {
  return walkInFetch<{
    customers: { id: number; name: string; phone: string; label: string }[];
    vehicles: { id: number; customerId: number; registrationNumber: string; label: string }[];
  }>(`/staff/walk-in/search?q=${encodeURIComponent(q)}`);
}

export async function fetchWalkInCustomer(customerId: number, vehicleId?: number) {
  const qs = vehicleId ? `?vehicleId=${vehicleId}` : "";
  return walkInFetch<WalkInCustomerContext>(`/staff/walk-in/customer/${customerId}${qs}`);
}

export async function fetchWalkInDcmsStop(subscriptionId: number, visitType: "cleaning" | "wash") {
  return walkInFetch<WalkInDcmsStop>(
    `/staff/walk-in/dcms-stop/${subscriptionId}?visitType=${visitType}`,
  );
}

export type ResolveWalkInResult =
  | { mode: "dcms"; subscriptionId: number; vehicleId: number; visitType: "cleaning" | "wash"; quotaRemaining: number; message?: string }
  | { mode: "booking"; bookingId: number; status: string; createdDraft: boolean; consumedFrom: string; message: string };

export async function resolveWalkIn(body: {
  customerId: number;
  serviceKind: WalkInServiceKind;
  vehicleId?: number;
  solarSiteId?: number;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  forceDraft?: boolean;
}) {
  return walkInFetch<ResolveWalkInResult>("/staff/walk-in/resolve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
