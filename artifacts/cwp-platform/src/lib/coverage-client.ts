export type CoverageServiceSummary = {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
};

export type CoverageCheckResult = {
  success: boolean;
  message: string;
  coverageStatus?: string;
  status?: string;
  availableServices?: CoverageServiceSummary[];
  comingSoonServices?: CoverageServiceSummary[];
  unavailableServices?: CoverageServiceSummary[];
  cityName?: string;
};

export async function checkCoverage(input: {
  customerId?: number;
  address: string;
  locationLat: number;
  locationLng: number;
  placeId?: string;
  serviceId?: number;
  citySlug?: string;
}): Promise<CoverageCheckResult> {
  const res = await fetch("/api/coverage/check", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: input.customerId,
      address: input.address,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      placeId: input.placeId,
      serviceId: input.serviceId,
      citySlug: input.citySlug ?? "varanasi",
    }),
  });
  const body = await res.json().catch(() => ({ message: "Coverage check failed" }));
  if (!res.ok) {
    return {
      success: false,
      message: (body as { message?: string }).message ?? "Service not available at this address",
      coverageStatus: "UNAVAILABLE",
      status: (body as { status?: string }).status,
    };
  }
  return body as CoverageCheckResult;
}
