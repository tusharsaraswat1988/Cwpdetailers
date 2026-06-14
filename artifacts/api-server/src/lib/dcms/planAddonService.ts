import {
  db,
  dcmsPlanAddonsTable,
  serviceAddonsTable,
  type DcmsPlanAddon,
} from "@workspace/db";
import { eq, asc, inArray } from "drizzle-orm";

export type PlanAddonInput = {
  addonId: number;
  includedCleanings?: number;
  includedWashes?: number;
  extraPrice?: string | null;
  sortOrder?: number;
};

export type DcmsPlanAddonRow = DcmsPlanAddon & {
  addonName: string;
  addonBasePrice: string;
};

export async function getPlanAddons(planId: number): Promise<DcmsPlanAddonRow[]> {
  const rows = await db
    .select({
      row: dcmsPlanAddonsTable,
      addonName: serviceAddonsTable.name,
      addonBasePrice: serviceAddonsTable.basePrice,
    })
    .from(dcmsPlanAddonsTable)
    .innerJoin(serviceAddonsTable, eq(dcmsPlanAddonsTable.addonId, serviceAddonsTable.id))
    .where(eq(dcmsPlanAddonsTable.planId, planId))
    .orderBy(asc(dcmsPlanAddonsTable.sortOrder), asc(dcmsPlanAddonsTable.id));

  return rows.map(r => ({
    ...r.row,
    addonName: r.addonName,
    addonBasePrice: r.addonBasePrice,
  }));
}

export async function getPlanAddonsForPlans(planIds: number[]): Promise<Map<number, DcmsPlanAddonRow[]>> {
  const map = new Map<number, DcmsPlanAddonRow[]>();
  if (!planIds.length) return map;

  const rows = await db
    .select({
      row: dcmsPlanAddonsTable,
      addonName: serviceAddonsTable.name,
      addonBasePrice: serviceAddonsTable.basePrice,
    })
    .from(dcmsPlanAddonsTable)
    .innerJoin(serviceAddonsTable, eq(dcmsPlanAddonsTable.addonId, serviceAddonsTable.id))
    .where(inArray(dcmsPlanAddonsTable.planId, planIds))
    .orderBy(asc(dcmsPlanAddonsTable.sortOrder), asc(dcmsPlanAddonsTable.id));

  for (const r of rows) {
    const list = map.get(r.row.planId) ?? [];
    list.push({
      ...r.row,
      addonName: r.addonName,
      addonBasePrice: r.addonBasePrice,
    });
    map.set(r.row.planId, list);
  }
  return map;
}

export async function replacePlanAddons(planId: number, addons: PlanAddonInput[]): Promise<void> {
  await db.delete(dcmsPlanAddonsTable).where(eq(dcmsPlanAddonsTable.planId, planId));
  if (!addons.length) return;

  await db.insert(dcmsPlanAddonsTable).values(
    addons.map((a, i) => ({
      planId,
      addonId: a.addonId,
      includedCleanings: a.includedCleanings ?? 0,
      includedWashes: a.includedWashes ?? 0,
      extraPrice: a.extraPrice ?? null,
      sortOrder: a.sortOrder ?? i,
    })),
  );
}

export type PlanAddonTotals = {
  cleanings: number;
  washes: number;
  extraPrice: number;
};

export async function getPlanAddonTotals(planId: number): Promise<PlanAddonTotals> {
  const addons = await getPlanAddons(planId);
  return addons.reduce<PlanAddonTotals>(
    (acc, a) => ({
      cleanings: acc.cleanings + a.includedCleanings,
      washes: acc.washes + a.includedWashes,
      extraPrice: acc.extraPrice + Number(a.extraPrice ?? a.addonBasePrice ?? 0),
    }),
    { cleanings: 0, washes: 0, extraPrice: 0 },
  );
}
