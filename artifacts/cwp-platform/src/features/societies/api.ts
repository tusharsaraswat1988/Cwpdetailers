import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type ResidentialSociety = {
  id: number;
  name: string;
  code: string;
  address: string;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gateSecurityNotes?: string | null;
  totalTowers: number;
  totalFlats: number;
  isActive: boolean;
  cityId: number;
  cityName?: string;
  serviceAreaId?: number | null;
  serviceAreaName?: string;
  createdAt: string;
  updatedAt: string;
};

export type SocietyTower = {
  id: number;
  societyId: number;
  name: string;
  code?: string | null;
  totalFloors?: number | null;
  totalFlats?: number | null;
  parkingLevels?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SocietyWithTowers = ResidentialSociety & {
  towers: SocietyTower[];
};

export type ListSocietiesParams = {
  cityId?: number;
  citySlug?: string;
  serviceAreaId?: number;
  search?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? "Request failed");
  }
  return body as T;
}

export async function listSocieties(params?: ListSocietiesParams): Promise<{ data: ResidentialSociety[]; total: number }> {
  const url = new URL("/api/societies", window.location.origin);
  if (params?.cityId) url.searchParams.set("cityId", String(params.cityId));
  if (params?.citySlug) url.searchParams.set("citySlug", params.citySlug);
  if (params?.serviceAreaId) url.searchParams.set("serviceAreaId", String(params.serviceAreaId));
  if (params?.search) url.searchParams.set("search", params.search);
  if (params?.isActive !== undefined) url.searchParams.set("isActive", String(params.isActive));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  if (params?.offset) url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url, { credentials: "include" });
  return parseJson<{ data: ResidentialSociety[]; total: number }>(res);
}

export async function getSociety(id: number): Promise<SocietyWithTowers> {
  const res = await fetch(`/api/societies/${id}`, { credentials: "include" });
  return parseJson<SocietyWithTowers>(res);
}

export async function listSocietyTowers(societyId: number): Promise<SocietyTower[]> {
  const res = await fetch(`/api/societies/${societyId}/towers`, { credentials: "include" });
  const body = await parseJson<{ data: SocietyTower[] }>(res);
  return body.data;
}

export async function createSociety(body: {
  cityId: number;
  serviceAreaId?: number;
  name: string;
  code?: string;
  address: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  gateSecurityNotes?: string;
  initialTowers?: string[];
}): Promise<ResidentialSociety> {
  const res = await fetch("/api/societies", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<ResidentialSociety>(res);
}

export async function createSocietyTower(societyId: number, body: {
  name: string;
  code?: string;
  totalFloors?: number;
  totalFlats?: number;
  parkingLevels?: string;
}): Promise<SocietyTower> {
  const res = await fetch(`/api/societies/${societyId}/towers`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseJson<SocietyTower>(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// React Query Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useSocieties(params?: ListSocietiesParams) {
  return useQuery({
    queryKey: ["societies", params],
    queryFn: () => listSocieties(params),
  });
}

export function useSociety(id: number | null | undefined) {
  return useQuery({
    queryKey: ["societies", id],
    queryFn: () => (id ? getSociety(id) : null),
    enabled: Boolean(id),
  });
}

export function useSocietyTowers(societyId: number | null | undefined) {
  return useQuery({
    queryKey: ["societies", societyId, "towers"],
    queryFn: () => (societyId ? listSocietyTowers(societyId) : []),
    enabled: Boolean(societyId),
  });
}

export function useCreateSociety() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSociety,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["societies"] });
    },
  });
}

export function useCreateSocietyTower() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ societyId, body }: { societyId: number; body: Parameters<typeof createSocietyTower>[1] }) =>
      createSocietyTower(societyId, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["societies", variables.societyId, "towers"] });
      qc.invalidateQueries({ queryKey: ["societies"] });
    },
  });
}
