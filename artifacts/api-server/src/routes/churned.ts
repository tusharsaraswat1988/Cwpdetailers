import { Router } from "express";
import { db } from "@workspace/db";
import {
  subscriptionsTable,
  customersTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
} from "@workspace/db";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { tenantFilters, resolveEffectiveBranchId, BranchAccessDeniedError } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: subscriptionsTable.companyId,
  branchCol: subscriptionsTable.branchId,
  franchiseeCol: subscriptionsTable.franchiseeId,
  customerCol: subscriptionsTable.customerId,
};

const DCMS_SCOPE_COLS = {
  companyCol: dcmsSubscriptionsTable.companyId,
  branchCol: dcmsSubscriptionsTable.branchId,
  franchiseeCol: dcmsSubscriptionsTable.franchiseeId,
  customerCol: dcmsSubscriptionsTable.customerId,
};

router.get("/churned", async (req, res) => {
  try {
    const { branchId } = req.query as Record<string, string>;
    const effectiveBranchId = resolveEffectiveBranchId(req, branchId);
    const conditions = [
      ...tenantFilters(req, SCOPE_COLS),
      eq(subscriptionsTable.status, "cancelled" as (typeof subscriptionsTable.status)["_"]["data"]),
    ];
    if (effectiveBranchId) conditions.push(eq(subscriptionsTable.branchId, effectiveBranchId));

    const legacyData = await db.select({
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

    const dcmsConditions = [
      ...tenantFilters(req, DCMS_SCOPE_COLS),
      eq(dcmsSubscriptionsTable.status, "cancelled" as (typeof dcmsSubscriptionsTable.status)["_"]["data"]),
    ];
    if (effectiveBranchId) dcmsConditions.push(eq(dcmsSubscriptionsTable.branchId, effectiveBranchId));

    const dcmsData = await db.select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerEmail: customersTable.email,
      customerCity: customersTable.city,
      type: dcmsSubscriptionsTable.subscriptionType,
      startDate: dcmsSubscriptionsTable.startDate,
      endDate: sql<string | null>`NULL`,
      cancelledAt: sql<Date | null>`COALESCE(${dcmsSubscriptionsTable.cancellationRequestedAt}, ${dcmsSubscriptionsTable.updatedAt})`,
      cancellationRemark: dcmsSubscriptionsTable.cancellationReason,
      price: sql<string>`COALESCE(${dcmsPlansTable.price}::text, '0')`,
      messageSentAt: sql<Date | null>`NULL`,
      branchId: dcmsSubscriptionsTable.branchId,
    }).from(dcmsSubscriptionsTable)
      .leftJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
      .leftJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .where(and(...dcmsConditions))
      .orderBy(desc(dcmsSubscriptionsTable.updatedAt));

    const combined = [...legacyData, ...dcmsData];
    combined.sort((a, b) => {
      const timeA = a.cancelledAt ? new Date(a.cancelledAt).getTime() : 0;
      const timeB = b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0;
      return timeB - timeA;
    });

    return res.json(combined);
  } catch (err) {
    if (err instanceof BranchAccessDeniedError) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "List churned customers error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/churned/:id/remark", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { remark } = req.body;
    const conditions = [eq(subscriptionsTable.id, id), ...tenantFilters(req, SCOPE_COLS)];
    const [updated] = await db.update(subscriptionsTable)
      .set({ cancellationRemark: remark, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();
    if (updated) return res.json(updated);

    const dcmsConditions = [eq(dcmsSubscriptionsTable.id, id), ...tenantFilters(req, DCMS_SCOPE_COLS)];
    const [dcmsUpdated] = await db.update(dcmsSubscriptionsTable)
      .set({ cancellationReason: remark, updatedAt: new Date() })
      .where(and(...dcmsConditions))
      .returning();
    if (!dcmsUpdated) return res.status(404).json({ error: "Not found" });
    return res.json(dcmsUpdated);
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

    const scopeConds = tenantFilters(req, SCOPE_COLS);
    const targets = await db.select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
    }).from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .where(and(inArray(subscriptionsTable.id, subscriptionIds), ...scopeConds));

    const dcmsScopeConds = tenantFilters(req, DCMS_SCOPE_COLS);
    const dcmsTargets = await db.select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
    }).from(dcmsSubscriptionsTable)
      .leftJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
      .where(and(inArray(dcmsSubscriptionsTable.id, subscriptionIds), ...dcmsScopeConds));

    const allTargets = [...targets, ...dcmsTargets];
    if (!allTargets.length) return res.status(404).json({ error: "No matching subscriptions in your scope" });

    if (targets.length) {
      await db.update(subscriptionsTable)
        .set({ messageSentAt: new Date(), updatedAt: new Date() })
        .where(and(inArray(subscriptionsTable.id, targets.map(t => t.id)), ...scopeConds));
    }
    if (dcmsTargets.length) {
      await db.update(dcmsSubscriptionsTable)
        .set({ updatedAt: new Date() })
        .where(and(inArray(dcmsSubscriptionsTable.id, dcmsTargets.map(t => t.id)), ...dcmsScopeConds));
    }

    const seenPhones = new Set<string>();
    const recipients: Array<{ phone: string; name: string | null; message: string }> = [];
    for (const t of allTargets) {
      if (t.customerPhone && !seenPhones.has(t.customerPhone)) {
        seenPhones.add(t.customerPhone);
        recipients.push({
          phone: t.customerPhone,
          name: t.customerName,
          message: message.replace("{name}", t.customerName ?? "Customer"),
        });
      }
    }

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
