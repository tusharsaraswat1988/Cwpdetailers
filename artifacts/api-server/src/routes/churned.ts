import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionsTable, customersTable } from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { tenantFilters } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: subscriptionsTable.companyId,
  branchCol: subscriptionsTable.branchId,
  franchiseeCol: subscriptionsTable.franchiseeId,
  customerCol: subscriptionsTable.customerId,
};

router.get("/churned", async (req, res) => {
  try {
    const { branchId } = req.query as Record<string, string>;
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      eq(subscriptionsTable.status, "cancelled" as (typeof subscriptionsTable.status)["_"]["data"]),
    ];
    if (branchId) conditions.push(eq(subscriptionsTable.branchId, parseInt(branchId)));

    const data = await db.select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerEmail: customersTable.email,
      customerCity: customersTable.city,
      type: subscriptionsTable.type,
      startDate: subscriptionsTable.startDate,
      endDate: subscriptionsTable.endDate,
      cancelledAt: subscriptionsTable.cancelledAt,
      cancellationRemark: subscriptionsTable.cancellationRemark,
      price: subscriptionsTable.price,
      messageSentAt: subscriptionsTable.messageSentAt,
      branchId: subscriptionsTable.branchId,
    }).from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .where(and(...conditions))
      .orderBy(desc(subscriptionsTable.cancelledAt));

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List churned customers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/churned/:id/remark", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const conditions = [eq(subscriptionsTable.id, id), ...tenantFilters(req, SCOPE_COLS)];
    const { remark } = req.body;
    const [updated] = await db.update(subscriptionsTable)
      .set({ cancellationRemark: remark, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });
    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Update churn remark error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/churned/bulk-message", async (req, res) => {
  try {
    const { subscriptionIds, message } = req.body as { subscriptionIds: number[]; message: string };
    if (!subscriptionIds?.length || !message) {
      return res.status(400).json({ error: "subscriptionIds and message are required" });
    }

    // Only allow touching subscriptions the caller can see.
    const scopeConds = tenantFilters(req, SCOPE_COLS);
    const targets = await db.select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
    }).from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .where(and(inArray(subscriptionsTable.id, subscriptionIds), ...scopeConds));

    if (!targets.length) return res.status(404).json({ error: "No matching subscriptions in your scope" });

    await db.update(subscriptionsTable)
      .set({ messageSentAt: new Date(), updatedAt: new Date() })
      .where(and(inArray(subscriptionsTable.id, targets.map(t => t.id)), ...scopeConds));

    const recipients = targets.map(t => ({
      phone: t.customerPhone,
      name: t.customerName,
      message: message.replace("{name}", t.customerName ?? "Customer"),
    }));

    req.log.info({ recipients: recipients.length }, "Bulk re-engagement message dispatched");

    return res.json({
      dispatched: recipients.length,
      recipients,
      note: "Messages logged. Integrate WhatsApp Business API to send live.",
    });
  } catch (err) {
    req.log.error({ err }, "Bulk message error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
