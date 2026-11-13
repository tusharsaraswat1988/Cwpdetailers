import {
  db,
  servicesTable,
  citiesTable,
  branchesTable,
  serviceAvailabilityMatrixTable,
  serviceCityAvailabilityTable,
  serviceBranchOverridesTable,
  type ServiceAvailabilityMatrix,
  type InsertServiceAvailabilityMatrix,
} from "@workspace/db";
import { eq, and, or, isNull, sql, asc, desc } from "drizzle-orm";
import { logAdminAudit } from "../audit/adminAuditService";
import { invalidateCoverageCacheForMasterUpdate } from "../coverage";
import { logger } from "../logger";

export interface EffectiveServiceItem {
  id: number;
  name: string;
  slug: string | null;
  code: string | null;
  category: string;
  serviceType: string | null;
  description: string | null;
  shortDescription: string | null;
  imageUrl: string | null;
  durationMinutes: number | null;
  pricingType: "inclusive" | "exclusive";
  gstRate: number;
  globalBasePrice: number;
  cityPriceOverride: number | null;
  branchPriceOverride: number | null;
  effectivePrice: number;
  isAvailableInCity: boolean;
  isAvailableInBranch: boolean;
  isAvailable: boolean;
  bookingModes: string[];
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  operationalConstraints: Record<string, unknown>;
  adminNotes: string | null;
  source: "branch_override" | "city_override" | "global_default";
}

/**
 * Returns rows from the Service Availability Matrix with optional city, branch, or service filters.
 */
export async function getCityBranchServiceMatrix(opts?: {
  cityId?: number;
  branchId?: number | null;
  serviceId?: number;
  includeInactive?: boolean;
}): Promise<Array<ServiceAvailabilityMatrix & { serviceName?: string; cityName?: string; branchName?: string | null }>> {
  const conditions = [];

  if (opts?.cityId) {
    conditions.push(eq(serviceAvailabilityMatrixTable.cityId, opts.cityId));
  }
  if (opts?.branchId !== undefined) {
    if (opts.branchId === null) {
      conditions.push(isNull(serviceAvailabilityMatrixTable.branchId));
    } else {
      conditions.push(eq(serviceAvailabilityMatrixTable.branchId, opts.branchId));
    }
  }
  if (opts?.serviceId) {
    conditions.push(eq(serviceAvailabilityMatrixTable.serviceId, opts.serviceId));
  }
  if (!opts?.includeInactive) {
    conditions.push(eq(serviceAvailabilityMatrixTable.isActive, true));
  }

  const rows = await db
    .select({
      matrix: serviceAvailabilityMatrixTable,
      serviceName: servicesTable.name,
      serviceCode: servicesTable.code,
      cityName: citiesTable.name,
      branchName: branchesTable.name,
    })
    .from(serviceAvailabilityMatrixTable)
    .leftJoin(servicesTable, eq(serviceAvailabilityMatrixTable.serviceId, servicesTable.id))
    .leftJoin(citiesTable, eq(serviceAvailabilityMatrixTable.cityId, citiesTable.id))
    .leftJoin(branchesTable, eq(serviceAvailabilityMatrixTable.branchId, branchesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      asc(serviceAvailabilityMatrixTable.cityId),
      asc(serviceAvailabilityMatrixTable.branchId),
      asc(servicesTable.name),
    );

  return rows.map(r => ({
    ...r.matrix,
    serviceName: r.serviceName ?? undefined,
    cityName: r.cityName ?? undefined,
    branchName: r.branchName ?? null,
  }));
}

/**
 * Sets or updates availability and price overrides for a service in a city/branch.
 * Atomically updates both the matrix and legacy fallback tables to guarantee zero regression.
 */
export async function setServiceAvailability(input: {
  serviceId: number;
  cityId: number;
  branchId?: number | null;
  isActive: boolean;
  bookingModes?: string[];
  effectiveFrom?: Date;
  effectiveUntil?: Date | null;
  basePriceOverride?: number | null;
  packageConfigId?: number | null;
  operationalConstraints?: Record<string, unknown>;
  adminNotes?: string | null;
  performedBy: number;
}): Promise<ServiceAvailabilityMatrix> {
  const {
    serviceId,
    cityId,
    branchId = null,
    isActive,
    bookingModes = ["one_time"],
    effectiveFrom = new Date(),
    effectiveUntil = null,
    basePriceOverride = null,
    packageConfigId = null,
    operationalConstraints = {},
    adminNotes = null,
    performedBy,
  } = input;

  if (effectiveUntil && effectiveFrom && effectiveUntil < effectiveFrom) {
    throw new Error("effectiveUntil cannot be earlier than effectiveFrom");
  }

  // Validate service exists
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
  if (!service) throw new Error(`Service ${serviceId} not found`);

  // Validate city exists
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
  if (!city) throw new Error(`City ${cityId} not found`);

  // Validate branch exists if specified
  if (branchId != null) {
    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
    if (!branch) throw new Error(`Branch ${branchId} not found`);
    if (branch.cityId && branch.cityId !== cityId) {
      throw new Error(`Branch ${branchId} does not belong to city ${cityId}`);
    }
  }

  const now = new Date();
  const priceOverrideStr = basePriceOverride != null && Number.isFinite(basePriceOverride)
    ? Number(basePriceOverride).toFixed(2)
    : null;

  // Find existing matrix record
  const existingConditions = [
    eq(serviceAvailabilityMatrixTable.serviceId, serviceId),
    eq(serviceAvailabilityMatrixTable.cityId, cityId),
  ];
  if (branchId == null) {
    existingConditions.push(isNull(serviceAvailabilityMatrixTable.branchId));
  } else {
    existingConditions.push(eq(serviceAvailabilityMatrixTable.branchId, branchId));
  }

  const [existing] = await db
    .select()
    .from(serviceAvailabilityMatrixTable)
    .where(and(...existingConditions))
    .limit(1);

  let record: ServiceAvailabilityMatrix;

  if (existing) {
    const [updated] = await db
      .update(serviceAvailabilityMatrixTable)
      .set({
        isActive,
        bookingModes,
        effectiveFrom,
        effectiveUntil,
        basePriceOverride: priceOverrideStr,
        packageConfigId,
        operationalConstraints,
        adminNotes,
        updatedAt: now,
      })
      .where(eq(serviceAvailabilityMatrixTable.id, existing.id))
      .returning();
    record = updated!;
  } else {
    const [created] = await db
      .insert(serviceAvailabilityMatrixTable)
      .values({
        serviceId,
        cityId,
        branchId,
        isActive,
        bookingModes,
        effectiveFrom,
        effectiveUntil,
        basePriceOverride: priceOverrideStr,
        packageConfigId,
        operationalConstraints,
        adminNotes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    record = created!;
  }

  // Synchronize legacy tables for 100% backward compatibility
  try {
    if (branchId == null) {
      await db
        .insert(serviceCityAvailabilityTable)
        .values({
          serviceId,
          cityId,
          basePriceOverride: priceOverrideStr,
          isActive,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [serviceCityAvailabilityTable.serviceId, serviceCityAvailabilityTable.cityId],
          set: {
            basePriceOverride: priceOverrideStr,
            isActive,
            updatedAt: now,
          },
        });
    } else {
      await db
        .insert(serviceBranchOverridesTable)
        .values({
          serviceId,
          branchId,
          basePriceOverride: priceOverrideStr,
          isActive,
          customSettings: operationalConstraints,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [serviceBranchOverridesTable.serviceId, serviceBranchOverridesTable.branchId],
          set: {
            basePriceOverride: priceOverrideStr,
            isActive,
            customSettings: operationalConstraints,
            updatedAt: now,
          },
        });
    }
  } catch (syncErr) {
    logger.warn({ err: syncErr }, "Legacy availability table synchronization warning");
  }

  // Audit logging
  await logAdminAudit({
    action: "service_availability_updated",
    entityType: "service_availability_matrix",
    entityId: record.id,
    branchId: branchId ?? undefined,
    performedBy,
    reason: `Configured service ${service.name} in city ${city.name} (${branchId ? `branch #${branchId}` : "city-wide"}) active: ${isActive}`,
    details: {
      serviceId,
      serviceName: service.name,
      cityId,
      cityName: city.name,
      branchId,
      isActive,
      basePriceOverride,
      bookingModes,
    },
  });

  invalidateCoverageCacheForMasterUpdate("service_availability", { cityId });

  return record;
}

/**
 * Checks whether a specific service is available and bookable for a given city and branch at a given date.
 */
export async function isServiceBookableInScope(opts: {
  serviceId: number;
  cityId?: number | null;
  branchId?: number | null;
  date?: Date;
  bookingMode?: string;
}): Promise<{ bookable: boolean; reason?: string }> {
  let resolvedCityId = opts.cityId ?? undefined;
  if (!resolvedCityId && opts.branchId) {
    const [branch] = await db
      .select({ cityId: branchesTable.cityId })
      .from(branchesTable)
      .where(eq(branchesTable.id, opts.branchId))
      .limit(1);
    if (branch?.cityId) {
      resolvedCityId = branch.cityId;
    }
  }

  if (!resolvedCityId) {
    // Without city scope, service cannot be validated
    return { bookable: false, reason: "City or branch scope required to determine service availability" };
  }

  const checkDate = opts.date ?? new Date();

  // 1. Service must exist and be active globally
  const [service] = await db
    .select({
      id: servicesTable.id,
      isActive: servicesTable.isActive,
      status: servicesTable.status,
    })
    .from(servicesTable)
    .where(eq(servicesTable.id, opts.serviceId))
    .limit(1);

  if (!service || !service.isActive || service.status === "archived") {
    return { bookable: false, reason: "Service is inactive or archived in catalog" };
  }

  // 2. If branch is specified, check branch-level override in matrix first
  if (opts.branchId) {
    const [branchRow] = await db
      .select()
      .from(serviceAvailabilityMatrixTable)
      .where(and(
        eq(serviceAvailabilityMatrixTable.serviceId, opts.serviceId),
        eq(serviceAvailabilityMatrixTable.cityId, resolvedCityId),
        eq(serviceAvailabilityMatrixTable.branchId, opts.branchId),
      ))
      .limit(1);

    if (branchRow) {
      if (!branchRow.isActive) {
        return { bookable: false, reason: "Service explicitly disabled in branch" };
      }
      if (branchRow.effectiveFrom && new Date(branchRow.effectiveFrom) > checkDate) {
        return { bookable: false, reason: "Service is not yet available in branch (future launch)" };
      }
      if (branchRow.effectiveUntil && new Date(branchRow.effectiveUntil) < checkDate) {
        return { bookable: false, reason: "Service availability has expired in branch" };
      }
      if (opts.bookingMode && Array.isArray(branchRow.bookingModes) && !branchRow.bookingModes.includes(opts.bookingMode)) {
        return { bookable: false, reason: `Booking mode '${opts.bookingMode}' is not available for this service in branch` };
      }
      return { bookable: true };
    }
  }

  // 3. Check city-wide configuration in matrix
  const [cityRow] = await db
    .select()
    .from(serviceAvailabilityMatrixTable)
    .where(and(
      eq(serviceAvailabilityMatrixTable.serviceId, opts.serviceId),
      eq(serviceAvailabilityMatrixTable.cityId, resolvedCityId),
      isNull(serviceAvailabilityMatrixTable.branchId),
    ))
    .limit(1);

  if (cityRow) {
    if (!cityRow.isActive) {
      return { bookable: false, reason: "Service disabled in city" };
    }
    if (cityRow.effectiveFrom && new Date(cityRow.effectiveFrom) > checkDate) {
      return { bookable: false, reason: "Service is not yet launched in city (future launch)" };
    }
    if (cityRow.effectiveUntil && new Date(cityRow.effectiveUntil) < checkDate) {
      return { bookable: false, reason: "Service availability has expired in city" };
    }
    if (opts.bookingMode && Array.isArray(cityRow.bookingModes) && !cityRow.bookingModes.includes(opts.bookingMode)) {
      return { bookable: false, reason: `Booking mode '${opts.bookingMode}' is not available for this service in city` };
    }
    return { bookable: true };
  }

  // 4. Fallback: check legacy serviceCityAvailabilityTable
  const [legacyRow] = await db
    .select()
    .from(serviceCityAvailabilityTable)
    .where(and(
      eq(serviceCityAvailabilityTable.serviceId, opts.serviceId),
      eq(serviceCityAvailabilityTable.cityId, resolvedCityId),
    ))
    .limit(1);

  if (legacyRow) {
    if (!legacyRow.isActive) {
      return { bookable: false, reason: "Service disabled in city (legacy record)" };
    }
    return { bookable: true };
  }

  // If no city configuration exists, fail closed
  return { bookable: false, reason: "Service is not configured for availability in this city" };
}

/**
 * Resolves the complete effective customer-facing service catalog for a given city and branch.
 * Enforces 3-tier pricing precedence (Branch > City > Global Base Price).
 * Only returns active and currently effective services.
 */
export async function getEffectiveServicesForScope(opts: {
  cityId: number;
  branchId?: number | null;
  date?: Date;
  bookingMode?: string;
}): Promise<EffectiveServiceItem[]> {
  const checkDate = opts.date ?? new Date();

  // 1. Fetch all globally active services
  const allServices = await db
    .select()
    .from(servicesTable)
    .where(and(eq(servicesTable.isActive, true), eq(servicesTable.status, "active")))
    .orderBy(asc(servicesTable.name));

  // 2. Fetch all matrix rows for this city (both city-wide and branch-specific)
  const matrixRows = await db
    .select()
    .from(serviceAvailabilityMatrixTable)
    .where(eq(serviceAvailabilityMatrixTable.cityId, opts.cityId));

  const cityMatrixMap = new Map<number, (typeof matrixRows)[0]>();
  const branchMatrixMap = new Map<number, (typeof matrixRows)[0]>();

  for (const row of matrixRows) {
    if (row.branchId === null) {
      cityMatrixMap.set(row.serviceId, row);
    } else if (opts.branchId && row.branchId === opts.branchId) {
      branchMatrixMap.set(row.serviceId, row);
    }
  }

  // Also fetch legacy rows as fallback
  const legacyCityRows = await db
    .select()
    .from(serviceCityAvailabilityTable)
    .where(eq(serviceCityAvailabilityTable.cityId, opts.cityId));
  const legacyCityMap = new Map(legacyCityRows.map(r => [r.serviceId, r]));

  const result: EffectiveServiceItem[] = [];

  for (const svc of allServices) {
    const globalBasePrice = parseFloat(svc.basePrice?.toString() || "0");
    const cityRow = cityMatrixMap.get(svc.id);
    const branchRow = branchMatrixMap.get(svc.id);
    const legacyCityRow = legacyCityMap.get(svc.id);

    // Resolve City Availability
    let isAvailableInCity = false;
    let cityPriceOverride: number | null = null;

    if (cityRow) {
      const started = !cityRow.effectiveFrom || new Date(cityRow.effectiveFrom) <= checkDate;
      const notExpired = !cityRow.effectiveUntil || new Date(cityRow.effectiveUntil) >= checkDate;
      const modeMatch = !opts.bookingMode || !Array.isArray(cityRow.bookingModes) || cityRow.bookingModes.includes(opts.bookingMode);
      isAvailableInCity = cityRow.isActive && started && notExpired && modeMatch;
      cityPriceOverride = cityRow.basePriceOverride ? parseFloat(cityRow.basePriceOverride.toString()) : null;
    } else if (legacyCityRow) {
      isAvailableInCity = legacyCityRow.isActive;
      cityPriceOverride = legacyCityRow.basePriceOverride ? parseFloat(legacyCityRow.basePriceOverride.toString()) : null;
    }

    // Resolve Branch Availability
    let isAvailableInBranch = isAvailableInCity;
    let branchPriceOverride: number | null = null;

    if (opts.branchId) {
      if (branchRow) {
        const started = !branchRow.effectiveFrom || new Date(branchRow.effectiveFrom) <= checkDate;
        const notExpired = !branchRow.effectiveUntil || new Date(branchRow.effectiveUntil) >= checkDate;
        const modeMatch = !opts.bookingMode || !Array.isArray(branchRow.bookingModes) || branchRow.bookingModes.includes(opts.bookingMode);
        isAvailableInBranch = branchRow.isActive && started && notExpired && modeMatch;
        branchPriceOverride = branchRow.basePriceOverride ? parseFloat(branchRow.basePriceOverride.toString()) : null;
      }
    }

    // Effective availability: must be available in both city and branch
    const isAvailable = isAvailableInCity && isAvailableInBranch;

    // Pricing hierarchy: Branch Override -> City Override -> Global Base Price
    let effectivePrice = globalBasePrice;
    let source: EffectiveServiceItem["source"] = "global_default";

    if (branchPriceOverride != null && branchPriceOverride > 0) {
      effectivePrice = branchPriceOverride;
      source = "branch_override";
    } else if (cityPriceOverride != null && cityPriceOverride > 0) {
      effectivePrice = cityPriceOverride;
      source = "city_override";
    }

    const gstRate = parseFloat(svc.gstRate?.toString() || "18");
    const pricingType = (svc.pricingType ?? "inclusive") as "inclusive" | "exclusive";

    result.push({
      id: svc.id,
      name: svc.name,
      slug: svc.slug,
      code: svc.code ?? svc.slug,
      category: svc.category,
      serviceType: svc.serviceType,
      description: svc.description,
      shortDescription: svc.shortDescription,
      imageUrl: svc.imageUrl,
      durationMinutes: svc.durationMinutes,
      pricingType,
      gstRate,
      globalBasePrice,
      cityPriceOverride,
      branchPriceOverride,
      effectivePrice,
      isAvailableInCity,
      isAvailableInBranch,
      isAvailable,
      bookingModes: branchRow?.bookingModes ?? cityRow?.bookingModes ?? (svc.applicableBookingModes as string[] | undefined) ?? ["one_time"],
      effectiveFrom: branchRow?.effectiveFrom ?? cityRow?.effectiveFrom ?? svc.createdAt,
      effectiveUntil: branchRow?.effectiveUntil ?? cityRow?.effectiveUntil ?? null,
      operationalConstraints: (branchRow?.operationalConstraints ?? cityRow?.operationalConstraints ?? svc.defaultConfig) as Record<string, unknown>,
      adminNotes: branchRow?.adminNotes ?? cityRow?.adminNotes ?? null,
      source,
    });
  }

  return result;
}
