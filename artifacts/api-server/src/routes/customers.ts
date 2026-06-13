import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, vehiclesTable, solarSitesTable, subscriptionsTable, bookingsTable, paymentsTable, branchesTable } from "@workspace/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { getLedgerBalance } from "../lib/wallet/service";
import {
  parseRequiredMobile,
  parseOptionalEmail,
  applyMobileField,
  applyOptionalEmailField,
} from "../lib/contactFields";

const router = Router();

const SCOPE_COLS = {
  companyCol: customersTable.companyId,
  branchCol: customersTable.branchId,
  franchiseeCol: customersTable.franchiseeId,
  customerCol: customersTable.id, // a customer-role user can only see their own row
};

router.get("/customers", async (req, res) => {
  try {
    const { search, branchId, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (search) {
      conditions.push(or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.phone, `%${search}%`),
        ilike(customersTable.email, `%${search}%`),
      )!);
    }
    if (branchId) conditions.push(eq(customersTable.branchId, parseInt(branchId)));
    if (status) conditions.push(eq(customersTable.status, status as "active" | "inactive" | "suspended"));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: customersTable.id, name: customersTable.name, phone: customersTable.phone,
        email: customersTable.email, address: customersTable.address, city: customersTable.city,
        status: customersTable.status, walletBalance: customersTable.walletBalance,
        totalDues: customersTable.totalDues, branchId: customersTable.branchId,
        photoUrl: customersTable.photoUrl, lastPaymentDate: customersTable.lastPaymentDate,
        customerSince: customersTable.customerSince, historicalWashCount: customersTable.historicalWashCount,
        historicalSolarVisitCount: customersTable.historicalSolarVisitCount,
        operationalNotes: customersTable.operationalNotes,
        branchName: branchesTable.name, createdAt: customersTable.createdAt,
      }).from(customersTable)
        .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
        .where(where)
        .orderBy(desc(customersTable.createdAt))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List customers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, city, branchId } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const values = tenantStamp(req, {
      name, phone: phoneResult.value, email: emailResult.value, address, city,
      branchId: branchId || null,
      status: "active" as const,
    });

    const [customer] = await db.insert(customersTable).values(values as typeof customersTable.$inferInsert).returning();
    return res.status(201).json({ ...customer, branchName: null });
  } catch (err) {
    req.log.error({ err }, "Create customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/me", async (req, res) => {
  try {
    const customerId = req.scope?.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer profile only" });

    const [customer] = await db.select({
      id: customersTable.id, name: customersTable.name, phone: customersTable.phone,
      email: customersTable.email, address: customersTable.address, city: customersTable.city,
      status: customersTable.status, walletBalance: customersTable.walletBalance,
      totalDues: customersTable.totalDues, branchId: customersTable.branchId,
      photoUrl: customersTable.photoUrl, lastPaymentDate: customersTable.lastPaymentDate,
      customerSince: customersTable.customerSince, historicalWashCount: customersTable.historicalWashCount,
      historicalSolarVisitCount: customersTable.historicalSolarVisitCount,
      operationalNotes: customersTable.operationalNotes,
      branchName: branchesTable.name, createdAt: customersTable.createdAt,
    }).from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, customerId))
      .limit(1);

    if (!customer) return res.status(404).json({ error: "Customer not found" });
    return res.json(customer);
  } catch (err) {
    req.log.error({ err }, "Get customer profile error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select({
      id: customersTable.id, name: customersTable.name, phone: customersTable.phone,
      email: customersTable.email, address: customersTable.address, city: customersTable.city,
      status: customersTable.status, walletBalance: customersTable.walletBalance,
      totalDues: customersTable.totalDues, branchId: customersTable.branchId,
      companyId: customersTable.companyId, franchiseeId: customersTable.franchiseeId,
      photoUrl: customersTable.photoUrl, lastPaymentDate: customersTable.lastPaymentDate,
      customerSince: customersTable.customerSince, historicalWashCount: customersTable.historicalWashCount,
      historicalSolarVisitCount: customersTable.historicalSolarVisitCount,
      operationalNotes: customersTable.operationalNotes,
      branchName: branchesTable.name, createdAt: customersTable.createdAt,
    }).from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id));

    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const [vehicles, solarSites, activeSubscriptions] = await Promise.all([
      db.select().from(vehiclesTable).where(eq(vehiclesTable.customerId, id)),
      db.select().from(solarSitesTable).where(eq(solarSitesTable.customerId, id)),
      db.select().from(subscriptionsTable).where(and(eq(subscriptionsTable.customerId, id), eq(subscriptionsTable.status, "active"))),
    ]);

    return res.json({ ...customer, vehicles, solarSites, activeSubscriptions });
  } catch (err) {
    req.log.error({ err }, "Get customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { ...existing, customerId: existing.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const { name, phone, email, address, city, status, branchId, photoUrl, operationalNotes } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    const emailField = applyOptionalEmailField(req.body, "email", updateData);
    if (!emailField.ok) return res.status(400).json({ error: emailField.error });

    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (status !== undefined) updateData.status = status;
    if (branchId !== undefined) updateData.branchId = branchId;
    if (photoUrl !== undefined) {
      if (photoUrl !== null && typeof photoUrl === "string" && photoUrl.trim() && !/^https?:\/\//.test(photoUrl)) {
        return res.status(400).json({ error: "photoUrl must be an https URL" });
      }
      updateData.photoUrl = photoUrl || null;
    }
    if (operationalNotes !== undefined && req.scope?.isSuperAdmin) {
      updateData.operationalNotes = operationalNotes;
    }
    // walletBalance is derived from ledger — never patch directly

    const [customer] = await db.update(customersTable).set(updateData).where(eq(customersTable.id, id)).returning();
    return res.json({ ...customer, branchName: null });
  } catch (err) {
    req.log.error({ err }, "Update customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/summary", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const [activeSubscriptions, recentBookings, recentPayments, totalSpendResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable)
        .where(and(eq(subscriptionsTable.customerId, id), eq(subscriptionsTable.status, "active"))),
      db.select().from(bookingsTable).where(eq(bookingsTable.customerId, id))
        .orderBy(desc(bookingsTable.createdAt)).limit(5),
      db.select().from(paymentsTable).where(eq(paymentsTable.customerId, id))
        .orderBy(desc(paymentsTable.createdAt)).limit(5),
      db.select({ total: sql<number>`sum(amount)` }).from(paymentsTable)
        .where(eq(paymentsTable.customerId, id)),
    ]);

    const upcomingBookings = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
      .where(and(eq(bookingsTable.customerId, id), eq(bookingsTable.status, "confirmed")));

    const thisMonthBookings = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
      .where(and(
        eq(bookingsTable.customerId, id),
        eq(bookingsTable.status, "completed"),
        sql`DATE_TRUNC('month', ${bookingsTable.scheduledDate}::date) = DATE_TRUNC('month', NOW())`,
      ));

    return res.json({
      activeSubscriptions: Number(activeSubscriptions[0]?.count ?? 0),
      upcomingServices: Number(upcomingBookings[0]?.count ?? 0),
      walletBalance: await getLedgerBalance(id),
      pendingDues: parseFloat(customer.totalDues),
      totalServicesThisMonth: Number(thisMonthBookings[0]?.count ?? 0),
      totalSpend: Number(totalSpendResult[0]?.total ?? 0),
      recentBookings,
      recentPayments,
    });
  } catch (err) {
    req.log.error({ err }, "Customer summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
