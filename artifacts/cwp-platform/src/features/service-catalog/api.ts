import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function catalogFetch<T>(path: string, opts?: RequestInit): Promise<T> {
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

export type AdminService = {
  id: number;
  name: string;
  slug?: string;
  description?: string;
  shortDescription?: string;
  serviceCategoryId?: number;
  category: string;
  categoryName?: string;
  categorySlug?: string;
  basePrice: string;
  gstRate?: string;
  pricingType?: "inclusive" | "exclusive";
  pricingModel?: "fixed" | "vehicle_matrix" | "solar_slab";
  durationMinutes?: number;
  isActive?: boolean;
  status?: "active" | "disabled" | "archived";
  imageUrl?: string;
  features?: string[];
  assignmentStrategy?: "manual" | "auto" | "round_robin";
  addonCount?: number;
};

export type CatalogPackage = {
  id: number; name: string; slug: string; price: string; validityDays: number;
  description?: string | null;
  features?: string[]; tag?: string; isHighlighted: boolean; showOnHomepage?: boolean;
  cityId?: number;
  entitlements?: Array<{ id: number; serviceId: number; entitlementType: string; creditCount: number }>;
};

export type HomepagePlanCard = {
  id: number;
  source: "package" | "dcms" | "legacy_plan";
  name: string;
  price: string;
  description?: string | null;
  features?: string[];
  tag?: string | null;
  isHighlighted: boolean;
  validityDays?: number;
  durationMonths?: number | null;
  includedCleanings?: number;
  includedWashes?: number;
  scopeLabel?: string | null;
};

export type ServiceAddon = {
  id: number; name: string; slug: string; basePrice: string; description?: string;
  isActive: boolean; linkId?: number; durationMinutes?: number;
};

export type SolarSlab = {
  id: number; serviceId: number; cityId?: number; minPanels: number; maxPanels?: number;
  pricePerPanel: string; minimumBilling: string;
};

export type HomepageSection = {
  sectionKey: string; title?: string; subtitle?: string; content: Record<string, unknown>; isActive: boolean;
};

export function useAdminServices() {
  return useQuery({
    queryKey: ["admin", "services"],
    queryFn: () => catalogFetch<AdminService[]>("/services?includeInactive=true"),
  });
}

export function useServiceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin", "services"] });
    qc.invalidateQueries({ queryKey: ["catalog", "services"] });
    qc.invalidateQueries({ queryKey: ["/services"] });
  };
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        catalogFetch<AdminService>("/services", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
        catalogFetch<AdminService>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: number) => catalogFetch(`/services/${id}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
}

export function useCatalogPackages(citySlug?: string) {
  return useQuery({
    queryKey: ["catalog", "packages", citySlug],
    queryFn: () => catalogFetch<CatalogPackage[]>(`/catalog/packages${citySlug ? `?citySlug=${citySlug}` : ""}`),
  });
}

export function useCatalogAddons(serviceId?: number) {
  return useQuery({
    queryKey: ["catalog", "addons", serviceId ?? "all"],
    queryFn: () => catalogFetch<ServiceAddon[]>(`/catalog/addons${serviceId ? `?serviceId=${serviceId}` : ""}`),
  });
}

export function useServiceAddonMutations(serviceId: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog", "addons", serviceId] });
    qc.invalidateQueries({ queryKey: ["admin", "services"] });
  };
  return {
    create: useMutation({
      mutationFn: (data: { name: string; basePrice: string; description?: string; durationMinutes?: number }) =>
        catalogFetch<ServiceAddon>("/catalog/addons", {
          method: "POST",
          body: JSON.stringify({
            ...data,
            serviceId,
            pricingType: "inclusive",
            gstRate: "18",
            isActive: true,
          }),
        }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
        catalogFetch<ServiceAddon>(`/catalog/addons/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    unlink: useMutation({
      mutationFn: (linkId: number) =>
        catalogFetch(`/catalog/addon-links/${linkId}`, { method: "DELETE" }),
      onSuccess: invalidate,
    }),
  };
}

export function useSolarSlabs(serviceId?: number) {
  return useQuery({
    queryKey: ["catalog", "solar-slabs", serviceId],
    queryFn: () => catalogFetch<SolarSlab[]>(`/catalog/solar-slabs${serviceId ? `?serviceId=${serviceId}` : ""}`),
  });
}

export function useHomepageSections() {
  return useQuery({
    queryKey: ["catalog", "homepage"],
    queryFn: () => catalogFetch<HomepageSection[]>("/catalog/homepage"),
  });
}

export function useCatalogSettings() {
  return useQuery({
    queryKey: ["catalog", "settings"],
    queryFn: () => catalogFetch<Record<string, unknown>>("/catalog/settings"),
  });
}

export function useCityAvailability(serviceId?: number) {
  return useQuery({
    queryKey: ["catalog", "city-availability", serviceId],
    queryFn: () => catalogFetch<Array<{ id: number; serviceId: number; cityId: number; basePriceOverride?: string; isActive: boolean }>>(
      `/catalog/city-availability${serviceId ? `?serviceId=${serviceId}` : ""}`,
    ),
  });
}

export function useCustomerEntitlements(customerId?: number) {
  return useQuery({
    queryKey: ["catalog", "entitlements", customerId],
    queryFn: () => catalogFetch<Array<{
      id: number; serviceId: number; remainingCredits: number; validUntil: string; status: string; entitlementType: string;
    }>>(`/catalog/entitlements?customerId=${customerId}&status=active`),
    enabled: customerId != null,
  });
}

export function useSelfBookingCheck(customerId?: number, serviceId?: number, citySlug = "varanasi") {
  return useQuery({
    queryKey: ["catalog", "self-booking", customerId, serviceId, citySlug],
    queryFn: () => catalogFetch<{ eligible: boolean; entitlementId?: number; remainingCredits?: number; reason?: string }>(
      `/catalog/self-booking/check?customerId=${customerId}&serviceId=${serviceId}&citySlug=${citySlug}`,
    ),
    enabled: customerId != null && serviceId != null,
  });
}

export function useCatalogMutations(entity: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["catalog", entity] });
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        catalogFetch(`/catalog/${entity}`, { method: "POST", body: JSON.stringify(data) }),
      onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["catalog"] }); },
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
        catalogFetch(`/catalog/${entity}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["catalog"] }); },
    }),
    remove: useMutation({
      mutationFn: (id: number) => catalogFetch(`/catalog/${entity}/${id}`, { method: "DELETE" }),
      onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["catalog"] }); },
    }),
  };
}

export function useSaveHomepageSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sectionKey, ...data }: { sectionKey: string } & Record<string, unknown>) =>
      catalogFetch(`/catalog/homepage/${sectionKey}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "homepage"] }),
  });
}

export function useSaveCatalogSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      catalogFetch("/catalog/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalog", "settings"] }),
  });
}

export function useCityServices(citySlug: string) {
  return useQuery({
    queryKey: ["catalog", "city-services", citySlug],
    queryFn: () => catalogFetch<Array<Record<string, unknown>>>(`/catalog/services/${citySlug}`),
    enabled: !!citySlug,
  });
}

export function useCatalogPricingQuote(params: {
  serviceId?: number; vehicleModelId?: number; panelCount?: number; citySlug?: string;
}) {
  const qs = new URLSearchParams();
  if (params.serviceId) qs.set("serviceId", String(params.serviceId));
  if (params.vehicleModelId) qs.set("vehicleModelId", String(params.vehicleModelId));
  if (params.panelCount) qs.set("panelCount", String(params.panelCount));
  if (params.citySlug) qs.set("citySlug", params.citySlug);
  return useQuery({
    queryKey: ["catalog", "pricing", params],
    queryFn: () => catalogFetch<Record<string, unknown>>(`/catalog/pricing/quote?${qs}`),
    enabled: !!params.serviceId,
  });
}

export function useHomepagePlans(citySlug?: string) {
  return useQuery({
    queryKey: ["catalog", "homepage-plans", citySlug],
    queryFn: () => catalogFetch<HomepagePlanCard[]>(`/catalog/homepage-plans${citySlug ? `?citySlug=${citySlug}` : ""}`),
  });
}

export function usePackageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog", "packages"] });
    qc.invalidateQueries({ queryKey: ["catalog", "homepage-plans"] });
  };
  return {
    create: useMutation({
      mutationFn: (data: Record<string, unknown>) =>
        catalogFetch<CatalogPackage>("/catalog/packages", { method: "POST", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, ...data }: { id: number } & Record<string, unknown>) =>
        catalogFetch<CatalogPackage>(`/catalog/packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: invalidate,
    }),
  };
}
