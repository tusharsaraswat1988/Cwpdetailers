import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  operationalZonesTable,
  branchZoneMappingsTable,
  zoneCoverageRulesTable,
  branchesTable,
  citiesTable,
  residentialSocietiesTable,
  geographicLocalitiesTable,
} from "@workspace/db";
import { eq, and, sql, desc, asc, ilike } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { assertBranchAccess } from "../middlewares/tenantScope";

const router = Router();

function isSuperOrCentralAdmin(req: Request): boolean {
  const role = req.user?.role;
  return role === "superadmin" || role === "central_admin" || (role === "admin" && !req.user?.branchId);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List Operational Zones
// ─────────────────────────────────────────────────────────────────────────────
router.get("/zones", async (req: Request, res: Response) => {
  try {
    const { cityId, branchId, status, search, includeInactive } = req.query as Record<string, string>;
    const user = req.user;

    const conditions = [];

    if (includeInactive !== "true") {
      conditions.push(eq(operationalZonesTable.isActive, true));
    }

    if (status && status !== "all") {
      conditions.push(eq(operationalZonesTable.status, status));
    }

    if (cityId) {
      conditions.push(eq(operationalZonesTable.cityId, parseInt(cityId, 10)));
    }

    // Branch Admin Scoping
    if (user && !isSuperOrCentralAdmin(req) && user.branchId) {
      conditions.push(eq(operationalZonesTable.branchId, user.branchId));
    } else if (branchId && branchId !== "all") {
      conditions.push(eq(operationalZonesTable.branchId, parseInt(branchId, 10)));
    }

    if (search?.trim()) {
      conditions.push(ilike(operationalZonesTable.name, `%${search.trim()}%`));
    }

    const zones = await db
      .select({
        id: operationalZonesTable.id,
        cityId: operationalZonesTable.cityId,
        cityName: citiesTable.name,
        branchId: operationalZonesTable.branchId,
        branchName: branchesTable.name,
        name: operationalZonesTable.name,
        code: operationalZonesTable.code,
        description: operationalZonesTable.description,
        centerLatitude: operationalZonesTable.centerLatitude,
        centerLongitude: operationalZonesTable.centerLongitude,
        radiusMeters: operationalZonesTable.radiusMeters,
        boundaryGeoJson: operationalZonesTable.boundaryGeoJson,
        status: operationalZonesTable.status,
        isActive: operationalZonesTable.isActive,
        createdAt: operationalZonesTable.createdAt,
        updatedAt: operationalZonesTable.updatedAt,
      })
      .from(operationalZonesTable)
      .leftJoin(citiesTable, eq(operationalZonesTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(operationalZonesTable.branchId, branchesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(operationalZonesTable.cityId), asc(operationalZonesTable.name));

    return res.json(zones);
  } catch (err) {
    req.log.error({ err }, "Error listing operational zones");
    return res.status(500).json({ error: "Failed to list operational zones" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Create Operational Zone
// ─────────────────────────────────────────────────────────────────────────────
router.post(
  "/zones",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const { cityId, branchId, name, code, description, centerLatitude, centerLongitude, radiusMeters, status } = req.body;
      if (!cityId || !name || !code) {
        return res.status(400).json({ error: "cityId, name, and code are required" });
      }

      // Critical authorization rule: missing branch assignment must NEVER mean unrestricted access.
      let effectiveBranchId: number | null = null;
      if (isSuperOrCentralAdmin(req)) {
        effectiveBranchId = branchId ? parseInt(branchId, 10) : null;
      } else {
        if (!req.user?.branchId) {
          return res.status(403).json({ error: "Access denied: branch assignment required to configure operational zones" });
        }
        effectiveBranchId = req.user.branchId;
      }

      if (effectiveBranchId != null) {
        assertBranchAccess(req, effectiveBranchId);
      }

      const [existingCode] = await db
        .select({ id: operationalZonesTable.id })
        .from(operationalZonesTable)
        .where(eq(operationalZonesTable.code, code.trim().toUpperCase()))
        .limit(1);

      if (existingCode) {
        return res.status(409).json({ error: `Zone with code '${code}' already exists` });
      }

      const zone = await db.transaction(async (tx) => {
        const [newZone] = await tx
          .insert(operationalZonesTable)
          .values({
            cityId: parseInt(cityId, 10),
            branchId: effectiveBranchId,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            description: description?.trim() || null,
            centerLatitude: centerLatitude ? parseFloat(centerLatitude) : null,
            centerLongitude: centerLongitude ? parseFloat(centerLongitude) : null,
            radiusMeters: radiusMeters ? parseInt(radiusMeters, 10) : 5000,
            status: status || "active",
            isActive: true,
          })
          .returning();

        // If branchId is provided, also create primary branch-zone mapping within same transaction
        if (effectiveBranchId) {
          await tx
            .insert(branchZoneMappingsTable)
            .values({
              branchId: effectiveBranchId,
              zoneId: newZone.id,
              isPrimary: true,
              isActive: true,
            })
            .onConflictDoNothing();
        }

        return newZone;
      });

      return res.status(201).json(zone);
    } catch (err) {
      req.log.error({ err }, "Error creating operational zone");
      return res.status(500).json({ error: "Failed to create operational zone" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Update Operational Zone
// ─────────────────────────────────────────────────────────────────────────────
router.patch(
  "/zones/:id",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid zone ID" });

      const [existing] = await db.select().from(operationalZonesTable).where(eq(operationalZonesTable.id, id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Zone not found" });

      // Critical authorization rule: missing branch assignment must NEVER mean unrestricted access.
      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || (existing.branchId != null && existing.branchId !== req.user.branchId)) {
          return res.status(403).json({ error: "Access denied to zone outside assigned branch" });
        }
        if (req.user.branchId) {
          assertBranchAccess(req, req.user.branchId);
        }
        // Disallow non-central admin from reassigning zone branch
        if (req.body.branchId !== undefined && req.body.branchId !== existing.branchId) {
          return res.status(403).json({ error: "Access denied: cannot reassign zone branch" });
        }
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.name !== undefined) updateData.name = req.body.name.trim();
      if (req.body.code !== undefined) updateData.code = req.body.code.trim().toUpperCase();
      if (req.body.description !== undefined) updateData.description = req.body.description?.trim() || null;
      if (req.body.branchId !== undefined) updateData.branchId = req.body.branchId ? parseInt(req.body.branchId, 10) : null;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.isActive !== undefined) updateData.isActive = Boolean(req.body.isActive);
      if (req.body.centerLatitude !== undefined) updateData.centerLatitude = req.body.centerLatitude ? parseFloat(req.body.centerLatitude) : null;
      if (req.body.centerLongitude !== undefined) updateData.centerLongitude = req.body.centerLongitude ? parseFloat(req.body.centerLongitude) : null;
      if (req.body.radiusMeters !== undefined) updateData.radiusMeters = req.body.radiusMeters ? parseInt(req.body.radiusMeters, 10) : null;

      const [updated] = await db
        .update(operationalZonesTable)
        .set(updateData)
        .where(eq(operationalZonesTable.id, id))
        .returning();

      return res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Error updating operational zone");
      return res.status(500).json({ error: "Failed to update operational zone" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Zone Coverage Rules (CRUD)
// ─────────────────────────────────────────────────────────────────────────────
router.get("/zones/:id/coverage", async (req: Request, res: Response) => {
  try {
    const zoneId = parseInt(req.params.id as string, 10);
    const rules = await db
      .select({
        id: zoneCoverageRulesTable.id,
        zoneId: zoneCoverageRulesTable.zoneId,
        branchId: zoneCoverageRulesTable.branchId,
        branchName: branchesTable.name,
        coverageType: zoneCoverageRulesTable.coverageType,
        societyId: zoneCoverageRulesTable.societyId,
        societyName: residentialSocietiesTable.name,
        localityId: zoneCoverageRulesTable.localityId,
        localityName: geographicLocalitiesTable.name,
        pincode: zoneCoverageRulesTable.pincode,
        propertyType: zoneCoverageRulesTable.propertyType,
        serviceId: zoneCoverageRulesTable.serviceId,
        status: zoneCoverageRulesTable.status,
        rejectionReason: zoneCoverageRulesTable.rejectionReason,
        priority: zoneCoverageRulesTable.priority,
        isActive: zoneCoverageRulesTable.isActive,
        createdAt: zoneCoverageRulesTable.createdAt,
      })
      .from(zoneCoverageRulesTable)
      .leftJoin(branchesTable, eq(zoneCoverageRulesTable.branchId, branchesTable.id))
      .leftJoin(residentialSocietiesTable, eq(zoneCoverageRulesTable.societyId, residentialSocietiesTable.id))
      .leftJoin(geographicLocalitiesTable, eq(zoneCoverageRulesTable.localityId, geographicLocalitiesTable.id))
      .where(
        and(
          eq(zoneCoverageRulesTable.zoneId, zoneId),
          eq(zoneCoverageRulesTable.isActive, true),
        ),
      )
      .orderBy(desc(zoneCoverageRulesTable.priority), desc(zoneCoverageRulesTable.createdAt));

    return res.json(rules);
  } catch (err) {
    req.log.error({ err }, "Error listing zone coverage rules");
    return res.status(500).json({ error: "Failed to list zone coverage rules" });
  }
});

router.post(
  "/zones/:id/coverage",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const zoneId = parseInt(req.params.id as string, 10);
      if (isNaN(zoneId)) return res.status(400).json({ error: "Invalid zone ID" });

      const [zone] = await db.select().from(operationalZonesTable).where(eq(operationalZonesTable.id, zoneId)).limit(1);
      if (!zone) return res.status(404).json({ error: "Zone not found" });

      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || (zone.branchId != null && zone.branchId !== req.user.branchId)) {
          return res.status(403).json({ error: "Access denied to zone outside assigned branch" });
        }
        if (req.user.branchId) {
          assertBranchAccess(req, req.user.branchId);
        }
      }

      const { coverageType, societyId, localityId, pincode, propertyType, serviceId, branchId, status, rejectionReason, priority } = req.body;

      if (!coverageType) {
        return res.status(400).json({ error: "coverageType is required ('society', 'locality', 'pincode', 'property_type', 'all')" });
      }

      let effectiveRuleBranchId = branchId ? parseInt(branchId, 10) : (zone.branchId ?? null);
      if (!isSuperOrCentralAdmin(req) && req.user?.branchId) {
        effectiveRuleBranchId = req.user.branchId;
      }

      const [rule] = await db
        .insert(zoneCoverageRulesTable)
        .values({
          zoneId,
          branchId: effectiveRuleBranchId,
          coverageType,
          societyId: societyId ? parseInt(societyId, 10) : null,
          localityId: localityId ? parseInt(localityId, 10) : null,
          pincode: pincode?.trim() || null,
          propertyType: propertyType || "ALL",
          serviceId: serviceId ? parseInt(serviceId, 10) : null,
          status: status || "serviceable",
          rejectionReason: rejectionReason?.trim() || null,
          priority: priority ? parseInt(priority, 10) : 10,
          isActive: true,
        })
        .returning();

      return res.status(201).json(rule);
    } catch (err) {
      req.log.error({ err }, "Error creating zone coverage rule");
      return res.status(500).json({ error: "Failed to create zone coverage rule" });
    }
  },
);

router.delete(
  "/zones/coverage/:ruleId",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const ruleId = parseInt(req.params.ruleId as string, 10);
      if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid coverage rule ID" });

      const [rule] = await db.select().from(zoneCoverageRulesTable).where(eq(zoneCoverageRulesTable.id, ruleId)).limit(1);
      if (!rule) return res.status(404).json({ error: "Coverage rule not found" });

      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || (rule.branchId != null && rule.branchId !== req.user.branchId)) {
          return res.status(403).json({ error: "Access denied to coverage rule outside assigned branch" });
        }
        if (req.user.branchId) {
          assertBranchAccess(req, req.user.branchId);
        }
      }

      await db
        .update(zoneCoverageRulesTable)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(zoneCoverageRulesTable.id, ruleId));

      return res.status(204).send();
    } catch (err) {
      req.log.error({ err }, "Error deleting zone coverage rule");
      return res.status(500).json({ error: "Failed to delete zone coverage rule" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Branch-Zone Mappings
// ─────────────────────────────────────────────────────────────────────────────
router.get("/zones/branch-mappings", async (req: Request, res: Response) => {
  try {
    const { branchId, zoneId } = req.query as Record<string, string>;
    const conditions = [eq(branchZoneMappingsTable.isActive, true)];

    if (branchId) conditions.push(eq(branchZoneMappingsTable.branchId, parseInt(branchId, 10)));
    if (zoneId) conditions.push(eq(branchZoneMappingsTable.zoneId, parseInt(zoneId, 10)));

    const mappings = await db
      .select({
        id: branchZoneMappingsTable.id,
        branchId: branchZoneMappingsTable.branchId,
        branchName: branchesTable.name,
        zoneId: branchZoneMappingsTable.zoneId,
        zoneName: operationalZonesTable.name,
        zoneCode: operationalZonesTable.code,
        isPrimary: branchZoneMappingsTable.isPrimary,
        effectiveFrom: branchZoneMappingsTable.effectiveFrom,
        effectiveUntil: branchZoneMappingsTable.effectiveUntil,
        isActive: branchZoneMappingsTable.isActive,
      })
      .from(branchZoneMappingsTable)
      .innerJoin(branchesTable, eq(branchZoneMappingsTable.branchId, branchesTable.id))
      .innerJoin(operationalZonesTable, eq(branchZoneMappingsTable.zoneId, operationalZonesTable.id))
      .where(and(...conditions));

    return res.json(mappings);
  } catch (err) {
    req.log.error({ err }, "Error listing branch-zone mappings");
    return res.status(500).json({ error: "Failed to list branch-zone mappings" });
  }
});

router.post(
  "/zones/branch-mappings",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const { branchId, zoneId, isPrimary } = req.body;
      if (!branchId || !zoneId) {
        return res.status(400).json({ error: "branchId and zoneId are required" });
      }

      const bId = parseInt(branchId, 10);
      const zId = parseInt(zoneId, 10);

      if (!isSuperOrCentralAdmin(req)) {
        if (!req.user?.branchId || bId !== req.user.branchId) {
          return res.status(403).json({ error: "Access denied to map zones outside assigned branch" });
        }
        assertBranchAccess(req, bId);
      }

      const [mapping] = await db
        .insert(branchZoneMappingsTable)
        .values({
          branchId: bId,
          zoneId: zId,
          isPrimary: isPrimary !== undefined ? Boolean(isPrimary) : true,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [branchZoneMappingsTable.branchId, branchZoneMappingsTable.zoneId],
          set: {
            isPrimary: isPrimary !== undefined ? Boolean(isPrimary) : true,
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning();

      return res.status(201).json(mapping);
    } catch (err) {
      req.log.error({ err }, "Error creating branch-zone mapping");
      return res.status(500).json({ error: "Failed to create branch-zone mapping" });
    }
  },
);

export default router;
