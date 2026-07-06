import {

  db,

  dcmsPlansTable,

  dcmsSubscriptionsTable,

  vehicleCategoriesTable,

  seatCategoriesTable,

  serviceAddonsTable,

  type DcmsPlan,

} from "@workspace/db";

import { eq, and, sql, inArray, isNotNull } from "drizzle-orm";

import { logDcmsActivity } from "./auditLog";

import { getVehiclePlanContext, planMatchesVehicle } from "./vehiclePlanMatch";

import { getSeatPricingTier, getSeatTierLabel, SEAT_TIER_CANONICAL_SLUGS, type SeatPricingTier } from "./seatPricingTier";

import { expandPlanScopes, type PlanScopeInput } from "./planScope";

import {

  getPlanAddons,

  getPlanAddonsForPlans,

  replacePlanAddons,

  type DcmsPlanAddonRow,

  type PlanAddonInput,

} from "./planAddonService";



export type DcmsPlanRow = DcmsPlan & {

  vehicleCategoryName?: string | null;

  seatCategoryName?: string | null;

  seatCount?: number | null;

  seatPricingTier?: "standard" | "large" | null;

  seatPricingTierLabel?: string | null;

  addons?: DcmsPlanAddonRow[];

  scopeVehicleLabel?: string | null;

  scopeSeatLabel?: string | null;

};



function toPlanRow(

  plan: DcmsPlan,

  vehicleCategoryName?: string | null,

  seatCategoryName?: string | null,

  seatCount?: number | null,

  addons?: DcmsPlanAddonRow[],

): DcmsPlanRow {

  const tier = seatCount != null ? getSeatPricingTier(seatCount) : null;

  return {

    ...plan,

    vehicleCategoryName: plan.vehicleCategoryId == null ? "All Car Types" : vehicleCategoryName,

    seatCategoryName,

    seatCount,

    seatPricingTier: tier,

    seatPricingTierLabel: plan.seatCategoryId == null ? "All Seater Tiers" : (tier ? getSeatTierLabel(tier) : null),

    addons,

    scopeVehicleLabel: plan.vehicleCategoryId == null ? "All Car Types" : (vehicleCategoryName ?? null),

    scopeSeatLabel: plan.seatCategoryId == null ? "All Seater Tiers" : (tier ? getSeatTierLabel(tier) : seatCategoryName ?? null),

  };

}



async function enrichPlans(plans: DcmsPlan[], withAddons = true): Promise<DcmsPlanRow[]> {

  if (!plans.length) return [];

  const ids = plans.map(p => p.id);

  const addonMap = withAddons ? await getPlanAddonsForPlans(ids) : new Map();



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



  return rows.map(r => toPlanRow(

    r.plan,

    r.vehicleCategoryName,

    r.seatCategoryName,

    r.seatCount,

    addonMap.get(r.plan.id),

  ));

}



export async function listPlans(
  activeOnly = false,
  vehicleId?: number,
  linkedOnly = false,
  homepageOnly = false,
): Promise<DcmsPlanRow[]> {
  const conditions = [];
  if (activeOnly) conditions.push(eq(dcmsPlansTable.isActive, true));
  if (homepageOnly) conditions.push(eq(dcmsPlansTable.showOnHomepage, true));

  if (linkedOnly) {
    conditions.push(isNotNull(dcmsPlansTable.seatCategoryId));
  }



  const plans = await db

    .select()

    .from(dcmsPlansTable)

    .where(conditions.length ? and(...conditions) : undefined)

    .orderBy(dcmsPlansTable.name);



  if (vehicleId) {
    const enriched = await enrichPlans(plans);
    const active = enriched.filter(p => p.isActive);

    const vehicle = await getVehiclePlanContext(vehicleId);
    if (!vehicle) {
      // Vehicle missing model/category linkage — offer the same sellable plans as catalog.
      return active;
    }

    const matched = active.filter(p => planMatchesVehicle(p, vehicle, p.seatCount));
    // Prefer vehicle-matched pricing; fall back so daily cleaning is never hidden in Book Service.
    return matched.length > 0 ? matched : active;
  }



  return enrichPlans(plans);

}



export async function getPlanById(id: number): Promise<DcmsPlanRow | null> {

  const rows = await enrichPlans(

    await db.select().from(dcmsPlansTable).where(eq(dcmsPlansTable.id, id)).limit(1),

  );

  return rows[0] ?? null;

}



async function loadSeatCategoryIdByTier(): Promise<Map<SeatPricingTier, number>> {

  const seats = await db.select().from(seatCategoriesTable);

  const map = new Map<SeatPricingTier, number>();

  for (const tier of Object.keys(SEAT_TIER_CANONICAL_SLUGS) as SeatPricingTier[]) {

    const slug = SEAT_TIER_CANONICAL_SLUGS[tier];

    const row = seats.find(s => s.slug === slug);

    if (row) map.set(tier, row.id);

  }

  return map;

}



async function resolveAddonPrice(addons: PlanAddonInput[]): Promise<number> {

  if (!addons.length) return 0;

  const ids = addons.map(a => a.addonId);

  const catalog = await db

    .select({ id: serviceAddonsTable.id, basePrice: serviceAddonsTable.basePrice })

    .from(serviceAddonsTable)

    .where(inArray(serviceAddonsTable.id, ids));

  const priceById = new Map(catalog.map(c => [c.id, Number(c.basePrice)]));

  return addons.reduce((sum, a) => {

    const price = a.extraPrice != null && a.extraPrice !== ""

      ? Number(a.extraPrice)

      : (priceById.get(a.addonId) ?? 0);

    return sum + price;

  }, 0);

}



export type CreatePlanInput = {

  name: string;

  description?: string;

  price: string;

  includedCleanings: number;

  includedWashes: number;

  weeklyOffs: number;

  vehicleCategoryId?: number | null;

  seatCategoryId?: number | null;

  allVehicleCategories?: boolean;

  vehicleCategoryIds?: number[];

  allSeatTiers?: boolean;

  seatPricingTiers?: SeatPricingTier[];

  addons?: PlanAddonInput[];

  showOnHomepage?: boolean;

  companyId?: number | null;

};



async function insertSinglePlan(

  data: {

    name: string;

    description?: string | null;

    price: string;

    includedCleanings: number;

    includedWashes: number;

    weeklyOffs: number;

    vehicleCategoryId: number | null;

    seatCategoryId: number | null;

    companyId?: number | null;

    showOnHomepage?: boolean;

  },

  addons: PlanAddonInput[],

  performedBy: number,

): Promise<DcmsPlanRow> {

  const [plan] = await db.insert(dcmsPlansTable).values({

    name: data.name,

    description: data.description ?? null,

    price: data.price,

    includedCleanings: data.includedCleanings,

    includedWashes: data.includedWashes,

    weeklyOffs: data.weeklyOffs,

    vehicleCategoryId: null,

    seatCategoryId: data.seatCategoryId,

    companyId: data.companyId ?? null,

    isActive: true,

    showOnHomepage: data.showOnHomepage ?? false,

  }).returning();



  if (addons.length) {

    await replacePlanAddons(plan!.id, addons);

  }



  await logDcmsActivity({

    action: "plan_created",

    entityType: "plan",

    entityId: plan!.id,

    performedBy,

    metadata: {

      name: data.name,

      vehicleCategoryId: data.vehicleCategoryId,

      seatCategoryId: data.seatCategoryId,

      addonCount: addons.length,

    },

  });



  return (await getPlanById(plan!.id))!;

}



export async function createPlan(

  data: CreatePlanInput,

  performedBy: number,

): Promise<DcmsPlanRow> {

  const plans = await createPlans(data, performedBy);

  return plans[0]!;

}



export async function createPlans(

  data: CreatePlanInput,

  performedBy: number,

): Promise<DcmsPlanRow[]> {

  const addons = data.addons ?? [];

  const addonCleanings = addons.reduce((s, a) => s + (a.includedCleanings ?? 0), 0);

  const addonWashes = addons.reduce((s, a) => s + (a.includedWashes ?? 0), 0);

  const addonPrice = await resolveAddonPrice(addons);

  const totalPrice = (Number(data.price) + addonPrice).toFixed(2);

  const totalCleanings = data.includedCleanings + addonCleanings;

  const totalWashes = data.includedWashes + addonWashes;



  const hasExplicitScope = data.vehicleCategoryId != null || data.seatCategoryId != null

    || data.allVehicleCategories != null || data.vehicleCategoryIds != null

    || data.allSeatTiers != null || data.seatPricingTiers != null;



  if (!hasExplicitScope) {
    if (data.seatCategoryId == null && !data.allSeatTiers && !data.seatPricingTiers?.length) {
      throw new Error("Select at least one seater tier, or choose All");
    }
  }



  const scopeInput: PlanScopeInput = {

    allVehicleCategories: data.allVehicleCategories,

    vehicleCategoryIds: data.vehicleCategoryIds,

    allSeatTiers: data.allSeatTiers,

    seatPricingTiers: data.seatPricingTiers,

  };



  let combos: Array<{ vehicleCategoryId: number | null; seatCategoryId: number | null }>;



  if (data.seatCategoryId != null && !data.allSeatTiers && !data.seatPricingTiers?.length) {
    combos = [{ vehicleCategoryId: null, seatCategoryId: data.seatCategoryId }];
  } else {

    const seatMap = await loadSeatCategoryIdByTier();

    combos = expandPlanScopes(scopeInput, seatMap);

  }



  const created: DcmsPlanRow[] = [];

  for (const combo of combos) {

    const row = await insertSinglePlan({

      name: data.name,

      description: data.description,

      price: totalPrice,

      includedCleanings: totalCleanings,

      includedWashes: totalWashes,

      weeklyOffs: data.weeklyOffs,

      vehicleCategoryId: combo.vehicleCategoryId,

      seatCategoryId: combo.seatCategoryId,

      companyId: data.companyId,

      showOnHomepage: data.showOnHomepage,

    }, addons, performedBy);

    created.push(row);

  }

  return created;

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

    vehicleCategoryId: number | null;

    seatCategoryId: number | null;

    allVehicleCategories: boolean;

    allSeatTiers: boolean;

    addons: PlanAddonInput[];

    showOnHomepage?: boolean;

  }>,

  performedBy: number,

): Promise<DcmsPlanRow | null> {

  const existing = await getPlanById(id);

  if (!existing) return null;



  const { addons, allVehicleCategories, allSeatTiers, ...planFields } = data;



  const patch: Record<string, unknown> = { ...planFields, updatedAt: new Date() };

  // Plans are priced by seater tier only — always clear car type on update.
  patch.vehicleCategoryId = null;

  if (allSeatTiers) patch.seatCategoryId = null;



  if (addons != null) {

    const baseCleanings = data.includedCleanings ?? 0;

    const baseWashes = data.includedWashes ?? 0;

    const basePrice = data.price != null ? Number(data.price) : Number(existing.price);

    const addonCleanings = addons.reduce((s, a) => s + (a.includedCleanings ?? 0), 0);

    const addonWashes = addons.reduce((s, a) => s + (a.includedWashes ?? 0), 0);

    const addonPrice = await resolveAddonPrice(addons);

    patch.includedCleanings = baseCleanings + addonCleanings;

    patch.includedWashes = baseWashes + addonWashes;

    patch.price = (basePrice + addonPrice).toFixed(2);

    await replacePlanAddons(id, addons);

  }



  const [plan] = await db.update(dcmsPlansTable)

    .set(patch)

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



export async function deletePlan(

  id: number,

  performedBy?: number,

): Promise<{ ok: boolean; error?: string }> {

  const plan = await getPlanById(id);

  if (!plan) return { ok: false, error: "Plan not found" };



  const check = await canDeletePlan(id);

  if (!check.allowed) return { ok: false, error: check.reason };



  await db.delete(dcmsPlansTable).where(eq(dcmsPlansTable.id, id));



  if (performedBy != null) {

    await logDcmsActivity({

      action: "plan_deleted",

      entityType: "plan",

      entityId: id,

      performedBy,

      metadata: { name: plan.name },

    });

  }



  return { ok: true };

}



export async function planHasSubscriptions(id: number): Promise<boolean> {

  const [row] = await db

    .select({ count: sql<number>`count(*)::int` })

    .from(dcmsSubscriptionsTable)

    .where(eq(dcmsSubscriptionsTable.planId, id));

  return (row?.count ?? 0) > 0;

}



export { getPlanAddons };


