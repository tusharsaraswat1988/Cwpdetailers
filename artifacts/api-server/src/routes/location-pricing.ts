import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  locationPricingRulesTable,
  pricingRuleAuditTable,
  servicesTable,
  citiesTable,
  branchesTable,
  operationalZonesTable,
  residentialSocietiesTable,
} from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { assertBranchAccess } from "../middlewares/tenantScope";
import { locationPricingEngine } from "../lib/location-intelligence/pricing/LocationPricingEngine";

const router = Router();

function isSuperOrCentralAdmin(req: Request): boolean {
  const role = req.user?.role;
  return (
    role === "superadmin" ||
    role === "super_admin" ||
    role === "central_admin" ||
    (role === "admin" && !req.user?.branchId)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List Location-Based Pricing Rules
// ─────────────────────────────────────────────────────────────────────────────
router.get("/location-pricing", async (req: Request, res: Response) => {
  try {
    const { cityId, branchId, zoneId, societyId, serviceId, locationType, status, includeInactive } = req.query as Record<string, string>;
    const user = req.user;

    const conditions = [];

    if (includeInactive !== "true") {
      conditions.push(eq(locationPricingRulesTable.isActive, true));
    }

    if (status && status !== "all") {
      conditions.push(eq(locationPricingRulesTable.status, status));
    }

    if (cityId) {
      conditions.push(eq(locationPricingRulesTable.cityId, parseInt(cityId, 10)));
    }

    if (serviceId) {
      conditions.push(eq(locationPricingRulesTable.serviceId, parseInt(serviceId, 10)));
    }

    if (societyId) {
      conditions.push(eq(locationPricingRulesTable.societyId, parseInt(societyId, 10)));
    }

    if (zoneId) {
      conditions.push(eq(locationPricingRulesTable.zoneId, parseInt(zoneId, 10)));
    }

    if (locationType && locationType !== "ALL") {
      conditions.push(eq(locationPricingRulesTable.locationType, locationType));
    }

    // Branch Admin Scoping
    if (user && !isSuperOrCentralAdmin(req) && user.branchId) {
      conditions.push(eq(locationPricingRulesTable.branchId, user.branchId));
    } else if (branchId && branchId !== "all") {
      conditions.push(eq(locationPricingRulesTable.branchId, parseInt(branchId, 10)));
    }

    const rules = await db
      .select({
        id: locationPricingRulesTable.id,
        serviceId: locationPricingRulesTable.serviceId,
        serviceName: servicesTable.name,
        serviceCategory: servicesTable.category,
        packageId: locationPricingRulesTable.packageId,
        cityId: locationPricingRulesTable.cityId,
        cityName: citiesTable.name,
        branchId: locationPricingRulesTable.branchId,
        branchName: branchesTable.name,
        zoneId: locationPricingRulesTable.zoneId,
        zoneName: operationalZonesTable.name,
        zoneCode: operationalZonesTable.code,
        societyId: locationPricingRulesTable.societyId,
        societyName: residentialSocietiesTable.name,
        locationType: locationPricingRulesTable.locationType,
        vehicleCategoryId: locationPricingRulesTable.vehicleCategoryId,
        basePrice: locationPricingRulesTable.basePrice,
        gstRate: locationPricingRulesTable.gstRate,
        pricingType: locationPricingRulesTable.pricingType,
        effectiveFrom: locationPricingRulesTable.effectiveFrom,
        effectiveUntil: locationPricingRulesTable.effectiveUntil,
        status: locationPricingRulesTable.status,
        isActive: locationPricingRulesTable.isActive,
        priority: locationPricingRulesTable.priority,
        notes: locationPricingRulesTable.notes,
        createdAt: locationPricingRulesTable.createdAt,
        updatedAt: locationPricingRulesTable.updatedAt,
      })
      .from(locationPricingRulesTable)
      .leftJoin(servicesTable, eq(locationPricingRulesTable.serviceId, servicesTable.id))
      .leftJoin(citiesTable, eq(locationPricingRulesTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(locationPricingRulesTable.branchId, branchesTable.id))
      .leftJoin(operationalZonesTable, eq(locationPricingRulesTable.zoneId, operationalZonesTable.id))
      .leftJoin(residentialSocietiesTable, eq(locationPricingRulesTable.societyId, residentialSocietiesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(locationPricingRulesTable.priority), desc(locationPricingRulesTable.createdAt));

    return res.json(rules);
  } catch (err) {
    req.log.error({ err }, "Error listing location pricing rules");
    return res.status(500).json({ error: "Failed to list location pricing rules" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create Location-Based Pricing Rule
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/location-pricing",
  requireAuth,
  requirePermission("services", "edit"),
  async (req: Request, res: Response) => {
    try {
      const {
        serviceId,
        packageId,
        cityId,
        branchId,
        zoneId,
        societyId,
        locationType,
        vehicleCategoryId,
        basePrice,
        gstRate,
        pricingType,
        effectiveFrom,
        effectiveUntil,
        status,
        priority,
        notes,
      } = req.body;

      if (!serviceId || !cityId || basePrice == null || parseFloat(basePrice) <= 0) {
        return res.status(400).json({ error: "serviceId, cityId, and a valid basePrice (> 0) are required" });
      }

      // Branch authorization check: non-central admins must have an assigned branch
      let effectiveBranchId = branchId ? parseInt(branchId, 10) : null;
      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId) {
          return res.status(403).json({ error: "Access denied: branch assignment required to configure location pricing" });
        }
        effectiveBranchId = req.user.branchId;
      }

      if (effectiveBranchId != null) {
        assertBranchAccess(req, effectiveBranchId);
      }

    // Calculate priority if not explicitly provided:
    // Level 1: societyId (priority 50)
    // Level 2: zoneId + locationType (priority 40)
    // Level 3: branchId + locationType (priority 30)
    // Level 4: branchId default (priority 20)
    // Level 5: cityId default (priority 10)
    let calculatedPriority = priority != null ? parseInt(priority, 10) : 10;
    if (priority == null) {
      if (societyId) calculatedPriority = 50;
      else if (zoneId && locationType && locationType !== "ALL") calculatedPriority = 40;
      else if (effectiveBranchId && locationType && locationType !== "ALL") calculatedPriority = 30;
      else if (effectiveBranchId) calculatedPriority = 20;
      else calculatedPriority = 10;
    }

    const rule = await db.transaction(async (tx) => {
      const [newRule] = await tx
        .insert(locationPricingRulesTable)
        .values({
          serviceId: parseInt(serviceId, 10),
          packageId: packageId ? parseInt(packageId, 10) : null,
          cityId: parseInt(cityId, 10),
          branchId: effectiveBranchId,
          zoneId: zoneId ? parseInt(zoneId, 10) : null,
          societyId: societyId ? parseInt(societyId, 10) : null,
          locationType: locationType || "ALL",
          vehicleCategoryId: vehicleCategoryId ? parseInt(vehicleCategoryId, 10) : null,
          basePrice: String(basePrice),
          gstRate: gstRate ? String(gstRate) : "18",
          pricingType: pricingType || "inclusive",
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
          status: status || "active",
          priority: calculatedPriority,
          notes: notes?.trim() || null,
          createdBy: req.user?.id ?? null,
          isActive: true,
        })
        .returning();

      // Log Audit within same transaction
      await tx.insert(pricingRuleAuditTable).values({
        ruleId: newRule.id,
        action: "created",
        oldValues: null,
        newValues: newRule as unknown as Record<string, unknown>,
        changedBy: req.user?.id ?? null,
      });

      return newRule;
    });

    return res.status(201).json(rule);
  } catch (err) {
    req.log.error({ err }, "Error creating location pricing rule");
    return res.status(500).json({ error: "Failed to create location pricing rule" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update Location-Based Pricing Rule
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/location-pricing/:id",
  requireAuth,
  requirePermission("services", "edit"),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid pricing rule ID" });

      const [existing] = await db.select().from(locationPricingRulesTable).where(eq(locationPricingRulesTable.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Pricing rule not found" });

      // Branch authorization check: non-central admins can only modify their assigned branch
      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || existing.branchId !== req.user.branchId) {
          return res.status(403).json({ error: "Access denied to pricing rule outside assigned branch" });
        }
        if (existing.branchId != null) {
          assertBranchAccess(req, existing.branchId);
        }
        if (req.body.branchId !== undefined && req.body.branchId !== existing.branchId) {
          return res.status(403).json({ error: "Access denied: cannot reassign pricing rule branch" });
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.basePrice != null) {
        if (parseFloat(req.body.basePrice) <= 0) return res.status(400).json({ error: "basePrice must be > 0" });
        updateData.basePrice = String(req.body.basePrice);
      }
      if (req.body.gstRate !== undefined) updateData.gstRate = String(req.body.gstRate);
      if (req.body.pricingType !== undefined) updateData.pricingType = req.body.pricingType;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.isActive !== undefined) updateData.isActive = Boolean(req.body.isActive);
      if (req.body.effectiveFrom !== undefined) updateData.effectiveFrom = req.body.effectiveFrom ? new Date(req.body.effectiveFrom) : new Date();
      if (req.body.effectiveUntil !== undefined) updateData.effectiveUntil = req.body.effectiveUntil ? new Date(req.body.effectiveUntil) : null;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes?.trim() || null;
      if (req.body.priority !== undefined) updateData.priority = parseInt(req.body.priority, 10);

      const updated = await db.transaction(async (tx) => {
        const [res] = await tx
          .update(locationPricingRulesTable)
          .set(updateData)
          .where(eq(locationPricingRulesTable.id, id))
          .returning();

        await tx.insert(pricingRuleAuditTable).values({
          ruleId: id,
          action: req.body.basePrice != null ? "price_changed" : "updated",
          oldValues: existing as unknown as Record<string, unknown>,
          newValues: res as unknown as Record<string, unknown>,
          changedBy: req.user?.id ?? null,
        });

        return res;
      });

      return res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Error updating location pricing rule");
      return res.status(500).json({ error: "Failed to update location pricing rule" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Deactivate Location Pricing Rule
// ─────────────────────────────────────────────────────────────────────────────
router.delete(
  "/location-pricing/:id",
  requireAuth,
  requirePermission("services", "edit"),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid pricing rule ID" });

      const [existing] = await db.select().from(locationPricingRulesTable).where(eq(locationPricingRulesTable.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Pricing rule not found" });

      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || existing.branchId !== req.user.branchId) {
          return res.status(403).json({ error: "Access denied to pricing rule outside assigned branch" });
        }
        if (existing.branchId != null) {
          assertBranchAccess(req, existing.branchId);
        }
      }

      await db.transaction(async (tx) => {
        const [res] = await tx
          .update(locationPricingRulesTable)
          .set({ isActive: false, status: "archived", updatedAt: new Date() })
          .where(eq(locationPricingRulesTable.id, id))
          .returning();

        await tx.insert(pricingRuleAuditTable).values({
          ruleId: id,
          action: "deactivated",
          oldValues: existing as unknown as Record<string, unknown>,
          newValues: res as unknown as Record<string, unknown>,
          changedBy: req.user?.id ?? null,
        });
      });

      return res.status(204).send();
    } catch (err) {
      req.log.error({ err }, "Error deactivating location pricing rule");
      return res.status(500).json({ error: "Failed to deactivate location pricing rule" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Resolve Applicable Location Price
// ─────────────────────────────────────────────────────────────────────────────
router.post("/location-pricing/resolve", async (req: Request, res: Response) => {
  try {
    const { serviceId, cityId, branchId, zoneId, societyId, locationType, vehicleCategoryId } = req.body;
    if (!serviceId || !cityId) {
      return res.status(400).json({ error: "serviceId and cityId are required" });
    }

    const result = await locationPricingEngine.resolvePrice({
      serviceId: parseInt(serviceId, 10),
      cityId: parseInt(cityId, 10),
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      zoneId: zoneId ? parseInt(zoneId, 10) : undefined,
      societyId: societyId ? parseInt(societyId, 10) : undefined,
      locationType: locationType ?? undefined,
      vehicleCategoryId: vehicleCategoryId ? parseInt(vehicleCategoryId, 10) : undefined,
    });

    req.log.info({
      event: "LOCATION_PRICE_RESOLVED",
      ruleId: result.ruleId,
      serviceId,
      cityId,
      zoneId,
      societyId,
      locationType,
      priorityLevel: result.priorityLevel,
      priorityName: result.priorityName,
      total: result.total,
    }, "Location differential price successfully resolved");

    return res.json(result);
  } catch (err: any) {
    if (err.message?.includes("MISSING_PRICE_CONFIGURATION")) {
      req.log.warn({
        event: "LOCATION_PRICE_MISSING_CONFIGURATION",
        serviceId: req.body?.serviceId,
        cityId: req.body?.cityId,
        zoneId: req.body?.zoneId,
        locationType: req.body?.locationType,
        error: err.message,
      }, "Missing location pricing configuration");
      return res.status(422).json({ error: err.message, status: "MISSING_PRICE_CONFIGURATION" });
    }
    req.log.error({ err }, "Error resolving location pricing");
    return res.status(500).json({ error: "Failed to resolve location pricing" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Audit Trail for Pricing Rule
// ─────────────────────────────────────────────────────────────────────────────
router.get(
  "/location-pricing/:id/audit",
  requireAuth,
  requirePermission("pricing", "view"),
  async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.id as string, 10);
      if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid pricing rule ID" });

      const [rule] = await db
        .select()
        .from(locationPricingRulesTable)
        .where(eq(locationPricingRulesTable.id, ruleId))
        .limit(1);

      if (!rule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }

      // Branch and city authorization check: non-central admins are restricted to their scope
      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId) {
          return res.status(403).json({ error: "Access denied: branch assignment required to view pricing audit logs" });
        }

        // Return 404 to avoid leaking existence of cross-branch pricing rules
        if (rule.branchId == null || rule.branchId !== req.user.branchId) {
          return res.status(404).json({ error: "Pricing rule not found" });
        }

        if (req.user?.cityId && rule.cityId !== req.user.cityId) {
          return res.status(404).json({ error: "Pricing rule not found" });
        }

        assertBranchAccess(req, req.user.branchId);
      }

      const logs = await db
        .select()
        .from(pricingRuleAuditTable)
        .where(eq(pricingRuleAuditTable.ruleId, ruleId))
        .orderBy(desc(pricingRuleAuditTable.createdAt));

      return res.json(logs);
    } catch (err) {
      req.log.error({ err }, "Error fetching pricing rule audit logs");
      return res.status(500).json({ error: "Failed to fetch pricing rule audit logs" });
    }
  },
);

export default router;
