import {
  db,
  dcmsPlansTable,
  dcmsSubscriptionsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
  type DcmsPlan,
} from "@workspace/db";
import { eq, and, sql, inArray, isNotNull } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { getVehiclePlanContext } from "./vehiclePlanMatch";
import { getSeatPricingTier, getSeatTierLabel } from "./seatPricingTier";

export type DcmsPlanRow = DcmsPlan & {
  vehicleCategoryName?: string | null;
  seatCategoryName?: string | null;
  seatCount?: number | null;
  seatPricingTier?: "standard" | "large" | null;
  seatPricingTierLabel?: string | null;
};

function toPlanRow(
  plan: DcmsPlan,
  vehicleCategoryName?: string | null,
  seatCategoryName?: string | null,
  seatCount?: number | null,
): DcmsPlanRow {
  const tier = seatCount != null ? getSeatPricingTier(seatCount) : null;
  return {
    ...plan,
    vehicleCategoryName,
    seatCategoryName,
    seatCount,
    seatPricingTier: tier,
    seatPricingTierLabel: tier ? getSeatTierLabel(tier) : null,
  };
}

async function enrichPlans(plans: DcmsPlan[]): Promise<DcmsPlanRow[]> {
  if (!plans.length) return [];
  const ids = plans.map(p => p.id);
  const rows = await db
    .select({
      plan: dcmsPlansTable,
      vehicleCategoryName: vehicleCategoriesTable.name,
      seatCategoryName: seatCategoriesTable.name,
      seatCount: seatCategoriesTable.seatCount,
    })
    .from(dcmsPlansTable)
    .leftJoin(vehicleCategoriesTable, eq(dcmsPlansTable.vehicleCategoryId, vehicleCategoriesTable.id))
    .leftJoin(seatCategoriesTable, eq(dcmsPlansTable.seatCategoryId, seatCategoriesTable.id))
    .where(inArray(dcmsPlansTable.id, ids))
    .orderBy(dcmsPlansTable.name);

  return rows.map(r => toPlanRow(r.plan, r.vehicleCategoryName, r.seatCategoryName, r.seatCount));
}

export async function listPlans(
  activeOnly = false,
  vehicleId?: number,
  linkedOnly = false,
): Promise<DcmsPlanRow[]> {
  const conditions = [];
  if (activeOnly) conditions.push(eq(dcmsPlansTable.isActive, true));
  if (linkedOnly) {
    conditions.push(isNotNull(dcmsPlansTable.vehicleCategoryId));
    conditions.push(isNotNull(dcmsPlansTable.seatCategoryId));
  }

  let plans = await db
    .select()
    .from(dcmsPlansTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(dcmsPlansTable.name);

  if (vehicleId) {
    const vehicle = await getVehiclePlanContext(vehicleId);
    if (!vehicle) return [];
    const enriched = await enrichPlans(plans);
    return enriched.filter(p =>
      p.vehicleCategoryId === vehicle.vehicleCategoryId
      && p.seatCount != null
      && getSeatPricingTier(p.seatCount) === vehicle.seatPricingTier,
    );
  }

  return enrichPlans(plans);
}

export async function getPlanById(id: number): Promise<DcmsPlanRow | null> {
  const rows = await enrichPlans(
    await db.select().from(dcmsPlansTable).where(eq(dcmsPlansTable.id, id)).limit(1),
  );
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
    vehicleCategoryId: number;
    seatCategoryId: number;
    companyId?: number | null;
  },
  performedBy: number,
): Promise<DcmsPlanRow> {
  const [plan] = await db.insert(dcmsPlansTable).values({
    name: data.name,
    description: data.description ?? null,
    price: data.price,
    includedCleanings: data.includedCleanings,
    includedWashes: data.includedWashes,
    weeklyOffs: data.weeklyOffs,
    vehicleCategoryId: data.vehicleCategoryId,
    seatCategoryId: data.seatCategoryId,
    companyId: data.companyId ?? null,
    isActive: true,
  }).returning();

  await logDcmsActivity({
    action: "plan_created",
    entityType: "plan",
    entityId: plan!.id,
    performedBy,
    metadata: {
      name: data.name,
      vehicleCategoryId: data.vehicleCategoryId,
      seatCategoryId: data.seatCategoryId,
    },
  });

  return (await getPlanById(plan!.id))!;
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
    vehicleCategoryId: number;
    seatCategoryId: number;
  }>,
  performedBy: number,
): Promise<DcmsPlanRow | null> {
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
  return plan ? getPlanById(id) : null;
}

export async function setPlanActive(id: number, isActive: boolean, performedBy: number): Promise<DcmsPlanRow | null> {
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
  return plan ? getPlanById(id) : null;
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
