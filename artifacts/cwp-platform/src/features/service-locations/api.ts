export type ServiceLocationType = "office" | "factory" | "residence" | "parking" | "other";
export type ServiceLocationStatus = "active" | "inactive";

export type ServiceLocation = {
  id: number;
  label: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  locationType: ServiceLocationType;
  status: ServiceLocationStatus;
  isAutoCreated: boolean;
  companyId: number | null;
  franchiseeId: number | null;
  branchId: number | null;
  createdAt: string;
  updatedAt: string;
  linkedCustomerCount?: number;
  primaryCustomerName?: string | null;
};

export type CustomerLocationLink = {
  id: number;
  customerId: number;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  customerName?: string;
  customerPhone?: string;
};

export type ServiceLocationWithLinks = ServiceLocation & {
  customerLinks: CustomerLocationLink[];
};

export type CustomerServiceLocationRow = ServiceLocation & {
  linkId: number;
  isDefault: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
};

type ListResponse<T> = {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  customerId?: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return body as T;
}

export async function listServiceLocations(params?: {
  search?: string;
  customerId?: number;
  status?: ServiceLocationStatus;
  limit?: number;
  offset?: number;
}) {
  const url = new URL("/api/service-locations", window.location.origin);
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.customerId) url.searchParams.set("customerId", String(params.customerId));
  if (params?.status) url.searchParams.set("status", params.status);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url, { credentials: "include" });
  return parseJson<ListResponse<CustomerServiceLocationRow | ServiceLocation>>(res);
}

export async function getServiceLocation(id: number) {
  const res = await fetch(`/api/service-locations/${id}`, { credentials: "include" });
  return parseJson<ServiceLocationWithLinks>(res);
}

export async function createServiceLocation(body: {
  label: string;
  address?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  locationType?: ServiceLocationType;
  status?: ServiceLocationStatus;
  customerId?: number;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
}) {
  const res = await fetch("/api/service-locations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<ServiceLocation>(res);
}

export async function updateServiceLocation(id: number, body: Partial<{
  label: string;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  locationType: ServiceLocationType;
  status: ServiceLocationStatus;
}>) {
  const res = await fetch(`/api/service-locations/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<ServiceLocation>(res);
}

export async function listLocationCustomerLinks(locationId: number) {
  const res = await fetch(`/api/service-locations/${locationId}/customer-links`, { credentials: "include" });
  const body = await parseJson<{ data: CustomerLocationLink[] }>(res);
  return body.data;
}

export async function linkCustomerToLocation(locationId: number, body: {
  customerId: number;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveUntil?: string;
}) {
  const res = await fetch(`/api/service-locations/${locationId}/customer-links`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<CustomerLocationLink>(res);
}

export async function unlinkCustomerFromLocation(locationId: number, customerId: number) {
  const res = await fetch(`/api/service-locations/${locationId}/customer-links?customerId=${customerId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "Unlink failed");
  }
}

export const SERVICE_LOCATION_TYPE_LABELS: Record<ServiceLocationType, string> = {
  office: "Office",
  factory: "Factory",
  residence: "Residence",
  parking: "Parking",
  other: "Other",
};
