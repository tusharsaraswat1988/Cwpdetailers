import {
  db,
  branchesTable,
  servicesTable,
  serviceCityAvailabilityTable,
  serviceBranchOverridesTable,
  type ServiceBranchOverride,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logAdminAudit } from "./audit/adminAuditService";
import { logger } from "./logger";

export type EffectiveBranchService = {
  serviceId: number;
  serviceName: string;
  serviceType: string;
  globalBasePrice: number;
  cityPriceOverride: number | null;
  branchPriceOverride: number | null;
  effectivePrice: number;
  isAvailableInCity: boolean;
  isAvailableInBranch: boolean;
  isAvailable: boolean;
  customSettings: Record<string, unknown> | null;
};

/**
 * Resolves service configuration following the authoritative hierarchy:
 * Global Defaults → City Configuration → Branch Overrides (PRD v3.0, BR-004)
 */
export async function getBranchServiceCatalog(branchId: number): Promise<EffectiveBranchService[]> {
  const [branch] = await db
    .select()
    .from(branchesTable)
    .where(eq(branchesTable.id, branchId))
    .limit(1);

  if (!branch) {
    throw new Error(`Branch ${branchId} not found`);
  }

  // 1. Global Services
  const allServices = await db.select().from(servicesTable).where(eq(servicesTable.isActive, true));

  // 2. City-Level Configuration
  const cityAvailabilities = branch.cityId
    ? await db
        .select()
        .from(serviceCityAvailabilityTable)
        .where(eq(serviceCityAvailabilityTable.cityId, branch.cityId))
    : [];

  const cityMap = new Map<number, (typeof cityAvailabilities)[0]>();
  for (const ca of cityAvailabilities) {
    cityMap.set(ca.serviceId, ca);
  }

  // 3. Branch-Level Overrides
  const branchOverrides = await db
    .select()
    .from(serviceBranchOverridesTable)
    .where(eq(serviceBranchOverridesTable.branchId, branchId));

  const branchOverrideMap = new Map<number, (typeof branchOverrides)[0]>();
  for (const bo of branchOverrides) {
    branchOverrideMap.set(bo.serviceId, bo);
  }

  const branchAllowedSlugs = new Set<string>(
    Array.isArray(branch.serviceAvailability) ? branch.serviceAvailability : [],
  );

  return allServices.map((service) => {
    const globalBasePrice = parseFloat(service.basePrice?.toString() || "0");
    const cityRow = cityMap.get(service.id);
    const branchRow = branchOverrideMap.get(service.id);

    const cityPriceOverride = cityRow?.basePriceOverride ? parseFloat(cityRow.basePriceOverride.toString()) : null;
    const branchPriceOverride = branchRow?.basePriceOverride ? parseFloat(branchRow.basePriceOverride.toString()) : null;

    // Effective price hierarchy: Branch Override -> City Override -> Global Base Price
    const effectivePrice = branchPriceOverride ?? cityPriceOverride ?? globalBasePrice;

    // City availability: if city mapping exists, must be active; if no city mapping, defaults to true
    const isAvailableInCity = cityRow ? cityRow.isActive : true;

    // Branch availability:
    // (a) Must not be explicitly disabled in branch overrides
    const branchOverrideActive = branchRow ? branchRow.isActive : true;
    // (b) If branch.serviceAvailability list is defined and non-empty, must match slug/type
    const branchSlugAllowed =
      branchAllowedSlugs.size === 0 ||
      branchAllowedSlugs.has(service.serviceType) ||
      branchAllowedSlugs.has(service.name.toLowerCase().replace(/\s+/g, "_"));

    const isAvailableInBranch = branchOverrideActive && branchSlugAllowed;
    const isAvailable = isAvailableInCity && isAvailableInBranch;

    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceType: service.serviceType,
      globalBasePrice,
      cityPriceOverride,
      branchPriceOverride,
      effectivePrice,
      isAvailableInCity,
      isAvailableInBranch,
      isAvailable,
      customSettings: (branchRow?.customSettings as Record<string, unknown>) ?? null,
    };
  });
}

/**
 * Upsert branch service pricing or availability override
 */
export async function setBranchServiceOverride(input: {
  branchId: number;
  serviceId: number;
  basePriceOverride?: number;
  isActive?: boolean;
  customSettings?: Record<string, unknown>;
  performedBy: number;
}): Promise<ServiceBranchOverride> {
  const { branchId, serviceId, basePriceOverride, isActive = true, customSettings, performedBy } = input;

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, branchId)).limit(1);
  if (!branch) throw new Error("Branch not found");

  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId)).limit(1);
  if (!service) throw new Error("Service not found");

  const now = new Date();
  const [upserted] = await db
    .insert(serviceBranchOverridesTable)
    .values({
      branchId,
      serviceId,
      basePriceOverride: basePriceOverride != null ? basePriceOverride.toString() : null,
      isActive,
      customSettings: customSettings ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [serviceBranchOverridesTable.serviceId, serviceBranchOverridesTable.branchId],
      set: {
        basePriceOverride: basePriceOverride != null ? basePriceOverride.toString() : null,
        isActive,
        customSettings: customSettings ?? null,
        updatedAt: now,
      },
    })
    .returning();

  await logAdminAudit({
    action: "branch_service_override_updated",
    entityType: "branch",
    entityId: branchId,
    branchId,
    performedBy,
    reason: `Updated branch service override for ${service.name} (price: ${basePriceOverride ?? "default"}, active: ${isActive})`,
    details: { serviceId, serviceName: service.name, basePriceOverride, isActive },
  });

  logger.info(
    { branchId, serviceId, basePriceOverride, isActive, performedBy },
    `Updated branch service override for branch ${branchId}, service ${serviceId}`,
  );

  return upserted!;
}
