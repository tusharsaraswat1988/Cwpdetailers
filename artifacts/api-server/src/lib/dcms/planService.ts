import {
  db,
  dcmsPlansTable,
  dcmsSubscriptionsTable,
  type DcmsPlan,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";

export async function listPlans(activeOnly = false): Promise<DcmsPlan[]> {
  const conditions = activeOnly ? eq(dcmsPlansTable.isActive, true) : undefined;
  return db.select().from(dcmsPlansTable).where(conditions).orderBy(dcmsPlansTable.name);
}

export async function getPlanById(id: number): Promise<DcmsPlan | null> {
  const rows = await db.select().from(dcmsPlansTable).where(eq(dcmsPlansTable.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPlan(
  data: {
    name: string;
    description?: string;
    price: string;
    includedCleanings: number;
    includedWashes: number;
    weeklyOffs: number;
    companyId?: number | null;
  },
  performedBy: number,
): Promise<DcmsPlan> {
  const [plan] = await db.insert(dcmsPlansTable).values({
    name: data.name,
    description: data.description ?? null,
    price: data.price,
    includedCleanings: data.includedCleanings,
    includedWashes: data.includedWashes,
    weeklyOffs: data.weeklyOffs,
    companyId: data.companyId ?? null,
    isActive: true,
  }).returning();

  await logDcmsActivity({
    action: "plan_created",
    entityType: "plan",
    entityId: plan!.id,
    performedBy,
    metadata: { name: data.name },
  });

  return plan!;
}

export async function updatePlan(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    price: string;
    includedCleanings: number;
    includedWashes: number;
    weeklyOffs: number;
  }>,
  performedBy: number,
): Promise<DcmsPlan | null> {
  const [plan] = await db.update(dcmsPlansTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(dcmsPlansTable.id, id))
    .returning();

  if (plan) {
    await logDcmsActivity({
      action: "plan_updated",
      entityType: "plan",
      entityId: id,
      performedBy,
      metadata: data as Record<string, unknown>,
    });
  }
  return plan ?? null;
}

export async function setPlanActive(id: number, isActive: boolean, performedBy: number): Promise<DcmsPlan | null> {
  const [plan] = await db.update(dcmsPlansTable)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(dcmsPlansTable.id, id))
    .returning();

  if (plan) {
    await logDcmsActivity({
      action: isActive ? "plan_activated" : "plan_deactivated",
      entityType: "plan",
      entityId: id,
      performedBy,
    });
  }
  return plan ?? null;
}

export async function canDeletePlan(id: number): Promise<{ allowed: boolean; reason?: string }> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.planId, id));
  if ((row?.count ?? 0) > 0) {
    return { allowed: false, reason: "Plan has existing subscriptions and cannot be deleted" };
  }
  return { allowed: true };
}

export async function deletePlan(id: number): Promise<{ ok: boolean; error?: string }> {
  const check = await canDeletePlan(id);
  if (!check.allowed) return { ok: false, error: check.reason };
  await db.delete(dcmsPlansTable).where(eq(dcmsPlansTable.id, id));
  return { ok: true };
}

export async function planHasSubscriptions(id: number): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.planId, id));
  return (row?.count ?? 0) > 0;
}
