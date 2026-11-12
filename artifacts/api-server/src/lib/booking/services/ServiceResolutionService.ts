import { db, servicesTable, type Service } from "@workspace/db";
import { and, eq, or, asc, inArray } from "drizzle-orm";

export interface ResolvedServiceSuccess {
  success: true;
  service: Service;
  serviceId: number;
  serviceType: string;
}

export interface ResolvedServiceFailure {
  success: false;
  error: string;
  code: "INVALID_SERVICE" | "SERVICE_TYPE_MISMATCH";
}

export type ResolvedServiceResult = ResolvedServiceSuccess | ResolvedServiceFailure;

const VALID_BOOKING_SERVICE_TYPES = new Set([
  "car_wash",
  "detailing",
  "solar_cleaning",
  "one_time_wash",
  "daily_cleaning",
  "subscription_wash",
  "pickup_drop",
  "emergency",
]);

/**
 * Validates semantic compatibility between a catalog service and a client-provided serviceType.
 */
export function checkServiceTypeMatch(service: Service, clientType: string): boolean {
  const normType = clientType.toLowerCase().replace(/-/g, "_").trim();
  const normCategory = (service.category ?? "").toLowerCase().replace(/-/g, "_").trim();
  const normSlug = (service.slug ?? "").toLowerCase().replace(/-/g, "_").trim();

  // Exact category or slug match
  if (normCategory === normType || normSlug === normType) {
    return true;
  }

  // Permitted semantic mappings between service category and client serviceType
  const categoryCompatibilityMap: Record<string, string[]> = {
    car_wash: ["car_wash", "one_time_wash", "daily_cleaning", "subscription_wash"],
    subscription: ["daily_cleaning", "subscription_wash", "car_wash"],
    detailing: ["detailing", "interior", "ceramic_coating", "ppf"],
    ceramic_coating: ["ceramic_coating", "detailing"],
    ppf: ["ppf", "detailing"],
    interior: ["interior", "detailing"],
    solar_cleaning: ["solar_cleaning", "amc"],
    amc: ["amc", "solar_cleaning"],
  };

  const allowed = categoryCompatibilityMap[normCategory] ?? [];
  return allowed.includes(normType);
}

/**
 * Searches the authoritative service catalog for an active service matching the given serviceType.
 */
export async function findServiceByType(clientType: string): Promise<Service | null> {
  const normType = clientType.toLowerCase().replace(/-/g, "_").trim();
  const slugType = clientType.toLowerCase().replace(/_/g, "-").trim();

  // 1. Try exact slug match
  const [bySlug] = await db
    .select()
    .from(servicesTable)
    .where(
      and(
        or(eq(servicesTable.slug, normType), eq(servicesTable.slug, slugType)),
        eq(servicesTable.isActive, true),
      ),
    )
    .limit(1);
  if (bySlug) return bySlug;

  // 2. Try exact category match
  const validCategories = [
    "car_wash",
    "detailing",
    "ceramic_coating",
    "ppf",
    "interior",
    "solar_cleaning",
    "amc",
    "subscription",
  ];
  if (validCategories.includes(normType)) {
    const [byCat] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.category, normType as any),
          eq(servicesTable.isActive, true),
        ),
      )
      .orderBy(asc(servicesTable.id))
      .limit(1);
    if (byCat) return byCat;
  }

  // 3. Try semantic mapping for common serviceType aliases
  const typeToCategory: Record<string, string[]> = {
    car_wash: ["car_wash"],
    one_time_wash: ["car_wash"],
    daily_cleaning: ["subscription", "car_wash"],
    subscription_wash: ["subscription", "car_wash"],
    detailing: ["detailing", "interior", "ceramic_coating", "ppf"],
    ceramic_coating: ["ceramic_coating"],
    ppf: ["ppf"],
    interior: ["interior"],
    solar_cleaning: ["solar_cleaning", "amc"],
  };

  const targetCategories = typeToCategory[normType];
  if (targetCategories && targetCategories.length > 0) {
    const [byMapped] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          inArray(servicesTable.category, targetCategories as any),
          eq(servicesTable.isActive, true),
        ),
      )
      .orderBy(asc(servicesTable.id))
      .limit(1);
    if (byMapped) return byMapped;
  }

  return null;
}

/**
 * Maps a catalog service to an allowed PostgreSQL bookingServiceType enum value.
 */
export function mapServiceToBookingType(service: Service, clientType?: unknown): string {
  if (typeof clientType === "string" && clientType.trim()) {
    const norm = clientType.trim().toLowerCase();
    if (VALID_BOOKING_SERVICE_TYPES.has(norm)) {
      return norm;
    }
  }

  const categoryToBookingType: Record<string, string> = {
    car_wash: "car_wash",
    detailing: "detailing",
    ceramic_coating: "detailing",
    ppf: "detailing",
    interior: "detailing",
    solar_cleaning: "solar_cleaning",
    amc: "solar_cleaning",
    subscription: "daily_cleaning",
  };

  return categoryToBookingType[service.category] ?? "car_wash";
}

/**
 * Authoritative backend service resolution:
 * Enforces server-side resolution and validation of incoming booking service identification.
 */
export async function resolveAuthoritativeService(params: {
  serviceId?: unknown;
  serviceType?: unknown;
}): Promise<ResolvedServiceResult> {
  const { serviceId, serviceType } = params;

  if (serviceId == null && serviceType == null) {
    return {
      success: false,
      error: "Service identification (serviceId or serviceType) is required",
      code: "INVALID_SERVICE",
    };
  }

  // Scenario 1: Explicit serviceId provided
  if (serviceId != null) {
    const sId = Number(serviceId);
    if (!Number.isInteger(sId) || sId <= 0) {
      return {
        success: false,
        error: "Invalid serviceId: must be a positive integer",
        code: "INVALID_SERVICE",
      };
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(and(eq(servicesTable.id, sId), eq(servicesTable.isActive, true)))
      .limit(1);

    if (!service) {
      return {
        success: false,
        error: "Service not found or inactive in catalog",
        code: "INVALID_SERVICE",
      };
    }

    // If client also supplied serviceType, prevent manipulation / mismatch
    if (serviceType != null && typeof serviceType === "string" && serviceType.trim()) {
      const isMatch = checkServiceTypeMatch(service, serviceType);
      if (!isMatch) {
        return {
          success: false,
          error: "Provided serviceType does not match the specified serviceId",
          code: "SERVICE_TYPE_MISMATCH",
        };
      }
    }

    const bookingType = mapServiceToBookingType(service, serviceType);
    return {
      success: true,
      service,
      serviceId: service.id,
      serviceType: bookingType,
    };
  }

  // Scenario 2: Legacy payload specifying serviceType without serviceId
  if (typeof serviceType !== "string" || !serviceType.trim()) {
    return {
      success: false,
      error: "Invalid serviceType format",
      code: "INVALID_SERVICE",
    };
  }

  const service = await findServiceByType(serviceType);
  if (!service) {
    return {
      success: false,
      error: `No active catalog service found for serviceType: ${serviceType}`,
      code: "INVALID_SERVICE",
    };
  }

  const bookingType = mapServiceToBookingType(service, serviceType);
  return {
    success: true,
    service,
    serviceId: service.id,
    serviceType: bookingType,
  };
}
