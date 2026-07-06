/** Ensure canonical DCMS daily-cleaning plans exist (requires vehicle master data). */
import "./load-env.js";
import {
  db,
  pool,
  dcmsPlansTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
} from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

export const CANONICAL_DCMS_PLANS = [
  { name: "Daily Exterior Clean", price: "1000", includedCleanings: 26, includedWashes: 0, weeklyOffs: 4 },
  { name: "1 Time Wash", price: "600", includedCleanings: 0, includedWashes: 1, weeklyOffs: 4 },
  { name: "Daily Clean + 1 Full Wash", price: "1300", includedCleanings: 26, includedWashes: 1, weeklyOffs: 4 },
  { name: "Daily Clean + 2 Full Washes", price: "1600", includedCleanings: 26, includedWashes: 2, weeklyOffs: 4 },
  { name: "Wash Card", price: "1600", includedCleanings: 0, includedWashes: 4, weeklyOffs: 0 },
] as const;

export async function ensureDcmsPlansSeeded(): Promise<{ seeded: boolean; planCount: number }> {
  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(dcmsPlansTable);
  const existing = Number(countRow?.count ?? 0);
  if (existing > 0) {
    return { seeded: false, planCount: existing };
  }

  const [hatchback] = await db
    .select({ id: vehicleCategoriesTable.id })
    .from(vehicleCategoriesTable)
    .where(eq(vehicleCategoriesTable.slug, "hatchback"))
    .limit(1);
  const [seat5] = await db
    .select({ id: seatCategoriesTable.id })
    .from(seatCategoriesTable)
    .where(eq(seatCategoriesTable.slug, "5-seater"))
    .limit(1);

  if (!hatchback || !seat5) {
    throw new Error("Run ensure:master-data first (hatchback + 5-seater required for DCMS plans)");
  }

  for (const plan of CANONICAL_DCMS_PLANS) {
    await db.insert(dcmsPlansTable).values({
      name: plan.name,
      price: plan.price,
      includedCleanings: plan.includedCleanings,
      includedWashes: plan.includedWashes,
      weeklyOffs: plan.weeklyOffs,
      vehicleCategoryId: hatchback.id,
      seatCategoryId: seat5.id,
      isActive: true,
    });
  }

  const all = await db.select({ count: sql<number>`count(*)::int` }).from(dcmsPlansTable);
  return { seeded: true, planCount: Number(all[0]?.count ?? 0) };
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.includes("ensure-dcms-plans");

if (isMain) {
  ensureDcmsPlansSeeded()
    .then(result => {
      if (result.seeded) {
        console.log(`✅ Seeded ${result.planCount} DCMS plans.`);
      } else {
        console.log(`DCMS plans already present (${result.planCount}).`);
      }
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
