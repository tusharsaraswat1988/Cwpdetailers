import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, customersTable, servicesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";

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
  frequencyDays: subscriptionsTable.frequencyDays,
  price: subscriptionsTable.price,
  paidAmount: subscriptionsTable.paidAmount,
  dueAmount: subscriptionsTable.dueAmount,
  branchId: subscriptionsTable.branchId,
  companyId: subscriptionsTable.companyId,
  franchiseeId: subscriptionsTable.franchiseeId,
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
    const { customerId, vehicleId, solarSiteId, serviceId, type, startDate, endDate, frequencyDays, price, branchId } = req.body;
    if (!customerId || !type || !startDate || !endDate || price === undefined) {
      return res.status(400).json({ error: "customerId, type, startDate, endDate, and price are required" });
    }
    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const values = tenantStamp(req, {
      customerId, vehicleId, solarSiteId, serviceId, type, startDate, endDate,
      frequencyDays, price: price.toString(), dueAmount: price.toString(), branchId,
    });
    const [sub] = await db.insert(subscriptionsTable).values(values as typeof subscriptionsTable.$inferInsert).returning();
    return res.status(201).json(sub);
  } catch (err) {
    req.log.error({ err }, "Create subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/subscriptions/expiring-soon", async (req, res) => {
  try {
    const sevenDaysLater = new Date();
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      eq(subscriptionsTable.status, "active"),
      sql`${subscriptionsTable.endDate}::date <= ${sevenDaysLater.toISOString().split('T')[0]}`,
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

router.get("/subscriptions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
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
    const { status, endDate, nextServiceDate, price } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (endDate !== undefined) updateData.endDate = endDate;
    if (nextServiceDate !== undefined) updateData.nextServiceDate = nextServiceDate;
    if (price !== undefined) updateData.price = price.toString();
    const [sub] = await db.update(subscriptionsTable).set(updateData).where(eq(subscriptionsTable.id, id)).returning();
    return res.json(sub);
  } catch (err) {
    req.log.error({ err }, "Update subscription error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
