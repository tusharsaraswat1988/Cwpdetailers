import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function masterFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? "Request failed");
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type VehicleBrand = { id: number; name: string; slug: string; isActive: boolean };
export type VehicleModel = {
  id: number; brandId: number; name: string; slug: string;
  brandName: string; categoryName: string; categorySlug: string;
  seatName: string; seatCount: number; fuelName?: string;
  vehicleCategoryId: number; seatCategoryId: number;
};
export type VehicleCategory = { id: number; name: string; slug: string; isActive: boolean };
export type SeatCategory = { id: number; name: string; slug: string; seatCount: number; isActive: boolean };
export type State = { id: number; name: string; code: string; isActive: boolean };
export type City = { id: number; stateId: number; name: string; slug: string; stateName: string; stateCode: string };
export type ServiceArea = { id: number; cityId: number; name: string; cityName: string };
export type Pincode = { id: number; serviceAreaId: number; pincode: string; areaName: string; cityName: string };
export type ServiceCategory = { id: number; name: string; slug: string; legacyCategory?: string; isActive: boolean };
export type SavedLocation = {
  id: number; customerId: number; label: string; address: string;
  latitude: number; longitude: number; placeId?: string; isDefault: boolean;
};
export type CatalogService = {
  id: number; name: string; description?: string; category: string;
  basePrice: string; durationMinutes?: number; imageUrl?: string;
  features?: string[]; categoryName?: string; categorySlug?: string;
};
export type ServicePlan = {
  id: number; serviceId: number; name: string; description?: string;
  price: string; durationMonths?: number; features?: string[];
  tag?: string; isHighlighted: boolean;
};
export type PricingQuote = {
  amount: number; source: string;
  vehicleCategory?: string; seatCategory?: string; durationMinutes?: number;
};

export type LocationValue = {
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
};

// ─── Vehicle Masters ─────────────────────────────────────────────────────────

export function useVehicleBrands(q?: string) {
  return useQuery({
    queryKey: ["masters", "vehicle-brands", q],
    queryFn: () => masterFetch<VehicleBrand[]>(`/masters/vehicle-brands?isActive=true${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
}

export function useVehicleModels(opts?: { q?: string; brandId?: number }, enabled = true) {
  const params = new URLSearchParams({ isActive: "true" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.brandId) params.set("brandId", String(opts.brandId));
  return useQuery({
    queryKey: ["masters", "vehicle-models", opts],
    queryFn: () => masterFetch<VehicleModel[]>(`/masters/vehicle-models?${params}`),
    enabled: enabled && Boolean(opts),
  });
}

export function useVehicleCategories() {
  return useQuery({
    queryKey: ["masters", "vehicle-categories"],
    queryFn: () => masterFetch<VehicleCategory[]>("/masters/vehicle-categories?isActive=true"),
  });
}

export function useSeatCategories() {
  return useQuery({
    queryKey: ["masters", "seat-categories"],
    queryFn: () => masterFetch<SeatCategory[]>("/masters/seat-categories?isActive=true"),
  });
}

// ─── City Masters ────────────────────────────────────────────────────────────

export function useStates(q?: string) {
  return useQuery({
    queryKey: ["masters", "states", q],
    queryFn: () => masterFetch<State[]>(`/masters/states?isActive=true${q ? `&q=${encodeURIComponent(q)}` : ""}`),
  });
}

export function useCities(opts?: { q?: string; stateId?: number }) {
  const params = new URLSearchParams({ isActive: "true" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.stateId) params.set("stateId", String(opts.stateId));
  return useQuery({
    queryKey: ["masters", "cities", opts],
    queryFn: () => masterFetch<City[]>(`/masters/cities?${params}`),
  });
}

export function useServiceAreas(opts?: { q?: string; cityId?: number }) {
  const params = new URLSearchParams({ isActive: "true" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.cityId) params.set("cityId", String(opts.cityId));
  return useQuery({
    queryKey: ["masters", "service-areas", opts],
    queryFn: () => masterFetch<ServiceArea[]>(`/masters/service-areas?${params}`),
  });
}

export function usePincodes(opts?: { q?: string; serviceAreaId?: number }) {
  const params = new URLSearchParams({ isActive: "true" });
  if (opts?.q) params.set("q", opts.q);
  if (opts?.serviceAreaId) params.set("serviceAreaId", String(opts.serviceAreaId));
  return useQuery({
    queryKey: ["masters", "pincodes", opts],
    queryFn: () => masterFetch<Pincode[]>(`/masters/pincodes?${params}`),
  });
}

// ─── Service Catalog ─────────────────────────────────────────────────────────

export function useCatalogServices() {
  return useQuery({
    queryKey: ["catalog", "services"],
    queryFn: () => masterFetch<CatalogService[]>("/catalog/services"),
  });
}

export function useCatalogPlans(serviceId?: number) {
  return useQuery({
    queryKey: ["catalog", "plans", serviceId],
    queryFn: () => masterFetch<ServicePlan[]>(`/catalog/plans${serviceId ? `?serviceId=${serviceId}` : ""}`),
  });
}

export function useServiceCategories() {
  return useQuery({
    queryKey: ["masters", "service-categories"],
    queryFn: () => masterFetch<ServiceCategory[]>("/masters/service-categories?isActive=true"),
  });
}

export function usePricingQuote(serviceId?: number, vehicleModelId?: number) {
  return useQuery({
    queryKey: ["pricing", "quote", serviceId, vehicleModelId],
    queryFn: () => masterFetch<PricingQuote>(`/pricing/quote?serviceId=${serviceId}&vehicleModelId=${vehicleModelId}`),
    enabled: !!serviceId && !!vehicleModelId,
  });
}

// ─── Saved Locations ─────────────────────────────────────────────────────────

export function useSavedLocations(customerId?: number) {
  return useQuery({
    queryKey: ["saved-locations", customerId],
    queryFn: () => masterFetch<SavedLocation[]>(`/saved-locations?customerId=${customerId}`),
    enabled: customerId != null,
  });
}

export function useCreateSavedLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<SavedLocation, "id" | "createdAt" | "updatedAt">) =>
      masterFetch<SavedLocation>("/saved-locations", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["saved-locations", vars.customerId] }),
  });
}

// ─── Admin CRUD helpers ───────────────────────────────────────────────────────

type MasterEntity = "vehicle-brands" | "vehicle-models" | "vehicle-categories" | "seat-categories" |
  "fuel-types" | "states" | "cities" | "service-areas" | "pincodes" | "service-categories";

export function useMasterList<T>(entity: MasterEntity, params?: Record<string, string>) {
  const qs = params ? `?${new URLSearchParams(params)}` : "";
  return useQuery({
    queryKey: ["masters", entity, params],
    queryFn: () => masterFetch<T[]>(`/masters/${entity}${qs}`),
  });
}

export function useMasterMutations(entity: MasterEntity) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["masters", entity] });
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        masterFetch(`/masters/${entity}`, { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
        masterFetch(`/masters/${entity}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) =>
        masterFetch(`/masters/${entity}/${id}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
}

export { buildMapsUrl, buildNavigateUrl, mapsViewUrl, canNavigateTo } from "@/lib/maps";
