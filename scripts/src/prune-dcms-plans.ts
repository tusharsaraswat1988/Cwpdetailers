import "./load-env.js";
import {
  db,
  dcmsPlansTable,
  dcmsSubscriptionsTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
} from "@workspace/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

/** Five website offerings — one row each (Hatchback · Up to 5 Seater baseline). */
const CANONICAL_PLANS = [
  { name: "Daily Exterior Clean", price: "1000", includedCleanings: 26, includedWashes: 0, weeklyOffs: 4 },
  { name: "1 Time Wash", price: "600", includedCleanings: 0, includedWashes: 1, weeklyOffs: 4 },
  { name: "Daily Clean + 1 Full Wash", price: "1300", includedCleanings: 26, includedWashes: 1, weeklyOffs: 4 },
  { name: "Daily Clean + 2 Full Washes", price: "1600", includedCleanings: 26, includedWashes: 2, weeklyOffs: 4 },
  { name: "Wash Card", price: "1600", includedCleanings: 0, includedWashes: 4, weeklyOffs: 0 },
] as const;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

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
    throw new Error("Run seed:master-data first (hatchback + 5-seater required)");
  }

  const keepIds: number[] = [];

  for (const plan of CANONICAL_PLANS) {
    const [existing] = await db
      .select({ id: dcmsPlansTable.id })
      .from(dcmsPlansTable)
      .where(and(
        eq(dcmsPlansTable.includedCleanings, plan.includedCleanings),
        eq(dcmsPlansTable.includedWashes, plan.includedWashes),
        eq(dcmsPlansTable.weeklyOffs, plan.weeklyOffs),
        eq(dcmsPlansTable.vehicleCategoryId, hatchback.id),
        eq(dcmsPlansTable.seatCategoryId, seat5.id),
      ))
      .limit(1);

    if (existing) {
      await db.update(dcmsPlansTable)
        .set({ name: plan.name, price: plan.price, isActive: true, updatedAt: new Date() })
        .where(eq(dcmsPlansTable.id, existing.id));
      keepIds.push(existing.id);
      continue;
    }

    const [created] = await db.insert(dcmsPlansTable).values({
      name: plan.name,
      price: plan.price,
      includedCleanings: plan.includedCleanings,
      includedWashes: plan.includedWashes,
      weeklyOffs: plan.weeklyOffs,
      vehicleCategoryId: hatchback.id,
      seatCategoryId: seat5.id,
      isActive: true,
    }).returning({ id: dcmsPlansTable.id });
    keepIds.push(created!.id);
  }

  const referenced = await db
    .selectDistinct({ planId: dcmsSubscriptionsTable.planId })
    .from(dcmsSubscriptionsTable)
    .where(notInArray(dcmsSubscriptionsTable.planId, keepIds));

  const orphanPlanIds = referenced.map(r => r.planId);
  if (orphanPlanIds.length) {
    console.warn(
      `Warning: ${orphanPlanIds.length} plan(s) have subscriptions and were not deleted: ${orphanPlanIds.join(", ")}`,
    );
  }

  const toDelete = await db
    .select({ id: dcmsPlansTable.id })
    .from(dcmsPlansTable)
    .where(and(
      notInArray(dcmsPlansTable.id, keepIds),
      orphanPlanIds.length ? notInArray(dcmsPlansTable.id, orphanPlanIds) : sql`true`,
    ));

  if (toDelete.length) {
    await db.delete(dcmsPlansTable).where(inArray(dcmsPlansTable.id, toDelete.map(r => r.id)));
  }

  const [stats] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dcmsPlansTable);

  console.log(`Kept ${keepIds.length} canonical plans (ids: ${keepIds.join(", ")})`);
  console.log(`Deleted ${toDelete.length} extra plans`);
  console.log(`Total plans in DB: ${stats?.total ?? 0}`);
  if (orphanPlanIds.length) {
    console.log(`Total including subscription-linked extras: ${(stats?.total ?? 0)}`);
  }

  const { pool } = await import("@workspace/db");
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
