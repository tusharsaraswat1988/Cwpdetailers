import { Router } from "express";
import { db } from "@workspace/db";
import { complaintsTable, customersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: complaintsTable.companyId,
  branchCol: complaintsTable.branchId,
  franchiseeCol: complaintsTable.franchiseeId,
  customerCol: complaintsTable.customerId,
};

router.get("/complaints", async (req, res) => {
  try {
    const { customerId, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(complaintsTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(complaintsTable.status, status as (typeof complaintsTable.status)["_"]["data"]));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: complaintsTable.id, customerId: complaintsTable.customerId,
        customerName: customersTable.name, bookingId: complaintsTable.bookingId,
        type: complaintsTable.type, title: complaintsTable.title,
        description: complaintsTable.description, status: complaintsTable.status,
        priority: complaintsTable.priority, resolution: complaintsTable.resolution,
        resolvedAt: complaintsTable.resolvedAt, createdAt: complaintsTable.createdAt,
      }).from(complaintsTable)
        .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
        .where(where).orderBy(desc(complaintsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(complaintsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List complaints error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/complaints", async (req, res) => {
  try {
    const { customerId, bookingId, type, title, description, priority } = req.body;
    if (!customerId || !type || !title || !description) {
      return res.status(400).json({ error: "customerId, type, title, description are required" });
    }
    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const values = tenantStamp(req, {
      customerId, bookingId, type, title, description, priority: priority || "medium",
    });
    const [complaint] = await db.insert(complaintsTable).values(values as typeof complaintsTable.$inferInsert).returning();
    return res.status(201).json(complaint);
  } catch (err) {
    req.log.error({ err }, "Create complaint error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/complaints/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Complaint not found" });
    }
    const { status, priority, resolution, resolvedAt } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (resolvedAt !== undefined) updateData.resolvedAt = new Date(resolvedAt);
    if (status === "resolved" && !resolvedAt) updateData.resolvedAt = new Date();
    const [complaint] = await db.update(complaintsTable).set(updateData).where(eq(complaintsTable.id, id)).returning();
    return res.json(complaint);
  } catch (err) {
    req.log.error({ err }, "Update complaint error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
