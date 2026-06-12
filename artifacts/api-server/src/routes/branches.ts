import { Router } from "express";
import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";

const router = Router();

const BRANCH_SCOPE = {
  companyCol: branchesTable.companyId,
  branchCol: branchesTable.id,
};

router.get("/branches", async (req, res) => {
  try {
    // Anonymous reads (PUBLIC_VIEW) get no scope: serve the unscoped public
    // directory. Authenticated callers are tenant-filtered.
    const conditions = req.scope ? tenantFilters(req, BRANCH_SCOPE) : [];
    const data = await db.select({
      id: branchesTable.id,
      name: branchesTable.name,
      city: branchesTable.city,
      address: branchesTable.address,
      phone: branchesTable.phone,
      managerName: branchesTable.managerName,
      isActive: branchesTable.isActive,
      customerCount: sql<number>`(SELECT COUNT(*) FROM customers c WHERE c.branch_id = ${branchesTable.id})`,
      staffCount: sql<number>`(SELECT COUNT(*) FROM staff s WHERE s.branch_id = ${branchesTable.id})`,
      createdAt: branchesTable.createdAt,
    }).from(branchesTable).where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List branches error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/branches", async (req, res) => {
  try {
    const { name, city, address, phone, managerName } = req.body;
    if (!name || !city) return res.status(400).json({ error: "name and city are required" });
    const values = tenantStamp(req, { name, city, address, phone, managerName }) as typeof branchesTable.$inferInsert;
    const [branch] = await db.insert(branchesTable).values(values).returning();
    return res.status(201).json({ ...branch, customerCount: 0, staffCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create branch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/branches/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(branchesTable).where(eq(branchesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { ...existing, branchId: existing.id })) {
      return res.status(404).json({ error: "Branch not found" });
    }
    const { name, city, address, phone, managerName } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (city !== undefined) updateData.city = city;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (managerName !== undefined) updateData.managerName = managerName;
    const [branch] = await db.update(branchesTable).set(updateData).where(eq(branchesTable.id, id)).returning();
    return res.json(branch);
  } catch (err) {
    req.log.error({ err }, "Update branch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
