import { Router } from "express";
import { db } from "@workspace/db";
import {
  legalEntitiesTable,
  invoiceNumberSequencesTable,
  branchesTable,
  insertLegalEntitySchema,
  type LegalEntity,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc, asc, inArray } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. List Legal Entities
// ─────────────────────────────────────────────────────────────────────────────
router.get("/legal-entities", async (req, res) => {
  try {
    const { search, q, entityType, isActive } = req.query as Record<string, string>;
    const conditions = [];

    if (isActive !== undefined) {
      conditions.push(eq(legalEntitiesTable.isActive, isActive === "true"));
    }

    if (entityType) {
      conditions.push(eq(legalEntitiesTable.entityType, entityType));
    }

    const searchTerm = (search || q || "").trim();
    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      conditions.push(
        or(
          ilike(legalEntitiesTable.name, pattern),
          ilike(legalEntitiesTable.code, pattern),
          ilike(legalEntitiesTable.tradeName, pattern),
          ilike(legalEntitiesTable.gstin, pattern),
          ilike(legalEntitiesTable.city, pattern),
        ),
      );
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;
    const entities = await db
      .select()
      .from(legalEntitiesTable)
      .where(whereClause)
      .orderBy(desc(legalEntitiesTable.isDefault), asc(legalEntitiesTable.name));

    return res.json({ data: entities, total: entities.length });
  } catch (err) {
    req.log.error({ err }, "Error listing legal entities");
    return res.status(500).json({ error: "Failed to list legal entities" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Legal Entity Details
// ─────────────────────────────────────────────────────────────────────────────
router.get("/legal-entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [entity] = await db
      .select()
      .from(legalEntitiesTable)
      .where(eq(legalEntitiesTable.id, id))
      .limit(1);

    if (!entity) return res.status(404).json({ error: "Legal entity not found" });

    // Fetch associated branches
    const branches = await db
      .select({
        id: branchesTable.id,
        name: branchesTable.name,
        city: branchesTable.city,
        cityId: branchesTable.cityId,
        isActive: branchesTable.isActive,
      })
      .from(branchesTable)
      .where(eq(branchesTable.legalEntityId, id));

    // Fetch associated invoice sequences
    const sequences = await db
      .select()
      .from(invoiceNumberSequencesTable)
      .where(eq(invoiceNumberSequencesTable.legalEntityId, id))
      .orderBy(desc(invoiceNumberSequencesTable.financialYear));

    return res.json({ ...entity, branches, sequences });
  } catch (err) {
    req.log.error({ err }, "Error fetching legal entity");
    return res.status(500).json({ error: "Failed to fetch legal entity" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create Legal Entity
// ─────────────────────────────────────────────────────────────────────────────
router.post("/legal-entities", async (req, res) => {
  try {
    const parsed = insertLegalEntitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation error", details: parsed.error.format() });
    }

    const entityData = parsed.data;

    // Check code uniqueness
    const [existing] = await db
      .select({ id: legalEntitiesTable.id })
      .from(legalEntitiesTable)
      .where(eq(legalEntitiesTable.code, entityData.code.trim().toUpperCase()))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: `Entity code '${entityData.code}' is already registered` });
    }

    if (entityData.isDefault) {
      // Remove default flag from other entities
      await db.update(legalEntitiesTable).set({ isDefault: false, updatedAt: new Date() });
    }

    const [created] = await db
      .insert(legalEntitiesTable)
      .values({
        ...entityData,
        code: entityData.code.trim().toUpperCase(),
        invoicePrefix: entityData.invoicePrefix?.trim().toUpperCase() || "CWP",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Error creating legal entity");
    return res.status(500).json({ error: "Failed to create legal entity" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update Legal Entity
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/legal-entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db
      .select()
      .from(legalEntitiesTable)
      .where(eq(legalEntitiesTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Legal entity not found" });

    const allowedFields = [
      "name", "tradeName", "entityType", "gstin", "panNumber", "stateCode", "stateName",
      "addressLine1", "addressLine2", "city", "pincode", "phone", "email", "website",
      "bankAccountName", "bankName", "bankAccountNumber", "bankIfsc", "bankBranch", "upiId",
      "defaultSac", "invoicePrefix", "isActive", "isDefault", "termsAndConditions",
    ] as const;

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        patch[key] = req.body[key];
      }
    }

    if (patch.isDefault === true) {
      await db.update(legalEntitiesTable).set({ isDefault: false, updatedAt: new Date() });
    }

    const [updated] = await db
      .update(legalEntitiesTable)
      .set(patch)
      .where(eq(legalEntitiesTable.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating legal entity");
    return res.status(500).json({ error: "Failed to update legal entity" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Set Default Legal Entity
// ─────────────────────────────────────────────────────────────────────────────
router.post("/legal-entities/:id/set-default", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.update(legalEntitiesTable).set({ isDefault: false, updatedAt: new Date() });
    const [updated] = await db
      .update(legalEntitiesTable)
      .set({ isDefault: true, isActive: true, updatedAt: new Date() })
      .where(eq(legalEntitiesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Legal entity not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error setting default legal entity");
    return res.status(500).json({ error: "Failed to set default legal entity" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Assign Branches to Legal Entity
// ─────────────────────────────────────────────────────────────────────────────
router.post("/legal-entities/:id/assign-branches", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { branchIds } = req.body as { branchIds: number[] };

    if (!Array.isArray(branchIds)) {
      return res.status(400).json({ error: "branchIds array required" });
    }

    // Set legalEntityId for specified branches
    if (branchIds.length > 0) {
      await db
        .update(branchesTable)
        .set({ legalEntityId: id, updatedAt: new Date() })
        .where(inArray(branchesTable.id, branchIds));
    }

    return res.json({ ok: true, assignedCount: branchIds.length });
  } catch (err) {
    req.log.error({ err }, "Error assigning branches to legal entity");
    return res.status(500).json({ error: "Failed to assign branches" });
  }
});

export default router;
