export type WalkInServiceKind = "car_wash" | "solar_clean" | "daily_clean" | "daily_wash";

export type WalkInQuotaOption = {
  source: "entitlement" | "dcms" | "legacy_subscription" | "none";
  label: string;
  entitlementId?: number;
  subscriptionId?: number;
  legacySubscriptionId?: number;
  vehicleId?: number;
  solarSiteId?: number;
  remaining: number;
  visitType?: "cleaning" | "wash";
};

async function walkInFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function searchWalkIn(q: string) {
  return walkInFetch<{
    customers: { id: number; name: string; phone: string; label: string }[];
    vehicles: { id: number; customerId: number; registrationNumber: string; label: string }[];
  }>(`/staff/walk-in/search?q=${encodeURIComponent(q)}`);
}

export async function fetchWalkInCustomer(customerId: number) {
  return walkInFetch<{
    customer: { id: number; name: string; phone: string; city: string | null };
    activeEntitlements: Array<{ id: number; entitlementType: string; serviceName: string | null; remainingCredits: number }>;
    dailyCleaning: Array<{ id: number; vehicleId: number; vehicleLabel: string; remainingCleanings: number; remainingWashes: number }>;
    legacySubscriptions: Array<{ id: number; type: string; servicesRemaining: number | null; vehicleId: number | null }>;
  }>(`/staff/walk-in/customer/${customerId}`);
}

export async function fetchWalkInQuota(customerId: number, serviceKind: WalkInServiceKind, vehicleId?: number) {
  const qs = new URLSearchParams({ serviceKind });
  if (vehicleId) qs.set("vehicleId", String(vehicleId));
  return walkInFetch<{ options: WalkInQuotaOption[] }>(`/staff/walk-in/customer/${customerId}/quota?${qs}`);
}

export type ResolveWalkInResult =
  | { mode: "dcms"; subscriptionId: number; vehicleId: number; visitType: "cleaning" | "wash"; quotaRemaining: number; message?: string }
  | { mode: "booking"; bookingId: number; status: string; createdDraft: boolean; consumedFrom: string; message: string };

export async function resolveWalkIn(body: {
  customerId: number;
  serviceKind: WalkInServiceKind;
  vehicleId?: number;
  subscriptionId?: number;
  entitlementId?: number;
  legacySubscriptionId?: number;
  latitude?: number;
  longitude?: number;
}) {
  return walkInFetch<ResolveWalkInResult>("/staff/walk-in/resolve", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
