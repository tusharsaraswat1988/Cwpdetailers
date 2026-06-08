import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, customersTable, staffTable, servicesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: bookingsTable.companyId,
  branchCol: bookingsTable.branchId,
  franchiseeCol: bookingsTable.franchiseeId,
  customerCol: bookingsTable.customerId,
  staffCol: bookingsTable.staffId,
};

const bookingSelect = {
  id: bookingsTable.id,
  customerId: bookingsTable.customerId,
  customerName: customersTable.name,
  customerPhone: customersTable.phone,
  vehicleId: bookingsTable.vehicleId,
  solarSiteId: bookingsTable.solarSiteId,
  subscriptionId: bookingsTable.subscriptionId,
  serviceId: bookingsTable.serviceId,
  serviceName: servicesTable.name,
  staffId: bookingsTable.staffId,
  staffName: staffTable.name,
  branchId: bookingsTable.branchId,
  companyId: bookingsTable.companyId,
  franchiseeId: bookingsTable.franchiseeId,
  scheduledDate: bookingsTable.scheduledDate,
  scheduledTime: bookingsTable.scheduledTime,
  status: bookingsTable.status,
  serviceType: bookingsTable.serviceType,
  address: bookingsTable.address,
  notes: bookingsTable.notes,
  completedAt: bookingsTable.completedAt,
  beforePhotoUrl: bookingsTable.beforePhotoUrl,
  afterPhotoUrl: bookingsTable.afterPhotoUrl,
  technicianNotes: bookingsTable.technicianNotes,
  rating: bookingsTable.rating,
  amount: bookingsTable.amount,
  createdAt: bookingsTable.createdAt,
};

router.get("/bookings/today", async (req, res) => {
  try {
    const { staffId, branchId } = req.query as Record<string, string>;
    const today = new Date().toISOString().split('T')[0];
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      sql`${bookingsTable.scheduledDate}::text = ${today}`,
    ];
    if (staffId) conditions.push(eq(bookingsTable.staffId, parseInt(staffId)));
    if (branchId) conditions.push(eq(bookingsTable.branchId, parseInt(branchId)));

    const data = await db.select(bookingSelect).from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(and(...conditions))
      .orderBy(bookingsTable.scheduledTime);

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Today bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings", async (req, res) => {
  try {
    const { customerId, staffId, date, status, serviceType, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(bookingsTable.customerId, parseInt(customerId)));
    if (staffId) conditions.push(eq(bookingsTable.staffId, parseInt(staffId)));
    if (date) conditions.push(sql`${bookingsTable.scheduledDate}::text = ${date}`);
    if (status) conditions.push(eq(bookingsTable.status, status as (typeof bookingsTable.status)["_"]["data"]));
    if (serviceType) conditions.push(eq(bookingsTable.serviceType, serviceType as (typeof bookingsTable.serviceType)["_"]["data"]));

    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(bookingSelect).from(bookingsTable)
        .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
        .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
        .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
        .where(where).orderBy(desc(bookingsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(bookingsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List bookings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings", async (req, res) => {
  try {
    const { customerId, vehicleId, solarSiteId, subscriptionId, serviceId, staffId, branchId, scheduledDate, scheduledTime, serviceType, address, notes, amount } = req.body;
    if (!customerId || !scheduledDate || !serviceType) {
      return res.status(400).json({ error: "customerId, scheduledDate, and serviceType are required" });
    }

    // Prevent cross-tenant linking: the customer and (optionally) staff must
    // be visible to the caller before we attach a booking to them.
    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    if (staffId) {
      const staff = await loadIfInScope(req,
        () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
        r => ({ ...r, staffId: r.id }),
      );
      if (!staff) return res.status(404).json({ error: "Staff not found" });
    }

    const values = tenantStamp(req, {
      customerId, vehicleId, solarSiteId, subscriptionId, serviceId, staffId, branchId,
      scheduledDate, scheduledTime, serviceType, address, notes,
      amount: amount?.toString(), status: "pending" as const,
    });
    const [booking] = await db.insert(bookingsTable).values(values as typeof bookingsTable.$inferInsert).returning();
    return res.status(201).json(booking);
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select(bookingSelect).from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(eq(bookingsTable.id, id));
    if (!booking || !rowInScope(req, booking)) {
      return res.status(404).json({ error: "Booking not found" });
    }
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Get booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Booking not found" });
    }
    const { status, staffId, scheduledDate, scheduledTime, notes, technicianNotes, beforePhotoUrl, afterPhotoUrl, rating, completedAt } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (staffId !== undefined) updateData.staffId = staffId;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate;
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
    if (notes !== undefined) updateData.notes = notes;
    if (technicianNotes !== undefined) updateData.technicianNotes = technicianNotes;
    if (beforePhotoUrl !== undefined) updateData.beforePhotoUrl = beforePhotoUrl;
    if (afterPhotoUrl !== undefined) updateData.afterPhotoUrl = afterPhotoUrl;
    if (rating !== undefined) updateData.rating = rating;
    if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);
    if (status === "completed" && !completedAt) updateData.completedAt = new Date();

    const [booking] = await db.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Update booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
