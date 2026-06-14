import { Router } from "express";
import { db } from "@workspace/db";
import { complaintsTable, customersTable, staffTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import {
  resolveSupervisorForBooking,
  resolveSupervisorForCustomer,
} from "../lib/supervisor/supervisorContact";

const router = Router();

const SCOPE_COLS = {
  companyCol: complaintsTable.companyId,
  branchCol: complaintsTable.branchId,
  franchiseeCol: complaintsTable.franchiseeId,
  customerCol: complaintsTable.customerId,
};

async function enrichComplaints<T extends { assignedSupervisorId?: number | null; relatedStaffId?: number | null }>(
  rows: T[],
) {
  const supervisorIds = [...new Set(rows.map(r => r.assignedSupervisorId).filter(Boolean))] as number[];
  const staffIds = [...new Set(rows.map(r => r.relatedStaffId).filter(Boolean))] as number[];
  const lookupIds = [...new Set([...supervisorIds, ...staffIds])];

  if (lookupIds.length === 0) {
    return rows.map(r => ({ ...r, assignedSupervisorName: null, relatedStaffName: null }));
  }

  const names = await db
    .select({ id: staffTable.id, name: staffTable.name })
    .from(staffTable)
    .where(inArray(staffTable.id, lookupIds));
  const nameMap = Object.fromEntries(names.map(n => [n.id, n.name]));

  return rows.map(r => ({
    ...r,
    assignedSupervisorName: r.assignedSupervisorId ? nameMap[r.assignedSupervisorId] ?? null : null,
    relatedStaffName: r.relatedStaffId ? nameMap[r.relatedStaffId] ?? null : null,
  }));
}

router.get("/complaints", async (req, res) => {
  try {
    const { customerId, status, assignedSupervisorId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(complaintsTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(complaintsTable.status, status as (typeof complaintsTable.status)["_"]["data"]));
    if (assignedSupervisorId) {
      conditions.push(eq(complaintsTable.assignedSupervisorId, parseInt(assignedSupervisorId)));
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: complaintsTable.id, customerId: complaintsTable.customerId,
        customerName: customersTable.name, bookingId: complaintsTable.bookingId,
        relatedStaffId: complaintsTable.relatedStaffId,
        assignedSupervisorId: complaintsTable.assignedSupervisorId,
        type: complaintsTable.type, title: complaintsTable.title,
        description: complaintsTable.description, status: complaintsTable.status,
        priority: complaintsTable.priority, resolution: complaintsTable.resolution,
        resolvedAt: complaintsTable.resolvedAt, createdAt: complaintsTable.createdAt,
      }).from(complaintsTable)
        .leftJoin(customersTable, eq(complaintsTable.customerId, customersTable.id))
        .where(where).orderBy(desc(complaintsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(complaintsTable).where(where),
    ]);

    const enriched = await enrichComplaints(data);
    return res.json({ data: enriched, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
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

    let relatedStaffId: number | null = null;
    let assignedSupervisorId: number | null = null;

    if (bookingId) {
      const resolved = await resolveSupervisorForBooking(parseInt(String(bookingId), 10));
      relatedStaffId = resolved.relatedStaffId;
      assignedSupervisorId = resolved.supervisor?.id ?? null;
    } else {
      const supervisor = await resolveSupervisorForCustomer(customerId);
      assignedSupervisorId = supervisor?.id ?? null;
    }

    const values = tenantStamp(req, {
      customerId, bookingId, type, title, description, priority: priority || "medium",
      relatedStaffId, assignedSupervisorId,
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
    const { status, priority, resolution, resolvedAt, assignedSupervisorId } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (resolution !== undefined) updateData.resolution = resolution;
    if (resolvedAt !== undefined) updateData.resolvedAt = new Date(resolvedAt);
    if (status === "resolved" && !resolvedAt) updateData.resolvedAt = new Date();
    if (assignedSupervisorId !== undefined) {
      if (assignedSupervisorId === null || assignedSupervisorId === "") {
        updateData.assignedSupervisorId = null;
      } else {
        const supId = parseInt(String(assignedSupervisorId), 10);
        const [sup] = await db.select().from(staffTable).where(eq(staffTable.id, supId)).limit(1);
        if (!sup || sup.staffCategory !== "supervisor") {
          return res.status(400).json({ error: "Assigned supervisor must be a supervisor staff member" });
        }
        updateData.assignedSupervisorId = supId;
      }
    }
    const [complaint] = await db.update(complaintsTable).set(updateData).where(eq(complaintsTable.id, id)).returning();
    return res.json(complaint);
  } catch (err) {
    req.log.error({ err }, "Update complaint error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
