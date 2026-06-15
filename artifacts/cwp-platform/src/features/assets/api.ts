export type AssetType = "vehicle" | "solar_site";
export type AssetStatus = "active" | "inactive" | "retired";
export type CustomerAssetLinkType = "operational" | "commercial" | "historical";

export type AssetListRow = {
  id: number;
  assetType: AssetType;
  vehicleId: number | null;
  solarSiteId: number | null;
  label: string;
  notes: string | null;
  status: AssetStatus;
  serviceLocationId?: number | null;
  serviceLocationLabel?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AssetDetail = AssetListRow & {
  vehicle?: Record<string, unknown> | null;
  solarSite?: Record<string, unknown> | null;
  locationLinks: Array<{
    id: number;
    serviceLocationId: number;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    locationLabel: string;
    locationAddress: string | null;
  }>;
  customerLinks: Array<{
    id: number;
    customerId: number;
    linkType: CustomerAssetLinkType;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
    customerName: string;
    customerPhone: string;
  }>;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? "Request failed");
  return body as T;
}

export async function listAssets(params?: {
  customerId?: number;
  assetType?: AssetType;
  serviceLocationId?: number;
  limit?: number;
  offset?: number;
}) {
  const url = new URL("/api/assets", window.location.origin);
  if (params?.customerId) url.searchParams.set("customerId", String(params.customerId));
  if (params?.assetType) url.searchParams.set("assetType", params.assetType);
  if (params?.serviceLocationId) url.searchParams.set("serviceLocationId", String(params.serviceLocationId));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));
  const res = await fetch(url, { credentials: "include" });
  return parseJson<{ data: AssetListRow[]; total: number }>(res);
}

export async function getAsset(id: number) {
  const res = await fetch(`/api/assets/${id}`, { credentials: "include" });
  return parseJson<AssetDetail>(res);
}

export async function createAsset(body: Record<string, unknown>) {
  const res = await fetch("/api/assets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ asset: AssetListRow; vehicle?: Record<string, unknown>; solarSite?: Record<string, unknown> }>(res);
}

export async function updateAsset(id: number, body: Record<string, unknown>) {
  const res = await fetch(`/api/assets/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<AssetDetail>(res);
}

export async function transferAssetCustomer(id: number, body: {
  customerId: number;
  linkType?: CustomerAssetLinkType;
  effectiveFrom?: string;
}) {
  const res = await fetch(`/api/assets/${id}/customer-links`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ data: AssetDetail["customerLinks"] }>(res);
}

export async function transferAssetLocation(id: number, body: {
  customerId: number;
  serviceLocationId: number;
  effectiveFrom?: string;
}) {
  const res = await fetch(`/api/assets/${id}/location-links`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<{ data: AssetDetail["locationLinks"] }>(res);
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  vehicle: "Vehicle",
  solar_site: "Solar Site",
};
