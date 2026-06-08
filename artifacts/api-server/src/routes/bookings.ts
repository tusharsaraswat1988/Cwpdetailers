import { Router } from "express";
import { db } from "@workspace/db";
import { bookingsTable, customersTable, staffTable, servicesTable, bookingEventsTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { decrementOnCompletion, recomputeNextDueDate } from "../subscriptions/service";

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
  area: bookingsTable.area,
  locationLat: bookingsTable.locationLat,
  locationLng: bookingsTable.locationLng,
  notes: bookingsTable.notes,
  startedAt: bookingsTable.startedAt,
  completedAt: bookingsTable.completedAt,
  cancellationReason: bookingsTable.cancellationReason,
  proofPhotoUrls: bookingsTable.proofPhotoUrls,
  customerSignatureUrl: bookingsTable.customerSignatureUrl,
  beforePhotoUrl: bookingsTable.beforePhotoUrl,
  afterPhotoUrl: bookingsTable.afterPhotoUrl,
  technicianNotes: bookingsTable.technicianNotes,
  rating: bookingsTable.rating,
  amount: bookingsTable.amount,
  recurrenceRule: bookingsTable.recurrenceRule,
  parentBookingId: bookingsTable.parentBookingId,
  createdAt: bookingsTable.createdAt,
};

const allowedTransitions: Record<string, string[]> = {
  scheduled: ["en_route", "cancelled", "rescheduled"],
  en_route: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rescheduled: ["en_route", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["scheduled", "cancelled"],
};

async function logEvent(
  bookingId: number,
  type: string,
  opts?: { fromStatus?: string; toStatus?: string; body?: string; actorId?: number | null; actorName?: string; locationLat?: string; locationLng?: string },
) {
  await db.insert(bookingEventsTable).values({
    bookingId,
    type: type as any,
    fromStatus: opts?.fromStatus ?? null,
    toStatus: opts?.toStatus ?? null,
    body: opts?.body ?? null,
    actorId: opts?.actorId ?? null,
    actorName: opts?.actorName ?? null,
    locationLat: opts?.locationLat ?? null,
    locationLng: opts?.locationLng ?? null,
  });
}

async function getBookingWithScope(req: any, id: number) {
  const [booking] = await db.select(bookingSelect).from(bookingsTable)
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
    .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
    .where(eq(bookingsTable.id, id));
  if (!booking || !rowInScope(req, booking)) return null;
  return booking;
}

router.get("/bookings/today", async (req, res) => {
  try {
    const { staffId, branchId } = req.query as Record<string, string>;
    const today = new Date().toISOString().split("T")[0];
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
    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (serviceType) conditions.push(eq(bookingsTable.serviceType, serviceType as any));

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
    const { customerId, vehicleId, solarSiteId, subscriptionId, serviceId, staffId, branchId, scheduledDate, scheduledTime, serviceType, address, area, locationLat, locationLng, notes, amount, recurrenceRule } = req.body;
    if (!customerId || !scheduledDate || !serviceType) {
      return res.status(400).json({ error: "customerId, scheduledDate, and serviceType are required" });
    }

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
      scheduledDate, scheduledTime, serviceType, address, area, locationLat, locationLng, notes,
      amount: amount?.toString(), recurrenceRule,
      status: "scheduled" as const,
    });
    const [booking] = await db.insert(bookingsTable).values(values as any).returning();
    return res.status(201).json(booking);
  } catch (err) {
    req.log.error({ err }, "Create booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const booking = await getBookingWithScope(req, id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
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
    const { status, staffId, scheduledDate, scheduledTime, notes, technicianNotes, beforePhotoUrl, afterPhotoUrl, proofPhotoUrls, customerSignatureUrl, cancellationReason, rating, completedAt } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (staffId !== undefined) updateData.staffId = staffId;
    if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate;
    if (scheduledTime !== undefined) updateData.scheduledTime = scheduledTime;
    if (notes !== undefined) updateData.notes = notes;
    if (technicianNotes !== undefined) updateData.technicianNotes = technicianNotes;
    if (beforePhotoUrl !== undefined) updateData.beforePhotoUrl = beforePhotoUrl;
    if (afterPhotoUrl !== undefined) updateData.afterPhotoUrl = afterPhotoUrl;
    if (proofPhotoUrls !== undefined) updateData.proofPhotoUrls = proofPhotoUrls;
    if (customerSignatureUrl !== undefined) updateData.customerSignatureUrl = customerSignatureUrl;
    if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason;
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

router.post("/bookings/:id/transition", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { toStatus, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!toStatus) return res.status(400).json({ error: "toStatus is required" });

    const allowed = allowedTransitions[existing.status] || [];
    if (!allowed.includes(toStatus)) {
      return res.status(400).json({ error: `Invalid transition from ${existing.status} to ${toStatus}` });
    }

    const updateData: Record<string, unknown> = { status: toStatus, updatedAt: new Date() };
    if (toStatus === "in_progress") updateData.startedAt = new Date();
    if (toStatus === "completed") updateData.completedAt = new Date();

    const [booking] = await db.update(bookingsTable).set(updateData).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "status_change", {
      fromStatus: existing.status,
      toStatus,
      body: reason,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });

    if (toStatus === "completed" && existing.subscriptionId) {
      try {
        await decrementOnCompletion(existing.subscriptionId);
        await recomputeNextDueDate(existing.subscriptionId);
      } catch (subErr) {
        req.log.error({ subErr, subscriptionId: existing.subscriptionId }, "Subscription update on completion failed");
      }
    }

    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Transition booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/proof", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { urls } = req.body as { urls: string[] };
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!Array.isArray(urls) || urls.length === 0) return res.status(400).json({ error: "urls array required" });

    const current = (existing.proofPhotoUrls as string[] | null) ?? [];
    const updated = [...current, ...urls];
    const [booking] = await db.update(bookingsTable).set({ proofPhotoUrls: updated, updatedAt: new Date() }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "proof_upload", {
      body: `${urls.length} photo(s) added`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Proof upload error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/assign", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { staffId, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!staffId) return res.status(400).json({ error: "staffId is required" });

    const staff = await loadIfInScope(req,
      () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
      r => ({ ...r, staffId: r.id }),
    );
    if (!staff) return res.status(404).json({ error: "Staff not found" });
    if (staff.verificationStatus !== "verified") {
      return res.status(400).json({ error: "Staff must be verified before assignment" });
    }

    const [booking] = await db.update(bookingsTable).set({ staffId, updatedAt: new Date() }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "reassign", {
      body: reason ?? `Assigned to staff ${staffId}`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Assign booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/reschedule", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledDate, scheduledTime, reason } = req.body;
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!scheduledDate) return res.status(400).json({ error: "scheduledDate is required" });

    const [booking] = await db.update(bookingsTable).set({
      scheduledDate, scheduledTime: scheduledTime ?? null, status: "rescheduled", updatedAt: new Date(),
    }).where(eq(bookingsTable.id, id)).returning();
    await logEvent(id, "reschedule", {
      body: reason ?? `Rescheduled to ${scheduledDate}`,
      actorId: req.user?.id ?? req.scope?.staffId,
      actorName: req.user?.name ?? "system",
    });
    return res.json(booking);
  } catch (err) {
    req.log.error({ err }, "Reschedule booking error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bookings/:id/regenerate-occurrences", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Booking not found" });
    if (!existing.recurrenceRule) return res.status(400).json({ error: "Booking has no recurrenceRule" });

    const rule = existing.recurrenceRule as string;
    const days = parseInt(rule.match(/\d+/)?.[0] ?? "7");
    const count = parseInt(rule.match(/count=(\d+)/)?.[1] ?? "4");
    const startDate = new Date(existing.scheduledDate);

    const createdIds: number[] = [];
    for (let i = 1; i <= count; i++) {
      const nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + days * i);
      const nextDateStr = nextDate.toISOString().split("T")[0];

      const dup = tenantStamp(req, {
        customerId: existing.customerId,
        vehicleId: existing.vehicleId,
        solarSiteId: existing.solarSiteId,
        subscriptionId: existing.subscriptionId,
        serviceId: existing.serviceId,
        staffId: existing.staffId,
        branchId: existing.branchId,
        companyId: existing.companyId,
        franchiseeId: existing.franchiseeId,
        scheduledDate: nextDateStr,
        scheduledTime: existing.scheduledTime,
        serviceType: existing.serviceType,
        address: existing.address,
        area: existing.area,
        notes: existing.notes,
        amount: existing.amount,
        parentBookingId: existing.id,
        status: "scheduled" as const,
      });
      const [child] = await db.insert(bookingsTable).values(dup as any).returning();
      createdIds.push(child.id);
    }

    return res.json({ created: createdIds.length, bookingIds: createdIds });
  } catch (err) {
    req.log.error({ err }, "Regenerate occurrences error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bookings/:id/events", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, id)).limit(1);
    if (!booking || !rowInScope(req, booking)) return res.status(404).json({ error: "Booking not found" });

    const data = await db.select().from(bookingEventsTable).where(eq(bookingEventsTable.bookingId, id)).orderBy(desc(bookingEventsTable.createdAt));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Get booking events error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
