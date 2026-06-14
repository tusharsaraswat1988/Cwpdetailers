import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, customersTable, servicesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { getDaysAgoIST, getDaysAheadIST } from "../subscriptions/service";

const router = Router();

const SCOPE_COLS = {
  companyCol: subscriptionsTable.companyId,
  branchCol: subscriptionsTable.branchId,
  franchiseeCol: subscriptionsTable.franchiseeId,
  customerCol: subscriptionsTable.customerId,
};

const subSelect = {
  id: subscriptionsTable.id,
  customerId: subscriptionsTable.customerId,
  customerName: customersTable.name,
  vehicleId: subscriptionsTable.vehicleId,
  solarSiteId: subscriptionsTable.solarSiteId,
  serviceId: subscriptionsTable.serviceId,
  serviceName: servicesTable.name,
  type: subscriptionsTable.type,
  status: subscriptionsTable.status,
  startDate: subscriptionsTable.startDate,
  endDate: subscriptionsTable.endDate,
  nextServiceDate: subscriptionsTable.nextServiceDate,
  nextDueDate: subscriptionsTable.nextDueDate,
  frequencyDays: subscriptionsTable.frequencyDays,
  recurrenceRule: subscriptionsTable.recurrenceRule,
  totalServices: subscriptionsTable.totalServices,
  servicesUsed: subscriptionsTable.servicesUsed,
  servicesRemaining: subscriptionsTable.servicesRemaining,
  graceMinutes: subscriptionsTable.graceMinutes,
  price: subscriptionsTable.price,
  paidAmount: subscriptionsTable.paidAmount,
  dueAmount: subscriptionsTable.dueAmount,
  branchId: subscriptionsTable.branchId,
  companyId: subscriptionsTable.companyId,
  franchiseeId: subscriptionsTable.franchiseeId,
  notes: subscriptionsTable.notes,
  cancelledAt: subscriptionsTable.cancelledAt,
  cancellationRemark: subscriptionsTable.cancellationRemark,
  renewalReminderSentAt: subscriptionsTable.renewalReminderSentAt,
  pausedAt: subscriptionsTable.pausedAt,
  resumedAt: subscriptionsTable.resumedAt,
  createdAt: subscriptionsTable.createdAt,
};

router.get("/subscriptions", async (req, res) => {
  try {
    const { customerId, status, type, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);

    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(subscriptionsTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(subscriptionsTable.status, status as (typeof subscriptionsTable.status)["_"]["data"]));
    if (type) conditions.push(eq(subscriptionsTable.type, type as (typeof subscriptionsTable.type)["_"]["data"]));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(subSelect).from(subscriptionsTable)
        .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
        .leftJoin(servicesTable, eq(subscriptionsTable.serviceId, servicesTable.id))
        .where(where).orderBy(desc(subscriptionsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List subscriptions error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subscriptions", async (req, res) => {
  try {
    const {
      customerId, vehicleId, solarSiteId, serviceId, type,
      startDate, endDate, frequencyDays, price, branchId,
      totalServices, recurrenceRule, graceMinutes,
    } = req.body;
    if (!customerId || !type || !startDate || !endDate || price === undefined) {
      return res.status(400).json({ error: "customerId, type, startDate, endDate, and price are required" });
    }
    if (type === "daily_wash") {
      return res.status(400).json({
        error: "Daily car cleaning uses DCMS. Create a plan at Daily Cleaning → Subscriptions instead.",
      });
    }
    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const values = tenantStamp(req, {
      customerId, vehicleId, solarSiteId, serviceId, type, startDate, endDate,
      frequencyDays, price: price.toString(), dueAmount: price.toString(), branchId,
      totalServices: totalServices ?? null,
      servicesUsed: 0,
      servicesRemaining: totalServices ?? null,
      recurrenceRule: recurrenceRule ?? null,
      graceMinutes: graceMinutes ?? 60,
      nextServiceDate: startDate,
      nextDueDate: startDate,
    });
    const [sub] = await db.insert(subscriptionsTable).values(values as typeof subscriptionsTable.$inferInsert).returning();

    const { tryReactivateLegacyCustomer } = await import("../lib/customerReactivation");
    const reactivation = await tryReactivateLegacyCustomer(customerId, "subscription", { type: "subscription", id: sub.id });

    const { syncContractFromSubscription } = await import("../lib/contracts/contractRegistry");
    await syncContractFromSubscription(sub);

    const { enqueuePendingFromSubscription } = await import("../lib/assignments/enqueueAdapters");
    await enqueuePendingFromSubscription(sub.id);

    return res.status(201).json({ ...sub, reactivated: reactivation.reactivated });
  } catch (err) {
    req.log.error({ err }, "Create subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscriptions/expiring-soon", async (req, res) => {
  try {
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      eq(subscriptionsTable.status, "active"),
      sql`${subscriptionsTable.endDate}::date <= ${getDaysAheadIST(7)}`,
    ];

    const data = await db.select(subSelect).from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .leftJoin(servicesTable, eq(subscriptionsTable.serviceId, servicesTable.id))
      .where(and(...conditions));

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Expiring subscriptions error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscriptions/health", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    const where = conditions.length ? and(...conditions) : undefined;

    const [active, paused, expiring, expired, missed, missedThisWeek, totalResult, churnedCount, activeThirtyDaysAgo] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(eq(subscriptionsTable.status, "active"), ...(where ? [where] : []))),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(eq(subscriptionsTable.status, "paused"), ...(where ? [where] : []))),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(
        eq(subscriptionsTable.status, "expiring"),
        ...(where ? [where] : []),
      )),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(eq(subscriptionsTable.status, "expired"), ...(where ? [where] : []))),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(eq(subscriptionsTable.status, "missed"), ...(where ? [where] : []))),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(
        eq(subscriptionsTable.status, "missed"),
        sql`${subscriptionsTable.updatedAt}::date >= ${getDaysAgoIST(7)}`,
        ...(where ? [where] : []),
      )),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(where ?? sql`true`),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(
        eq(subscriptionsTable.status, "cancelled"),
        sql`${subscriptionsTable.cancelledAt}::date >= ${getDaysAgoIST(30)}`,
        ...(where ? [where] : []),
      )),
      db.select({ count: sql<number>`count(*)` }).from(subscriptionsTable).where(and(
        sql`${subscriptionsTable.createdAt}::date < ${getDaysAgoIST(30)}`,
        ...(where ? [where] : []),
      )),
    ]);

    const activeCount = Number(active[0]?.count ?? 0);
    const churned = Number(churnedCount[0]?.count ?? 0);
    const active30 = Number(activeThirtyDaysAgo[0]?.count ?? 0);
    const churnRate = active30 > 0 ? Math.round((churned / active30) * 1000) / 10 : 0;

    return res.json({
      active: activeCount,
      paused: Number(paused[0]?.count ?? 0),
      expiring: Number(expiring[0]?.count ?? 0),
      expired: Number(expired[0]?.count ?? 0),
      missed: Number(missed[0]?.count ?? 0),
      missedThisWeek: Number(missedThisWeek[0]?.count ?? 0),
      total: Number(totalResult[0]?.count ?? 0),
      churnRate,
    });
  } catch (err) {
    req.log.error({ err }, "Subscription health error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscriptions/due-washes", async (req, res) => {
  try {
    const { detectDueWashes } = await import("../subscriptions/dueWashDetection");
    const due = await detectDueWashes();
    return res.json({ data: due, total: due.length });
  } catch (err) {
    req.log.error({ err }, "Due washes error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscriptions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(404).json({ error: "Subscription not found" });
    const [sub] = await db.select(subSelect).from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .leftJoin(servicesTable, eq(subscriptionsTable.serviceId, servicesTable.id))
      .where(eq(subscriptionsTable.id, id));

    if (!sub || !rowInScope(req, sub)) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Get subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/subscriptions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Subscription not found" });
    }
    const { status, endDate, nextServiceDate, nextDueDate, price, totalServices, servicesUsed, graceMinutes, notes } = req.body;
    if (req.body.servicesRemaining !== undefined) {
      return res.status(400).json({ error: "servicesRemaining cannot be set directly; it is computed from totalServices and servicesUsed" });
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (nextServiceDate !== undefined) updateData.nextServiceDate = nextServiceDate;
    if (nextDueDate !== undefined) updateData.nextDueDate = nextDueDate;
    if (price !== undefined) updateData.price = price.toString();
    if (totalServices !== undefined) updateData.totalServices = totalServices;
    if (servicesUsed !== undefined) updateData.servicesUsed = servicesUsed;
    if (graceMinutes !== undefined) updateData.graceMinutes = graceMinutes;
    if (notes !== undefined) updateData.notes = notes;
    const [sub] = await db.update(subscriptionsTable).set(updateData).where(eq(subscriptionsTable.id, id)).returning();
    // Recompute servicesRemaining after update to maintain invariant
    const { recomputeServicesRemaining } = await import("../subscriptions/service");
    await recomputeServicesRemaining(id);
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Update subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subscriptions/:id/pause", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Subscription not found" });
    if (existing.status !== "active") return res.status(400).json({ error: "Only active subscriptions can be paused" });

    const { pauseSubscription } = await import("../subscriptions/service");
    const sub = await pauseSubscription(id);
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Pause subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subscriptions/:id/resume", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Subscription not found" });
    if (existing.status !== "paused") return res.status(400).json({ error: "Only paused subscriptions can be resumed" });

    const { resumeSubscription } = await import("../subscriptions/service");
    const sub = await resumeSubscription(id);
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Resume subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/subscriptions/:id/cancel", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Subscription not found" });
    const { remark } = req.body;

    const { cancelSubscription } = await import("../subscriptions/service");
    const sub = await cancelSubscription(id, remark);
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Cancel subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
