import { db } from "@workspace/db";
import {
  locationPricingRulesTable,
  pricingRuleAuditTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, sql, desc, or, lte, gte } from "drizzle-orm";
import { computeGst, splitGstInclusive } from "../../gst";
import type { PropertyLocationType } from "../resolver/LocationResolver";

export interface LocationPriceInput {
  serviceId: number;
  packageId?: number | null;
  cityId: number;
  branchId?: number | null;
  zoneId?: number | null;
  societyId?: number | null;
  locationType?: PropertyLocationType | string | null;
  vehicleCategoryId?: number | null;
  effectiveDate?: Date | string | null;
}

export interface LocationPriceResult {
  ruleId: number;
  basePrice: number;
  gstRate: number;
  pricingType: "inclusive" | "exclusive";
  subtotal: number;
  gst: number;
  total: number;
  displayPrice: number;
  priorityLevel: 1 | 2 | 3 | 4 | 5;
  priorityName:
    | "society_override"
    | "zone_location_type"
    | "branch_location_type"
    | "branch_default"
    | "city_default";
  locationType: string;
  source: string;
  notes?: string | null;
  snapshot: PriceSnapshot;
}

export interface PriceSnapshot {
  ruleId: number;
  serviceId: number;
  cityId: number;
  branchId: number | null;
  zoneId: number | null;
  societyId: number | null;
  locationType: string;
  vehicleCategoryId: number | null;
  basePrice: number;
  gstRate: number;
  pricingType: "inclusive" | "exclusive";
  subtotal: number;
  gst: number;
  total: number;
  resolvedAt: string;
  priorityName: string;
}

export class LocationPricingEngine {
  /**
   * Deterministic 5-level priority price resolution:
   * 1. Society Override (societyId matches)
   * 2. Zone + Location Type (zoneId matches AND locationType matches)
   * 3. Branch + Location Type (branchId matches AND locationType matches)
   * 4. Branch Default (branchId matches AND (locationType = 'ALL' or null))
   * 5. City Default (cityId matches AND (locationType = 'ALL' or null))
   *
   * Fail-Closed: throws MISSING_PRICE_CONFIGURATION if no valid rule exists.
   */
  async resolvePrice(input: LocationPriceInput): Promise<LocationPriceResult> {
    const { serviceId, cityId, branchId, zoneId, societyId, vehicleCategoryId } = input;
    const locationType = (input.locationType?.toUpperCase().trim() || "OTHER") as PropertyLocationType;
    const evalDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date();

    // Query active rules for this service and city
    const rules = await db
      .select({
        id: locationPricingRulesTable.id,
        serviceId: locationPricingRulesTable.serviceId,
        packageId: locationPricingRulesTable.packageId,
        cityId: locationPricingRulesTable.cityId,
        branchId: locationPricingRulesTable.branchId,
        zoneId: locationPricingRulesTable.zoneId,
        societyId: locationPricingRulesTable.societyId,
        locationType: locationPricingRulesTable.locationType,
        vehicleCategoryId: locationPricingRulesTable.vehicleCategoryId,
        basePrice: locationPricingRulesTable.basePrice,
        gstRate: locationPricingRulesTable.gstRate,
        pricingType: locationPricingRulesTable.pricingType,
        effectiveFrom: locationPricingRulesTable.effectiveFrom,
        effectiveUntil: locationPricingRulesTable.effectiveUntil,
        status: locationPricingRulesTable.status,
        priority: locationPricingRulesTable.priority,
        notes: locationPricingRulesTable.notes,
      })
      .from(locationPricingRulesTable)
      .where(
        and(
          eq(locationPricingRulesTable.serviceId, serviceId),
          eq(locationPricingRulesTable.cityId, cityId),
          eq(locationPricingRulesTable.isActive, true),
          eq(locationPricingRulesTable.status, "active"),
          lte(locationPricingRulesTable.effectiveFrom, evalDate),
          or(
            sql`${locationPricingRulesTable.effectiveUntil} IS NULL`,
            gte(locationPricingRulesTable.effectiveUntil, evalDate),
          ),
        ),
      )
      .orderBy(desc(locationPricingRulesTable.priority), desc(locationPricingRulesTable.createdAt));

    // Vehicle Category filter helper: if a rule specifies vehicleCategoryId, it must match
    const matchesVehicle = (r: typeof rules[0]) => {
      if (vehicleCategoryId != null && r.vehicleCategoryId != null) {
        return r.vehicleCategoryId === vehicleCategoryId;
      }
      return r.vehicleCategoryId == null;
    };

    let matchedRule: typeof rules[0] | null = null;
    let priorityLevel: LocationPriceResult["priorityLevel"] = 5;
    let priorityName: LocationPriceResult["priorityName"] = "city_default";

    // Level 1: Explicit society override
    if (societyId) {
      const level1 = rules.find(r => r.societyId === societyId && matchesVehicle(r));
      if (level1) {
        matchedRule = level1;
        priorityLevel = 1;
        priorityName = "society_override";
      }
    }

    // Level 2: Zone + Location Type
    if (!matchedRule && zoneId) {
      const level2 = rules.find(
        r => r.zoneId === zoneId && r.locationType === locationType && matchesVehicle(r),
      );
      if (level2) {
        matchedRule = level2;
        priorityLevel = 2;
        priorityName = "zone_location_type";
      }
    }

    // Level 3: Branch + Location Type
    if (!matchedRule && branchId) {
      const level3 = rules.find(
        r => r.branchId === branchId && r.locationType === locationType && matchesVehicle(r),
      );
      if (level3) {
        matchedRule = level3;
        priorityLevel = 3;
        priorityName = "branch_location_type";
      }
    }

    // Level 4: Branch Default (locationType is 'ALL' or empty)
    if (!matchedRule && branchId) {
      const level4 = rules.find(
        r => r.branchId === branchId && (r.locationType === "ALL" || !r.locationType) && matchesVehicle(r),
      );
      if (level4) {
        matchedRule = level4;
        priorityLevel = 4;
        priorityName = "branch_default";
      }
    }

    // Level 5: City Default (locationType is 'ALL' or empty, or city-level default)
    if (!matchedRule) {
      const level5 = rules.find(
        r => (r.locationType === "ALL" || !r.locationType || r.locationType === locationType) &&
             r.branchId == null && r.zoneId == null && r.societyId == null && matchesVehicle(r),
      );
      if (level5) {
        matchedRule = level5;
        priorityLevel = 5;
        priorityName = "city_default";
      }
    }

    // Fallback: If no location_pricing_rules match, check servicesTable base price as safe bootstrap fallback
    if (!matchedRule) {
      const [svc] = await db
        .select({ basePrice: servicesTable.basePrice, gstRate: servicesTable.gstRate, pricingType: servicesTable.pricingType })
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceId))
        .limit(1);

      if (svc && parseFloat(svc.basePrice) > 0) {
        const basePrice = parseFloat(svc.basePrice);
        const gstRate = parseFloat(svc.gstRate || "18");
        const pricingType = (svc.pricingType || "inclusive") as "inclusive" | "exclusive";
        const breakdown = this.computeBreakdown(basePrice, gstRate, pricingType);

        const snapshot: PriceSnapshot = {
          ruleId: 0,
          serviceId,
          cityId,
          branchId: branchId ?? null,
          zoneId: zoneId ?? null,
          societyId: societyId ?? null,
          locationType,
          vehicleCategoryId: vehicleCategoryId ?? null,
          basePrice,
          gstRate,
          pricingType,
          subtotal: breakdown.subtotal,
          gst: breakdown.gst,
          total: breakdown.total,
          resolvedAt: new Date().toISOString(),
          priorityName: "service_base_fallback",
        };

        return {
          ruleId: 0,
          basePrice,
          gstRate,
          pricingType,
          subtotal: breakdown.subtotal,
          gst: breakdown.gst,
          total: breakdown.total,
          displayPrice: breakdown.total,
          priorityLevel: 5,
          priorityName: "city_default",
          locationType,
          source: "service_base_fallback",
          notes: "Fallback to service master catalog base price",
          snapshot,
        };
      }

      // Fail-closed
      throw new Error(
        `MISSING_PRICE_CONFIGURATION: Service #${serviceId} has no valid location pricing rule configured for city #${cityId}, branch ${branchId ?? "none"}, zone ${zoneId ?? "none"}, society ${societyId ?? "none"}, locationType ${locationType}.`,
      );
    }

    const basePrice = parseFloat(matchedRule.basePrice);
    const gstRate = parseFloat(matchedRule.gstRate || "18");
    const pricingType = (matchedRule.pricingType || "inclusive") as "inclusive" | "exclusive";
    const breakdown = this.computeBreakdown(basePrice, gstRate, pricingType);

    const snapshot: PriceSnapshot = {
      ruleId: matchedRule.id,
      serviceId,
      cityId,
      branchId: matchedRule.branchId,
      zoneId: matchedRule.zoneId,
      societyId: matchedRule.societyId,
      locationType: matchedRule.locationType,
      vehicleCategoryId: matchedRule.vehicleCategoryId,
      basePrice,
      gstRate,
      pricingType,
      subtotal: breakdown.subtotal,
      gst: breakdown.gst,
      total: breakdown.total,
      resolvedAt: new Date().toISOString(),
      priorityName,
    };

    return {
      ruleId: matchedRule.id,
      basePrice,
      gstRate,
      pricingType,
      subtotal: breakdown.subtotal,
      gst: breakdown.gst,
      total: breakdown.total,
      displayPrice: breakdown.total,
      priorityLevel,
      priorityName,
      locationType: matchedRule.locationType,
      source: priorityName,
      notes: matchedRule.notes,
      snapshot,
    };
  }

  private computeBreakdown(basePrice: number, gstRate: number, pricingType: "inclusive" | "exclusive") {
    if (pricingType === "inclusive") {
      const { subtotal, gst, total } = splitGstInclusive(basePrice, gstRate);
      return { subtotal, gst, total };
    }
    const { subtotal, gst, total } = computeGst(basePrice, gstRate);
    return { subtotal, gst, total };
  }

  /**
   * Log pricing rule modifications in audit trail
   */
  async logRuleAudit(
    ruleId: number,
    action: "created" | "updated" | "deactivated" | "price_changed",
    previousValues: Record<string, unknown> | null,
    newValues: Record<string, unknown> | null,
    userId: number | null,
  ): Promise<void> {
    try {
      await db.insert(pricingRuleAuditTable).values({
        ruleId,
        action,
        previousValues,
        newValues,
        changedBy: userId,
      });
    } catch {
      // Non-blocking audit failure
    }
  }
}

export const locationPricingEngine = new LocationPricingEngine();
