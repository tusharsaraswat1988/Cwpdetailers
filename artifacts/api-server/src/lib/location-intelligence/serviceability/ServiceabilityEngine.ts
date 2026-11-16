import { db } from "@workspace/db";
import {
  citiesTable,
  branchesTable,
  operationalZonesTable,
  zoneCoverageRulesTable,
  serviceCityAvailabilityTable,
  serviceAvailabilityMatrixTable,
  servicesTable,
  residentialSocietiesTable,
  operationalClosuresTable,
} from "@workspace/db";
import { eq, and, or, sql, lte, gte } from "drizzle-orm";
import type { LocationResolveOutput, PropertyLocationType } from "../resolver/LocationResolver";

export type ServiceabilityStatus =
  | "SERVICEABLE"
  | "NOT_SERVICEABLE"
  | "WAITLIST"
  | "COMING_SOON"
  | "TEMPORARILY_CLOSED";

export interface ServiceabilityInput {
  cityId?: number | null;
  branchId?: number | null;
  zoneId?: number | null;
  societyId?: number | null;
  localityId?: number | null;
  pincode?: string | null;
  propertyType?: PropertyLocationType | string | null;
  serviceId?: number | null;
  scheduledDate?: string | null; // 'YYYY-MM-DD'
  resolvedLocation?: LocationResolveOutput | null;
}

export interface ServiceabilityOutput {
  isServiceable: boolean;
  status: ServiceabilityStatus;
  cityId: number | null;
  branchId: number | null;
  zoneId: number | null;
  societyId: number | null;
  localityId: number | null;
  propertyType: PropertyLocationType;
  availableServices: Array<{ id: number; name: string; slug: string; category?: string }>;
  rejectionReason: string | null;
  matchedRuleId: number | null;
  operationalNotes?: string | null;
}

export class ServiceabilityEngine {
  async evaluate(input: ServiceabilityInput): Promise<ServiceabilityOutput> {
    const loc = input.resolvedLocation;
    const cityId = input.cityId ?? loc?.cityId ?? null;
    const branchId = input.branchId ?? loc?.branchId ?? null;
    const zoneId = input.zoneId ?? loc?.zoneId ?? null;
    const societyId = input.societyId ?? loc?.societyId ?? null;
    const localityId = input.localityId ?? loc?.localityId ?? null;
    const pincode = input.pincode ?? null;
    const propertyType: PropertyLocationType = (input.propertyType as PropertyLocationType) || loc?.propertyType || "OTHER";

    // 1. Fail Closed: If City is missing or inactive
    if (!cityId) {
      return this.reject({
        cityId, branchId, zoneId, societyId, localityId, propertyType,
        reason: "City could not be identified or is not supported.",
        status: "NOT_SERVICEABLE",
      });
    }

    const [city] = await db
      .select({ id: citiesTable.id, name: citiesTable.name, status: citiesTable.status, isActive: citiesTable.isActive })
      .from(citiesTable)
      .where(eq(citiesTable.id, cityId))
      .limit(1);

    const isCityActive = city && city.isActive && (city.status === "active" || !city.status);
    if (!isCityActive) {
      return this.reject({
        cityId, branchId, zoneId, societyId, localityId, propertyType,
        reason: `CWP Detailers is not yet actively operating in ${city?.name || "this city"}.`,
        status: city?.status === "ready_for_launch" ? "COMING_SOON" : "NOT_SERVICEABLE",
      });
    }

    // 2. Operational Closure Check (Operational Calendar Integration)
    if (input.scheduledDate) {
      const activeClosures = await db
        .select({
          id: operationalClosuresTable.id,
          title: operationalClosuresTable.title,
          customerReason: operationalClosuresTable.customerReason,
          isFullDay: operationalClosuresTable.isFullDay,
          exemptSegments: operationalClosuresTable.exemptSegments,
        })
        .from(operationalClosuresTable)
        .where(
          and(
            eq(operationalClosuresTable.isActive, true),
            lte(operationalClosuresTable.startDate, input.scheduledDate),
            gte(operationalClosuresTable.endDate, input.scheduledDate),
            or(
              eq(operationalClosuresTable.scopeType, "global"),
              and(eq(operationalClosuresTable.scopeType, "city"), eq(operationalClosuresTable.cityId, cityId)),
              branchId ? and(eq(operationalClosuresTable.scopeType, "branch"), eq(operationalClosuresTable.branchId, branchId)) : sql`FALSE`,
            ),
          ),
        );

      if (activeClosures.length > 0) {
        const closure = activeClosures[0];
        // Check if daily_cleaning is exempt if service is DCMS
        const isDcmsExempt = closure.exemptSegments?.includes("daily_cleaning");
        if (!isDcmsExempt) {
          return this.reject({
            cityId, branchId, zoneId, societyId, localityId, propertyType,
            reason: closure.customerReason || `Operations closed on ${input.scheduledDate}: ${closure.title}`,
            status: "TEMPORARILY_CLOSED",
          });
        }
      }
    }

    // 3. Society Status Check (if GATED_SOCIETY)
    if (societyId) {
      const [soc] = await db
        .select({ id: residentialSocietiesTable.id, name: residentialSocietiesTable.name, isActive: residentialSocietiesTable.isActive })
        .from(residentialSocietiesTable)
        .where(eq(residentialSocietiesTable.id, societyId))
        .limit(1);

      if (!soc || !soc.isActive) {
        return this.reject({
          cityId, branchId, zoneId, societyId, localityId, propertyType,
          reason: `Residential society '${soc?.name || societyId}' is not currently active for service.`,
          status: "WAITLIST",
        });
      }
    }

    // 4. Operational Zone Status Check
    if (zoneId) {
      const [zone] = await db
        .select({ id: operationalZonesTable.id, name: operationalZonesTable.name, status: operationalZonesTable.status, isActive: operationalZonesTable.isActive })
        .from(operationalZonesTable)
        .where(eq(operationalZonesTable.id, zoneId))
        .limit(1);

      if (!zone || !zone.isActive || zone.status !== "active") {
        return this.reject({
          cityId, branchId, zoneId, societyId, localityId, propertyType,
          reason: `Operational zone '${zone?.name || zoneId}' is currently under maintenance or inactive.`,
          status: "TEMPORARILY_CLOSED",
        });
      }
    }

    // 5. Explicit Zone Coverage Rules Evaluation (Priority Order)
    let matchedCoverageRule: {
      id: number;
      status: string;
      rejectionReason: string | null;
      branchId: number | null;
    } | null = null;

    if (zoneId) {
      const coverageRules = await db
        .select({
          id: zoneCoverageRulesTable.id,
          coverageType: zoneCoverageRulesTable.coverageType,
          societyId: zoneCoverageRulesTable.societyId,
          localityId: zoneCoverageRulesTable.localityId,
          pincode: zoneCoverageRulesTable.pincode,
          propertyType: zoneCoverageRulesTable.propertyType,
          serviceId: zoneCoverageRulesTable.serviceId,
          status: zoneCoverageRulesTable.status,
          rejectionReason: zoneCoverageRulesTable.rejectionReason,
          priority: zoneCoverageRulesTable.priority,
          branchId: zoneCoverageRulesTable.branchId,
        })
        .from(zoneCoverageRulesTable)
        .where(
          and(
            eq(zoneCoverageRulesTable.zoneId, zoneId),
            eq(zoneCoverageRulesTable.isActive, true),
          ),
        )
        .orderBy(sql`${zoneCoverageRulesTable.priority} DESC`);

      for (const rule of coverageRules) {
        // Service filter match
        if (rule.serviceId && input.serviceId && rule.serviceId !== input.serviceId) {
          continue;
        }

        // Property type match
        if (rule.propertyType !== "ALL" && rule.propertyType !== propertyType) {
          continue;
        }

        // Specific entity match
        if (rule.coverageType === "society" && rule.societyId) {
          if (societyId && rule.societyId === societyId) {
            matchedCoverageRule = rule;
            break;
          }
        } else if (rule.coverageType === "locality" && rule.localityId) {
          if (localityId && rule.localityId === localityId) {
            matchedCoverageRule = rule;
            break;
          }
        } else if (rule.coverageType === "pincode" && rule.pincode) {
          if (pincode && rule.pincode.trim() === pincode.trim()) {
            matchedCoverageRule = rule;
            break;
          }
        } else if (rule.coverageType === "property_type" || rule.coverageType === "all") {
          matchedCoverageRule = rule;
          break;
        }
      }

      // Fail-closed: If coverage rules are configured for this zone but none matched this property/society/locality
      if (coverageRules.length > 0 && !matchedCoverageRule) {
        return this.reject({
          cityId, branchId, zoneId, societyId, localityId, propertyType,
          reason: `Doorstep car cleaning is not currently active for ${propertyType === "GATED_SOCIETY" ? "this society" : "this property type"} in this zone.`,
          status: "NOT_SERVICEABLE",
        });
      }
    } else if (!societyId && cityId) {
      // For locations without a resolved zone or society:
      // If the city has operational zones configured, an unzoned location must fail closed.
      const [cityZone] = await db
        .select({ id: operationalZonesTable.id })
        .from(operationalZonesTable)
        .where(
          and(
            eq(operationalZonesTable.cityId, cityId),
            eq(operationalZonesTable.isActive, true),
          ),
        )
        .limit(1);

      if (cityZone) {
        return this.reject({
          cityId, branchId, zoneId, societyId, localityId, propertyType,
          reason: pincode
            ? `Pincode ${pincode} is outside active operational zones for ${city?.name || "this city"}.`
            : `Location is outside active operational zones for ${city?.name || "this city"}.`,
          status: "NOT_SERVICEABLE",
        });
      }
      // Otherwise, in cities without operational zones (e.g. legacy Varanasi), traditional city/PIN coverage governs.
    }

    // If an explicit rule exists and is NOT serviceable
    if (matchedCoverageRule && matchedCoverageRule.status !== "serviceable") {
      const ruleStatus = matchedCoverageRule.status === "waitlist"
        ? "WAITLIST"
        : matchedCoverageRule.status === "coming_soon"
          ? "COMING_SOON"
          : "NOT_SERVICEABLE";

      return this.reject({
        cityId, branchId: matchedCoverageRule.branchId ?? branchId, zoneId, societyId, localityId, propertyType,
        reason: matchedCoverageRule.rejectionReason || "Location is currently marked as not serviceable by operational coverage rule.",
        status: ruleStatus,
        matchedRuleId: matchedCoverageRule.id,
      });
    }

    // 6. Branch Status Check
    const effectiveBranchId = matchedCoverageRule?.branchId ?? branchId;
    if (effectiveBranchId) {
      const [branch] = await db
        .select({ id: branchesTable.id, name: branchesTable.name, status: branchesTable.status, isActive: branchesTable.isActive })
        .from(branchesTable)
        .where(eq(branchesTable.id, effectiveBranchId))
        .limit(1);

      if (branch && (!branch.isActive || branch.status !== "active")) {
        return this.reject({
          cityId, branchId: effectiveBranchId, zoneId, societyId, localityId, propertyType,
          reason: `Serving branch '${branch.name}' is currently suspended or inactive.`,
          status: "TEMPORARILY_CLOSED",
        });
      }
    }

    // 7. Resolve Available Services for City & Branch via ServiceAvailabilityRepository
    let availableServices: Array<{ id: number; name: string; slug: string; category?: string }> = [];
    if (cityId) {
      try {
        const { coverageRepository } = await import("../../coverage/repositories/CoverageRepository");
        if (input.serviceId) {
          const isAvailable = await coverageRepository.serviceAvailability.isServiceAvailableInCity(
            input.serviceId,
            cityId,
          );
          if (!isAvailable) {
            return this.reject({
              cityId, branchId: effectiveBranchId, zoneId, societyId, localityId, propertyType,
              reason: "Requested service is not enabled for this city.",
              status: "NOT_SERVICEABLE",
            });
          }
        }
        const catalog = await coverageRepository.serviceAvailability.getCityServiceCatalog(cityId);
        availableServices = catalog.availableServices.map(s => ({
          id: s.id,
          name: s.name,
          slug: s.slug || "",
          category: s.category,
        }));
      } catch {
        // Fallback gracefully if repository fails
      }
    }

    return {
      isServiceable: true,
      status: "SERVICEABLE",
      cityId,
      branchId: effectiveBranchId,
      zoneId,
      societyId,
      localityId,
      propertyType,
      availableServices,
      rejectionReason: null,
      matchedRuleId: matchedCoverageRule?.id ?? null,
    };
  }

  private reject(opts: {
    cityId: number | null;
    branchId: number | null;
    zoneId: number | null;
    societyId: number | null;
    localityId: number | null;
    propertyType: PropertyLocationType;
    reason: string;
    status: ServiceabilityStatus;
    matchedRuleId?: number | null;
  }): ServiceabilityOutput {
    return {
      isServiceable: false,
      status: opts.status,
      cityId: opts.cityId,
      branchId: opts.branchId,
      zoneId: opts.zoneId,
      societyId: opts.societyId,
      localityId: opts.localityId,
      propertyType: opts.propertyType,
      availableServices: [],
      rejectionReason: opts.reason,
      matchedRuleId: opts.matchedRuleId ?? null,
    };
  }
}

export const serviceabilityEngine = new ServiceabilityEngine();
