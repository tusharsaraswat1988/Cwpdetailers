import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, customersTable, staffTable } from "@workspace/db";
import { eq, and, inArray, sql } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";

const router = Router();

// Vehicles inherit tenant from their owning customer. We filter via a subquery
// of customer IDs the caller is allowed to see.
async function callerCustomerIds(req: Request): Promise<number[] | null> {
  const s = req.scope;
  if (!s) return [];
  if (s.isSuperAdmin && !s.companyId) return null; // unfiltered
  const ids = await db.select({ id: customersTable.id }).from(customersTable)
    .where(and(...tenantFilters(req, {
      companyCol: customersTable.companyId,
      branchCol: customersTable.branchId,
      franchiseeCol: customersTable.franchiseeId,
      customerCol: customersTable.id,
    })));
  return ids.map(r => r.id);
}

router.get("/vehicles", async (req, res) => {
  try {
    const { customerId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, {
      companyCol: vehiclesTable.companyId,
      branchCol: vehiclesTable.branchId,
      franchiseeCol: vehiclesTable.franchiseeId,
      customerCol: vehiclesTable.customerId,
    })];
    if (customerId) conditions.push(eq(vehiclesTable.customerId, parseInt(customerId)));
    const data = await db.select().from(vehiclesTable).where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List vehicles error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vehicles", async (req, res) => {
  try {
    const { customerId, make, model, year, color, registrationNumber, vehicleType } = req.body;
    if (!customerId || !make || !model || !registrationNumber) {
      return res.status(400).json({ error: "customerId, make, model, and registrationNumber are required" });
    }
    // Verify the customer is visible to the caller before attaching.
    const allowed = await callerCustomerIds(req);
    if (allowed !== null && !allowed.includes(customerId)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const values = tenantStamp(req, {
      customerId, make, model, year, color, registrationNumber, vehicleType,
    });
    const [vehicle] = await db.insert(vehiclesTable).values(values as typeof vehiclesTable.$inferInsert).returning();
    return res.status(201).json(vehicle);
  } catch (err) {
    req.log.error({ err }, "Create vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vehicles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    const { make, model, year, color, registrationNumber, vehicleType, customerId, assignedStaffId } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (year !== undefined) updateData.year = year;
    if (color !== undefined) updateData.color = color;
    if (registrationNumber !== undefined) updateData.registrationNumber = registrationNumber;
    if (vehicleType !== undefined) updateData.vehicleType = vehicleType;
    if (customerId !== undefined) updateData.customerId = customerId;

    if (assignedStaffId !== undefined) {
      if (assignedStaffId === null) {
        updateData.assignedStaffId = null;
      } else {
        const staff = await loadIfInScope(req,
          () => db.select().from(staffTable).where(eq(staffTable.id, assignedStaffId)).limit(1).then(r => r[0]),
          r => ({ ...r, staffId: r.id }),
        );
        if (!staff) return res.status(404).json({ error: "Staff not found" });
        if (staff.verificationStatus !== "verified") {
          return res.status(400).json({ error: "Staff must be verified before assignment" });
        }
        if (existing.branchId && staff.branchId !== existing.branchId) {
          return res.status(400).json({ error: "Staff must belong to the same branch as the vehicle" });
        }
        updateData.assignedStaffId = assignedStaffId;
      }
    }

    const [vehicle] = await db.update(vehiclesTable).set(updateData).where(eq(vehiclesTable.id, id)).returning();
    return res.json(vehicle);
  } catch (err) {
    req.log.error({ err }, "Update vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vehicles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
