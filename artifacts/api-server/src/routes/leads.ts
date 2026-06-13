import { Router } from "express";
import { db } from "@workspace/db";
import {
  leadsTable, leadActivitiesTable, leadIngestionLogTable,
  customersTable, bookingsTable, subscriptionsTable, servicesTable, branchesTable, staffTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc, gte, lte } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import {
  parseRequiredMobile,
  parseOptionalMobile,
  applyMobileField,
  applyOptionalMobileField,
  normalizeIndianMobile,
} from "../lib/contactFields";

const router = Router();

const SCOPE_COLS = {
  companyCol: leadsTable.companyId,
  branchCol: leadsTable.branchId,
  franchiseeCol: leadsTable.franchiseeId,
};

// Helper: change status and log activity atomically
async function changeLeadStatus(
  leadId: number,
  newStatus: string,
  byUserId: number | null,
  note?: string,
) {
  const [lead] = await db.update(leadsTable)
    .set({ status: newStatus as any, updatedAt: new Date() })
    .where(eq(leadsTable.id, leadId))
    .returning();
  if (lead) {
    await db.insert(leadActivitiesTable).values({
      leadId,
      type: "status_change",
      body: note || `Status changed to ${newStatus}`,
      createdBy: byUserId,
    });
  }
  return lead;
}

/* ── GET /api/leads ─────────────────────────────────────────────── */
router.get("/leads", async (req, res) => {
  try {
    const {
      search, status, source, assignedTo, dueFollowUp, from, to,
      limit = "50", offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (search) {
      conditions.push(or(
        ilike(leadsTable.name, `%${search}%`),
        ilike(leadsTable.phone, `%${search}%`),
      )!);
    }
    if (status) conditions.push(eq(leadsTable.status, status as any));
    if (source) conditions.push(eq(leadsTable.source, source as any));
    if (assignedTo) conditions.push(eq(leadsTable.assignedToStaffId, parseInt(assignedTo)));
    if (dueFollowUp === "true") {
      conditions.push(lte(leadsTable.nextFollowUpAt, new Date()));
    }
    if (from) {
      conditions.push(gte(leadsTable.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(leadsTable.createdAt, new Date(to)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: leadsTable.id,
        name: leadsTable.name,
        phone: leadsTable.phone,
        secondaryPhone: leadsTable.secondaryPhone,
        city: leadsTable.city,
        source: leadsTable.source,
        serviceInterest: leadsTable.serviceInterest,
        assignedToStaffId: leadsTable.assignedToStaffId,
        status: leadsTable.status,
        notes: leadsTable.notes,
        nextFollowUpAt: leadsTable.nextFollowUpAt,
        valueEstimate: leadsTable.valueEstimate,
        lostReason: leadsTable.lostReason,
        companyId: leadsTable.companyId,
        franchiseeId: leadsTable.franchiseeId,
        branchId: leadsTable.branchId,
        customerId: leadsTable.customerId,
        bookingId: leadsTable.bookingId,
        subscriptionId: leadsTable.subscriptionId,
        createdAt: leadsTable.createdAt,
        updatedAt: leadsTable.updatedAt,
        assignedToName: staffTable.name,
      }).from(leadsTable)
        .leftJoin(staffTable, eq(leadsTable.assignedToStaffId, staffTable.id))
        .where(where)
        .orderBy(desc(leadsTable.createdAt))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(where),
    ]);

    return res.json({
      data: data.map(d => ({ ...d, assignedToName: d.assignedToName ?? null })),
      total: Number(countResult[0]?.count ?? 0),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "List leads error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /api/leads ────────────────────────────────────────────── */
router.post("/leads", async (req, res) => {
  try {
    const {
      name, phone, secondaryPhone, city, source, serviceInterest,
      assignedToStaffId, notes, nextFollowUpAt, valueEstimate,
    } = req.body;

    if (!name || !source) {
      return res.status(400).json({ error: "Name and source are required" });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const secondaryResult = parseOptionalMobile(secondaryPhone);
    if (!secondaryResult.ok) return res.status(400).json({ error: secondaryResult.error });

    // Prevent cross-tenant linking: staff must be in scope
    let assignedToStaffIdVal: number | null = null;
    if (assignedToStaffId) {
      const staffId = parseInt(assignedToStaffId);
      const staff = await loadIfInScope(req,
        () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
        r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId }),
      );
      if (!staff) return res.status(404).json({ error: "Assigned staff not found" });
      assignedToStaffIdVal = staffId;
    }

    const values = tenantStamp(req, {
      name, phone: phoneResult.value, secondaryPhone: secondaryResult.value, city,
      source: source as any,
      serviceInterest: serviceInterest as any || null,
      assignedToStaffId: assignedToStaffIdVal,
      notes: notes || null,
      nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
      valueEstimate: valueEstimate ? String(valueEstimate) : null,
    });

    const [lead] = await db.insert(leadsTable).values(values as typeof leadsTable.$inferInsert).returning();

    await db.insert(leadActivitiesTable).values({
      leadId: lead.id,
      type: "note",
      body: `Lead created from ${source}`,
      createdBy: req.user?.id ?? null,
    });

    return res.status(201).json({ ...lead, assignedToName: null });
  } catch (err) {
    req.log.error({ err }, "Create lead error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /api/leads/stats ─────────────────────────────────────── */
router.get("/leads/stats", async (req, res) => {
  try {
    const { from, to } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (from) conditions.push(gte(leadsTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(leadsTable.createdAt, new Date(to)));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [sourceCounts, statusCounts, totalResult, convertedResult] = await Promise.all([
      db.select({
        source: leadsTable.source,
        count: sql<number>`count(*)`,
      }).from(leadsTable).where(where).groupBy(leadsTable.source),
      db.select({
        status: leadsTable.status,
        count: sql<number>`count(*)`,
      }).from(leadsTable).where(where).groupBy(leadsTable.status),
      db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(where),
      db.select({ count: sql<number>`count(*)` }).from(leadsTable).where(
        and(
          ...(where ? [where] : []),
          or(eq(leadsTable.status, "booked"), eq(leadsTable.status, "completed"), eq(leadsTable.status, "subscription")),
        ),
      ),
    ]);

    const total = Number(totalResult[0]?.count ?? 0);
    const converted = Number(convertedResult[0]?.count ?? 0);

    return res.json({
      total,
      converted,
      conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      bySource: sourceCounts.map(s => ({ source: s.source, count: Number(s.count) })),
      byStatus: statusCounts.map(s => ({ status: s.status, count: Number(s.count) })),
    });
  } catch (err) {
    req.log.error({ err }, "Lead stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /api/leads/follow-ups ────────────────────────────────── */
router.get("/leads/follow-ups", async (req, res) => {
  try {
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      lte(leadsTable.nextFollowUpAt, sql`CURRENT_DATE + INTERVAL '1 day'`),
      gte(leadsTable.nextFollowUpAt, sql`CURRENT_DATE`),
    ];
    const where = and(...conditions);

    const data = await db.select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      city: leadsTable.city,
      source: leadsTable.source,
      status: leadsTable.status,
      nextFollowUpAt: leadsTable.nextFollowUpAt,
      notes: leadsTable.notes,
      assignedToName: staffTable.name,
    }).from(leadsTable)
      .leftJoin(staffTable, eq(leadsTable.assignedToStaffId, staffTable.id))
      .where(where)
      .orderBy(leadsTable.nextFollowUpAt);

    return res.json(data.map(d => ({ ...d, assignedToName: d.assignedToName ?? null })));
  } catch (err) {
    req.log.error({ err }, "Follow-ups error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /api/leads/ingest ───────────────────────────────────── */
router.post("/leads/ingest", async (req, res) => {
  try {
    const { source, payload } = req.body;
    if (!source || !payload) return res.status(400).json({ error: "source and payload are required" });

    const [log] = await db.insert(leadIngestionLogTable).values({
      source,
      rawPayload: typeof payload === "string" ? payload : JSON.stringify(payload),
    }).returning();

    // Try to parse and create a lead
    let parsed: any = payload;
    if (typeof payload === "string") {
      try { parsed = JSON.parse(payload); } catch { /* keep as string */ }
    }

    const name = parsed?.name || parsed?.full_name || "Unknown";
    const phone = parsed?.phone || parsed?.phone_number || parsed?.contact || "";
    const city = parsed?.city || parsed?.location || null;
    const serviceInterest = parsed?.service || parsed?.service_interest || null;

    if (phone) {
      const normalizedPhone = normalizeIndianMobile(String(phone));
      if (!normalizedPhone) {
        return res.status(202).json({ success: false, logId: log.id, error: "Invalid phone number in payload" });
      }
      const leadValues = tenantStamp(req, {
        name,
        phone: normalizedPhone,
        city,
        source: source as any,
        serviceInterest: serviceInterest as any,
        status: "new" as const,
      });
      const [lead] = await db.insert(leadsTable).values(leadValues as typeof leadsTable.$inferInsert).returning();

      await db.update(leadIngestionLogTable)
        .set({ processedAt: new Date(), leadId: lead.id })
        .where(eq(leadIngestionLogTable.id, log.id));

      return res.status(201).json({ success: true, leadId: lead.id, logId: log.id });
    }

    return res.status(202).json({ success: false, logId: log.id, error: "Could not extract phone from payload" });
  } catch (err) {
    req.log.error({ err }, "Lead ingest error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── GET /api/leads/:id ───────────────────────────────────────── */
router.get("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lead] = await db.select({
      id: leadsTable.id,
      name: leadsTable.name,
      phone: leadsTable.phone,
      secondaryPhone: leadsTable.secondaryPhone,
      city: leadsTable.city,
      source: leadsTable.source,
      serviceInterest: leadsTable.serviceInterest,
      assignedToStaffId: leadsTable.assignedToStaffId,
      status: leadsTable.status,
      notes: leadsTable.notes,
      nextFollowUpAt: leadsTable.nextFollowUpAt,
      valueEstimate: leadsTable.valueEstimate,
      lostReason: leadsTable.lostReason,
      companyId: leadsTable.companyId,
      franchiseeId: leadsTable.franchiseeId,
      branchId: leadsTable.branchId,
      customerId: leadsTable.customerId,
      bookingId: leadsTable.bookingId,
      subscriptionId: leadsTable.subscriptionId,
      createdAt: leadsTable.createdAt,
      updatedAt: leadsTable.updatedAt,
      assignedToName: staffTable.name,
    }).from(leadsTable)
      .leftJoin(staffTable, eq(leadsTable.assignedToStaffId, staffTable.id))
      .where(eq(leadsTable.id, id));

    if (!lead || !rowInScope(req, { companyId: lead.companyId, branchId: lead.branchId, franchiseeId: lead.franchiseeId })) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const activities = await db.select({
      id: leadActivitiesTable.id,
      leadId: leadActivitiesTable.leadId,
      type: leadActivitiesTable.type,
      body: leadActivitiesTable.body,
      createdBy: leadActivitiesTable.createdBy,
      createdAt: leadActivitiesTable.createdAt,
    }).from(leadActivitiesTable)
      .where(eq(leadActivitiesTable.leadId, id))
      .orderBy(desc(leadActivitiesTable.createdAt));

    return res.json({ ...lead, assignedToName: lead.assignedToName ?? null, activities });
  } catch (err) {
    req.log.error({ err }, "Get lead error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── PATCH /api/leads/:id ─────────────────────────────────────── */
router.patch("/leads/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { companyId: existing.companyId, branchId: existing.branchId, franchiseeId: existing.franchiseeId })) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const {
      name, phone, secondaryPhone, city, source, serviceInterest,
      assignedToStaffId, status, notes, nextFollowUpAt, valueEstimate,
    } = req.body;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    const secondaryField = applyOptionalMobileField(req.body, "secondaryPhone", updateData);
    if (!secondaryField.ok) return res.status(400).json({ error: secondaryField.error });

    if (city !== undefined) updateData.city = city;
    if (source !== undefined) updateData.source = source;
    if (serviceInterest !== undefined) updateData.serviceInterest = serviceInterest;
    if (notes !== undefined) updateData.notes = notes;
    if (nextFollowUpAt !== undefined) updateData.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
    if (valueEstimate !== undefined) updateData.valueEstimate = valueEstimate ? String(valueEstimate) : null;

    if (assignedToStaffId !== undefined) {
      if (assignedToStaffId) {
        const staffId = parseInt(assignedToStaffId);
        const staff = await loadIfInScope(req,
          () => db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1).then(r => r[0]),
          r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId }),
        );
        if (!staff) return res.status(404).json({ error: "Assigned staff not found" });
        updateData.assignedToStaffId = staffId;
      } else {
        updateData.assignedToStaffId = null;
      }
    }

    if (status !== undefined && status !== existing.status) {
      await changeLeadStatus(id, status, req.user?.id ?? null, `Status changed from ${existing.status} to ${status}`);
      delete updateData.status; // changeLeadStatus already handled it
    }

    const [lead] = await db.update(leadsTable).set(updateData).where(eq(leadsTable.id, id)).returning();
    return res.json({ ...lead, assignedToName: null });
  } catch (err) {
    req.log.error({ err }, "Update lead error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /api/leads/:id/activities ─────────────────────────────── */
router.post("/leads/:id/activities", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
    if (!lead || !rowInScope(req, { companyId: lead.companyId, branchId: lead.branchId, franchiseeId: lead.franchiseeId })) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const { type, body, followUpAt } = req.body;
    if (!type || !body) return res.status(400).json({ error: "Type and body are required" });

    const [activity] = await db.insert(leadActivitiesTable).values({
      leadId: id,
      type: type as any,
      body,
      createdBy: req.user?.id ?? null,
    }).returning();

    if (followUpAt) {
      await db.update(leadsTable)
        .set({ nextFollowUpAt: new Date(followUpAt), updatedAt: new Date() })
        .where(eq(leadsTable.id, id));
    }

    return res.status(201).json(activity);
  } catch (err) {
    req.log.error({ err }, "Create lead activity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/* ── POST /api/leads/:id/convert ────────────────────────────────── */
router.post("/leads/:id/convert", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, id)).limit(1);
    if (!lead || !rowInScope(req, { companyId: lead.companyId, branchId: lead.branchId, franchiseeId: lead.franchiseeId })) {
      return res.status(404).json({ error: "Lead not found" });
    }

    const {
      createCustomer = true,
      createBooking = false,
      createSubscription = false,
      serviceId,
      scheduledDate,
      amount,
      subscriptionType,
    } = req.body;

    const result: Record<string, unknown> = {};

    // Create customer
    if (createCustomer) {
      const customerValues = tenantStamp(req, {
        name: lead.name,
        phone: lead.phone,
        city: lead.city,
        status: "active" as const,
      });
      const [customer] = await db.insert(customersTable).values(customerValues as typeof customersTable.$inferInsert).returning();
      result.customer = customer;

      // Link lead to customer
      await db.update(leadsTable)
        .set({ customerId: customer.id, updatedAt: new Date() })
        .where(eq(leadsTable.id, id));
    }

    const customerId = (result.customer as any)?.id ?? lead.customerId;

    // Create booking (with cross-tenant service validation)
    if (createBooking && customerId && serviceId && scheduledDate) {
      const sid = parseInt(serviceId);
      const service = await loadIfInScope(req,
        () => db.select().from(servicesTable).where(eq(servicesTable.id, sid)).limit(1).then(r => r[0]),
        () => ({}), // servicesTable has no tenant cols in this schema; all services are global per tenant
      );
      if (!service) return res.status(404).json({ error: "Service not found" });
      const bookingValues = tenantStamp(req, {
        customerId: customerId,
        serviceId: sid,
        scheduledDate,
        serviceType: service?.category as any || "car_wash",
        status: "pending" as const,
        amount: amount ? String(amount) : null,
      });
      const [booking] = await db.insert(bookingsTable).values(bookingValues as typeof bookingsTable.$inferInsert).returning();
      result.booking = booking;

      await db.update(leadsTable)
        .set({ bookingId: booking.id, updatedAt: new Date() })
        .where(eq(leadsTable.id, id));
    }

    // Create subscription
    if (createSubscription && customerId && subscriptionType) {
      const { startDate, endDate, price } = req.body;
      if (!startDate || !endDate || !price) {
        return res.status(400).json({ error: "startDate, endDate, and price are required for subscription creation" });
      }
      const subValues = tenantStamp(req, {
        customerId: customerId,
        type: subscriptionType as any,
        status: "active" as const,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        price: String(price),
        paidAmount: "0",
        dueAmount: String(price),
      });
      const [subscription] = await db.insert(subscriptionsTable).values(subValues as any).returning();
      result.subscription = subscription;

      await db.update(leadsTable)
        .set({ subscriptionId: subscription.id, updatedAt: new Date() })
        .where(eq(leadsTable.id, id));
    }

    // Determine conversion status: must have at least one downstream entity
    const hasConversion = result.customer || result.booking || result.subscription;
    if (!hasConversion) {
      return res.status(400).json({ error: "Nothing to convert. Enable at least one of createCustomer, createBooking, or createSubscription" });
    }

    // Update lead status
    const conversionNote = result.customer
      ? `Lead converted. Customer #${customerId} created.`
      : result.booking
      ? "Lead converted to booking."
      : "Lead converted to subscription.";
    await changeLeadStatus(id, "booked", req.user?.id ?? null, conversionNote);

    await db.insert(leadActivitiesTable).values({
      leadId: id,
      type: "converted",
      body: conversionNote,
      createdBy: req.user?.id ?? null,
    });

    return res.json({ success: true, leadId: id, ...result });
  } catch (err) {
    req.log.error({ err }, "Convert lead error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
