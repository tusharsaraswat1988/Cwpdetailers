export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export type RouteDestinationInput = {
  subLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
    updatedAt?: Date | null;
  } | null;
  serviceLocation?: {
    latitude?: number | null;
    longitude?: number | null;
    address?: string | null;
    city?: string | null;
    label?: string | null;
    updatedAt?: Date | null;
  } | null;
  vehicle?: {
    serviceLat?: number | null;
    serviceLng?: number | null;
    serviceAddress?: string | null;
    locationLabel?: string | null;
  } | null;
  customer?: {
    address?: string | null;
    city?: string | null;
  } | null;
};

export type ResolvedDestination = {
  location: { latitude: number; longitude: number; radiusMeters: number } | null;
  address: string | null;
  locationLabel: string | null;
  destinationType: "coordinates" | "address" | "missing";
};

export function resolveRouteStopDestination(input: RouteDestinationInput): ResolvedDestination {
  const { subLocation, serviceLocation, vehicle, customer } = input;

  let resolvedLat: number | null = null;
  let resolvedLng: number | null = null;
  let radiusMeters = 100;

  // 1. Coordinates: prefer valid saved coordinates.
  // When a service location is linked on the subscription (e.g. customer-changed or chosen service location),
  // prefer its coordinates if valid.
  if (serviceLocation && isValidCoordinate(serviceLocation.latitude, serviceLocation.longitude)) {
    resolvedLat = serviceLocation.latitude;
    resolvedLng = serviceLocation.longitude;
    radiusMeters = subLocation?.radiusMeters ?? 100;
  } else if (subLocation && isValidCoordinate(subLocation.latitude, subLocation.longitude)) {
    resolvedLat = subLocation.latitude;
    resolvedLng = subLocation.longitude;
    radiusMeters = subLocation.radiusMeters ?? 100;
  } else if (vehicle && isValidCoordinate(vehicle.serviceLat, vehicle.serviceLng)) {
    resolvedLat = vehicle.serviceLat;
    resolvedLng = vehicle.serviceLng;
    radiusMeters = 100;
  }

  // 2. Saved Address: resolve reliably without guessing or inventing
  const addressCandidates = [
    serviceLocation?.address,
    vehicle?.serviceAddress,
    customer?.address,
  ];

  let resolvedAddress: string | null = null;
  for (const raw of addressCandidates) {
    if (raw && typeof raw === "string" && raw.trim().length > 0) {
      resolvedAddress = raw.trim();
      break;
    }
  }

  const locationLabel = (serviceLocation?.label || vehicle?.locationLabel || null)?.trim() || null;

  if (resolvedLat !== null && resolvedLng !== null) {
    return {
      location: {
        latitude: resolvedLat,
        longitude: resolvedLng,
        radiusMeters,
      },
      address: resolvedAddress,
      locationLabel,
      destinationType: "coordinates",
    };
  }

  if (resolvedAddress) {
    return {
      location: null,
      address: resolvedAddress,
      locationLabel,
      destinationType: "address",
    };
  }

  return {
    location: null,
    address: null,
    locationLabel: null,
    destinationType: "missing",
  };
}
