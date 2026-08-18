import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listServiceLocations,
  type CustomerServiceLocationRow,
} from "@/features/service-locations/api";
import type { ServiceLocationLike, StructuredAddressLike } from "@/lib/selected-address";

const EMPTY_STRUCTURED: StructuredAddressLike[] = [];

async function fetchStructuredAddresses(customerId: number): Promise<StructuredAddressLike[]> {
  const res = await fetch(`/api/addresses?customerId=${customerId}`, { credentials: "include" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as StructuredAddressLike[]) : [];
}

function querySettled(q: { isFetched: boolean; isError: boolean }): boolean {
  return q.isFetched || q.isError;
}

export function useCustomerLocationSources(customerId: number | null) {
  const serviceLocationsQuery = useQuery({
    queryKey: ["service-locations", "customer", customerId],
    queryFn: () => listServiceLocations({ customerId: customerId!, status: "active", limit: 50 }),
    enabled: customerId != null,
    retry: false,
  });

  const structuredQuery = useQuery({
    queryKey: ["addresses", customerId],
    queryFn: () => fetchStructuredAddresses(customerId!),
    enabled: customerId != null,
    retry: false,
  });

  const serviceLocations = useMemo((): ServiceLocationLike[] => (
    (serviceLocationsQuery.data?.data ?? []) as CustomerServiceLocationRow[]
  ).map(row => ({
    id: row.id,
    label: row.label,
    address: row.address,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    placeId: row.placeId,
    isDefault: row.isDefault,
  })), [serviceLocationsQuery.data]);

  const structuredAddresses = structuredQuery.data ?? EMPTY_STRUCTURED;
  const ready = customerId == null || (
    querySettled(serviceLocationsQuery) && querySettled(structuredQuery)
  );

  return {
    serviceLocations,
    structuredAddresses,
    ready,
  };
}
