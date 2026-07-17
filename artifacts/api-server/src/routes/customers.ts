import { Router } from "express";
import { db } from "@workspace/db";
import { customersTable, vehiclesTable, solarSitesTable, subscriptionsTable, bookingsTable, paymentsTable, branchesTable } from "@workspace/db";
import { eq, ilike, or, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { getLedgerBalance } from "../lib/wallet/service";
import { getCustomerOutstandingDues } from "../lib/billing/invoiceService";
import {
  parseRequiredMobile,
  parseOptionalEmail,
  applyMobileField,
  applyOptionalEmailField,
} from "../lib/contactFields";
import { assertContactIdentityAvailable, type ContactExclude } from "../lib/contactIdentity";
import { createCustomerLoginAccount, syncCustomerLoginProfile } from "../lib/customerAccount";
import { normalizeGstin } from "../lib/gstin";
import { resolveSupervisorForCustomer } from "../lib/supervisor/supervisorContact";
import { isLegacyDormantCustomer, tryReactivateLegacyCustomer } from "../lib/customerReactivation";
import { ensureDefaultServiceLocation } from "../lib/serviceLocations/defaultLocationService";

const router = Router();

function customerSelfContactExcludes(
  customerId: number,
  existingUserId?: number | null,
  sessionUserId?: number,
): ContactExclude[] {
  const excludes: ContactExclude[] = [{ entity: "customer", id: customerId }];
  const linkedUserIds = new Set<number>();
  if (existingUserId) linkedUserIds.add(existingUserId);
  if (sessionUserId) linkedUserIds.add(sessionUserId);
  for (const userId of linkedUserIds) {
    excludes.push({ entity: "user", id: userId });
  }
  return excludes;
}

const SCOPE_COLS = {
  companyCol: customersTable.companyId,
  branchCol: customersTable.branchId,
  franchiseeCol: customersTable.franchiseeId,
  customerCol: customersTable.id, // a customer-role user can only see their own row
};

const CUSTOMER_LIST_SELECT = {
  id: customersTable.id, name: customersTable.name, phone: customersTable.phone,
  email: customersTable.email, address: customersTable.address, city: customersTable.city,
  status: customersTable.status, walletBalance: customersTable.walletBalance,
  totalDues: customersTable.totalDues, branchId: customersTable.branchId,
  photoUrl: customersTable.photoUrl, lastPaymentDate: customersTable.lastPaymentDate,
  customerSince: customersTable.customerSince, historicalWashCount: customersTable.historicalWashCount,
  historicalSolarVisitCount: customersTable.historicalSolarVisitCount,
  operationalNotes: customersTable.operationalNotes,
  gstin: customersTable.gstin, billingName: customersTable.billingName,
  referredByCustomerId: customersTable.referredByCustomerId,
  legacySegment: customersTable.legacySegment,
  reactivatedAt: customersTable.reactivatedAt,
  branchName: branchesTable.name, createdAt: customersTable.createdAt,
};

const CUSTOMER_DETAIL_SELECT = {
  ...CUSTOMER_LIST_SELECT,
  companyId: customersTable.companyId, franchiseeId: customersTable.franchiseeId,
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
      db.select(CUSTOMER_LIST_SELECT).from(customersTable)
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

router.get("/customers/legacy-contacts", async (req, res) => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      eq(customersTable.status, "inactive"),
      eq(customersTable.legacySegment, "legacy_contact"),
    ];
    const where = and(...conditions);

    const [data, countResult, reactivatedCount] = await Promise.all([
      db.select(CUSTOMER_LIST_SELECT).from(customersTable)
        .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
        .where(where)
        .orderBy(desc(customersTable.createdAt))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(and(
        ...tenantFilters(req, SCOPE_COLS),
        sql`${customersTable.reactivatedAt} IS NOT NULL`,
      )),
    ]);

    return res.json({
      data,
      total: Number(countResult[0]?.count ?? 0),
      reactivatedTotal: Number(reactivatedCount[0]?.count ?? 0),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "List legacy contacts error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/reactivated", async (req, res) => {
  try {
    const { limit = "50", offset = "0", days } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      sql`${customersTable.reactivatedAt} IS NOT NULL`,
    ];
    if (days) {
      const d = parseInt(days, 10);
      if (Number.isFinite(d) && d > 0) {
        conditions.push(sql`${customersTable.reactivatedAt} >= NOW() - (${d}::int * INTERVAL '1 day')`);
      }
    }
    const where = and(...conditions);

    const [data, countResult] = await Promise.all([
      db.select(CUSTOMER_LIST_SELECT).from(customersTable)
        .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
        .where(where)
        .orderBy(desc(customersTable.reactivatedAt))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(customersTable).where(where),
    ]);

    return res.json({
      data,
      total: Number(countResult[0]?.count ?? 0),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "List reactivated customers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const { name, phone, email, address, city, branchId, password, gstin, billingName, referredByCustomerId } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const identityCheck = await assertContactIdentityAvailable(
      phoneResult.value,
      emailResult.value,
    );
    if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);

    const stamp = tenantStamp(req, {
      name, phone: identityCheck.identity.phone, email: identityCheck.identity.email, address, city,
      branchId: branchId || null,
      status: "active" as const,
    });
    const values: typeof customersTable.$inferInsert = { ...stamp };

    try {
      if (gstin !== undefined) values.gstin = normalizeGstin(gstin);
      if (billingName !== undefined) values.billingName = billingName?.trim() || null;
      if (referredByCustomerId) {
        const [referrer] = await db.select({ id: customersTable.id }).from(customersTable).where(eq(customersTable.id, referredByCustomerId)).limit(1);
        if (!referrer || !rowInScope(req, { ...referrer, customerId: referrer.id })) {
          return res.status(400).json({ error: "Invalid referrer customer" });
        }
        values.referredByCustomerId = referredByCustomerId;
      }
    } catch (gstErr) {
      return res.status(400).json({ error: gstErr instanceof Error ? gstErr.message : "Invalid billing fields" });
    }

    const [customer] = await db.insert(customersTable).values(values).returning();

    try {
      await ensureDefaultServiceLocation(customer);
    } catch (locErr) {
      req.log.warn({ err: locErr, customerId: customer.id }, "Customer created but default service location failed");
    }

    let loginAccount: { userId: number; phone: string } | null = null;
    if (password) {
      try {
        loginAccount = await createCustomerLoginAccount(customer, String(password));
      } catch (accountErr) {
        req.log.warn({ err: accountErr, customerId: customer.id }, "Customer created but login account failed");
        return res.status(201).json({
          ...customer,
          branchName: null,
          loginWarning: accountErr instanceof Error ? accountErr.message : "Failed to create login account",
        });
      }
    }

    return res.status(201).json({
      ...customer,
      branchName: null,
      userId: loginAccount?.userId ?? customer.userId ?? null,
      loginCreated: Boolean(loginAccount),
    });
  } catch (err) {
    req.log.error({ err }, "Create customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/me", async (req, res) => {
  try {
    const customerId = req.scope?.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer profile only" });

    const [customer] = await db.select(CUSTOMER_LIST_SELECT).from(customersTable)
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

router.patch("/customers/me", async (req, res) => {
  try {
    const customerId = req.scope?.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer profile only" });

    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Customer not found" });

    const { name, phone, photoUrl } = req.body as {
      name?: string;
      phone?: string;
      photoUrl?: string | null;
    };

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ error: "Name is required" });
      updateData.name = trimmed;
    }

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });

    if (updateData.phone !== undefined) {
      const identityCheck = await assertContactIdentityAvailable(
        updateData.phone,
        existing.email,
        customerSelfContactExcludes(customerId, existing.userId, req.user?.id),
      );
      if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);
      updateData.phone = identityCheck.identity.phone;
    }

    if (photoUrl !== undefined) {
      if (photoUrl !== null && typeof photoUrl === "string" && photoUrl.trim() && !/^https?:\/\//.test(photoUrl)) {
        return res.status(400).json({ error: "photoUrl must be an https URL" });
      }
      updateData.photoUrl = photoUrl || null;
    }

    if (Object.keys(updateData).length === 1) {
      return res.status(400).json({ error: "No profile fields to update" });
    }

    await db.update(customersTable).set(updateData).where(eq(customersTable.id, customerId));

    await syncCustomerLoginProfile(customerId, {
      name: typeof updateData.name === "string" ? updateData.name : undefined,
      phone: typeof updateData.phone === "string" ? updateData.phone : undefined,
    });

    const [refreshed] = await db.select(CUSTOMER_LIST_SELECT).from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, customerId))
      .limit(1);

    return res.json(refreshed ?? existing);
  } catch (err) {
    req.log.error({ err }, "Update customer profile error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/me/supervisor-contact", async (req, res) => {
  try {
    const customerId = req.scope?.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer profile only" });

    const supervisor = await resolveSupervisorForCustomer(customerId);
    return res.json({ supervisor });
  } catch (err) {
    req.log.error({ err }, "Customer supervisor contact error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select(CUSTOMER_DETAIL_SELECT).from(customersTable)
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

    const isCustomerSelf = req.scope?.customerId === id;
    if (isCustomerSelf) {
      const body = req.body as Record<string, unknown>;
      const forbidden = Object.keys(body).filter(
        key => body[key] !== undefined && !["name", "phone", "photoUrl"].includes(key),
      );
      if (forbidden.length > 0) {
        return res.status(403).json({ error: "You can only update name, phone, and photo" });
      }
    }

    const { name, phone, email, address, city, status, branchId, photoUrl, operationalNotes, gstin, billingName, referredByCustomerId } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    const emailField = applyOptionalEmailField(req.body, "email", updateData);
    if (!emailField.ok) return res.status(400).json({ error: emailField.error });

    if (updateData.phone !== undefined || updateData.email !== undefined) {
      const identityCheck = await assertContactIdentityAvailable(
        typeof updateData.phone === "string" ? updateData.phone : existing.phone,
        updateData.email !== undefined ? updateData.email : existing.email,
        isCustomerSelf
          ? customerSelfContactExcludes(id, existing.userId, req.user?.id)
          : { entity: "customer", id },
      );
      if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);
      if (typeof updateData.phone === "string") updateData.phone = identityCheck.identity.phone;
      if (updateData.email !== undefined) updateData.email = identityCheck.identity.email;
    }

    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (status !== undefined && !(status === "active" && isLegacyDormantCustomer(existing))) {
      updateData.status = status;
    }
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
    try {
      if (gstin !== undefined) updateData.gstin = normalizeGstin(gstin);
      if (billingName !== undefined) updateData.billingName = billingName?.trim() || null;
      if (referredByCustomerId !== undefined) {
        if (referredByCustomerId === null) {
          updateData.referredByCustomerId = null;
        } else {
          const refId = parseInt(String(referredByCustomerId), 10);
          if (refId === id) return res.status(400).json({ error: "Customer cannot refer themselves" });
          const [referrer] = await db.select().from(customersTable).where(eq(customersTable.id, refId)).limit(1);
          if (!referrer || !rowInScope(req, { ...referrer, customerId: referrer.id })) {
            return res.status(400).json({ error: "Invalid referrer customer" });
          }
          updateData.referredByCustomerId = refId;
        }
      }
    } catch (gstErr) {
      return res.status(400).json({ error: gstErr instanceof Error ? gstErr.message : "Invalid billing fields" });
    }
    // walletBalance is derived from ledger — never patch directly

    const [customer] = await db.update(customersTable).set(updateData).where(eq(customersTable.id, id)).returning();

    if (isCustomerSelf) {
      await syncCustomerLoginProfile(id, {
        name: typeof updateData.name === "string" ? updateData.name : undefined,
        phone: typeof updateData.phone === "string" ? updateData.phone : undefined,
        email: updateData.email !== undefined ? (updateData.email as string | null) : undefined,
      });
    }

    let reactivated = false;
    if (status === "active" && isLegacyDormantCustomer(existing)) {
      const result = await tryReactivateLegacyCustomer(id, "status_change");
      reactivated = result.reactivated;
    }

    const [refreshed] = await db.select(CUSTOMER_LIST_SELECT).from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(eq(customersTable.id, id)).limit(1);

    return res.json({ ...(refreshed ?? customer), reactivated });
  } catch (err) {
    req.log.error({ err }, "Update customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/customers/:id/reactivate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { ...existing, customerId: existing.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }
    if (!isLegacyDormantCustomer(existing)) {
      return res.status(400).json({ error: "Customer is not a dormant legacy contact" });
    }

    const result = await tryReactivateLegacyCustomer(id, "manual");
    if (!result.reactivated || !result.customer) {
      return res.status(400).json({ error: "Reactivation failed" });
    }

    return res.json({
      ...result.customer,
      reactivated: true,
      welcomeBackQueued: true,
    });
  } catch (err) {
    req.log.error({ err }, "Reactivate customer error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/network", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select({
      id: customersTable.id,
      referredByCustomerId: customersTable.referredByCustomerId,
    }).from(customersTable).where(eq(customersTable.id, id)).limit(1);

    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const refSelect = {
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      city: customersTable.city,
      status: customersTable.status,
    };

    const [referrer, referrals, siblings] = await Promise.all([
      customer.referredByCustomerId
        ? db.select(refSelect).from(customersTable).where(eq(customersTable.id, customer.referredByCustomerId)).limit(1)
        : Promise.resolve([]),
      db.select(refSelect).from(customersTable)
        .where(eq(customersTable.referredByCustomerId, id))
        .orderBy(desc(customersTable.createdAt)),
      customer.referredByCustomerId
        ? db.select(refSelect).from(customersTable).where(and(
          eq(customersTable.referredByCustomerId, customer.referredByCustomerId),
          sql`${customersTable.id} <> ${id}`,
        ))
        : Promise.resolve([]),
    ]);

    return res.json({
      referrer: referrer[0] ?? null,
      referrals,
      siblings,
      referralCount: referrals.length,
    });
  } catch (err) {
    req.log.error({ err }, "Customer network error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/services", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const { getCustomerServicesHub } = await import("../lib/customers/customerServicesHub");
    const hub = await getCustomerServicesHub(id);
    return res.json(hub);
  } catch (err) {
    req.log.error({ err }, "Customer services hub error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/billing-summary", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const { getCustomerBillingSummary } = await import("../lib/customers/customerBillingSummary");
    const summary = await getCustomerBillingSummary(id);
    return res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Customer billing summary error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/customers/:id/contracts", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id)).limit(1);
    if (!customer || !rowInScope(req, { ...customer, customerId: customer.id })) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const { syncCustomerContracts, listCustomerContracts } = await import("../lib/contracts/contractRegistry");
    await syncCustomerContracts(id);
    const contracts = await listCustomerContracts(id, req);
    return res.json({ customerId: id, contracts });
  } catch (err) {
    req.log.error({ err }, "Customer contracts error");
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

    const [recentBookings, recentPayments, totalSpendResult, activeContracts] = await Promise.all([
      db.select().from(bookingsTable).where(eq(bookingsTable.customerId, id))
        .orderBy(desc(bookingsTable.createdAt)).limit(5),
      db.select().from(paymentsTable).where(eq(paymentsTable.customerId, id))
        .orderBy(desc(paymentsTable.createdAt)).limit(5),
      db.select({ total: sql<number>`sum(amount)` }).from(paymentsTable)
        .where(eq(paymentsTable.customerId, id)),
      import("../lib/customers/customerServicesHub").then(m => m.countActiveCustomerContracts(id)),
    ]);

    const upcomingBookings = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
      .where(and(eq(bookingsTable.customerId, id), eq(bookingsTable.status, "confirmed")));

    // Phase 5.2: completed is execution-owned — count this month's non-cancelled bookings
    const thisMonthBookings = await db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
      .where(and(
        eq(bookingsTable.customerId, id),
        sql`${bookingsTable.status} <> 'cancelled'`,
        sql`DATE_TRUNC('month', ${bookingsTable.scheduledDate}::date) = DATE_TRUNC('month', NOW())`,
      ));

    const pendingDues = await getCustomerOutstandingDues(id);

    return res.json({
      activeSubscriptions: activeContracts,
      activeContracts,
      upcomingServices: Number(upcomingBookings[0]?.count ?? 0),
      walletBalance: await getLedgerBalance(id),
      pendingDues,
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
