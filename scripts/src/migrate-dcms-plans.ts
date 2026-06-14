import "./load-env.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  db,
  dcmsPlansTable,
  vehicleCategoriesTable,
  seatCategoriesTable,
} from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";

type SeatPricingTier = "standard" | "large";

const SEAT_TIER_CANONICAL_SLUGS: Record<SeatPricingTier, string> = {
  standard: "5-seater",
  large: "7-seater",
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

type PlanTemplate = {
  name: string;
  includedCleanings: number;
  includedWashes: number;
  weeklyOffs: number;
  prices: Record<SeatPricingTier, string>;
};

/** Website pricing — wash/clean bundle × seater tier. */
const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    name: "Daily Exterior Clean",
    includedCleanings: 26,
    includedWashes: 0,
    weeklyOffs: 4,
    prices: { standard: "1000", large: "1000" },
  },
  {
    name: "1 Time Wash",
    includedCleanings: 0,
    includedWashes: 1,
    weeklyOffs: 4,
    prices: { standard: "600", large: "700" },
  },
  {
    name: "Daily Clean + 1 Full Wash",
    includedCleanings: 26,
    includedWashes: 1,
    weeklyOffs: 4,
    prices: { standard: "1300", large: "1600" },
  },
  {
    name: "Daily Clean + 2 Full Washes",
    includedCleanings: 26,
    includedWashes: 2,
    weeklyOffs: 4,
    prices: { standard: "1600", large: "1900" },
  },
];

const TIER_ORDER: SeatPricingTier[] = ["standard", "large"];

async function applySchemaMigration() {
  const sqlPath = path.join(root, "lib/db/migrations/018_dcms_plan_vehicle_type.sql");
  const { pool } = await import("@workspace/db");
  console.log("Applying 018_dcms_plan_vehicle_type.sql…");
  await pool.query(readFileSync(sqlPath, "utf8"));
  console.log("  ✓ Schema migration applied");
}

async function loadMasters() {
  const categories = await db
    .select({ id: vehicleCategoriesTable.id, name: vehicleCategoriesTable.name })
    .from(vehicleCategoriesTable)
    .where(eq(vehicleCategoriesTable.isActive, true))
    .orderBy(vehicleCategoriesTable.sortOrder);

  const seats = await db
    .select({ id: seatCategoriesTable.id, slug: seatCategoriesTable.slug, seatCount: seatCategoriesTable.seatCount })
    .from(seatCategoriesTable)
    .where(eq(seatCategoriesTable.isActive, true));

  const seatBySlug = Object.fromEntries(seats.map(s => [s.slug, s]));
  const tierSeatIds: Record<SeatPricingTier, number> = {
    standard: seatBySlug[SEAT_TIER_CANONICAL_SLUGS.standard]?.id,
    large: seatBySlug[SEAT_TIER_CANONICAL_SLUGS.large]?.id,
  };

  if (!tierSeatIds.standard || !tierSeatIds.large) {
    throw new Error("Run seed:master-data first — 5-seater and 7-seater categories are required");
  }
  if (!categories.length) {
    throw new Error("No active vehicle categories found. Run seed:master-data first.");
  }

  return { categories, tierSeatIds };
}

async function upsertLinkedPlan(opts: {
  name: string;
  vehicleCategoryId: number;
  seatCategoryId: number;
  price: string;
  includedCleanings: number;
  includedWashes: number;
  weeklyOffs: number;
}) {
  const [existing] = await db
    .select({ id: dcmsPlansTable.id })
    .from(dcmsPlansTable)
    .where(and(
      eq(dcmsPlansTable.vehicleCategoryId, opts.vehicleCategoryId),
      eq(dcmsPlansTable.seatCategoryId, opts.seatCategoryId),
      eq(dcmsPlansTable.includedCleanings, opts.includedCleanings),
      eq(dcmsPlansTable.includedWashes, opts.includedWashes),
      eq(dcmsPlansTable.weeklyOffs, opts.weeklyOffs),
      isNull(dcmsPlansTable.companyId),
    ))
    .limit(1);

  if (existing) {
    await db.update(dcmsPlansTable)
      .set({
        name: opts.name,
        price: opts.price,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(dcmsPlansTable.id, existing.id));
    return { action: "updated" as const, id: existing.id };
  }

  const [created] = await db.insert(dcmsPlansTable).values({
    name: opts.name,
    price: opts.price,
    includedCleanings: opts.includedCleanings,
    includedWashes: opts.includedWashes,
    weeklyOffs: opts.weeklyOffs,
    vehicleCategoryId: opts.vehicleCategoryId,
    seatCategoryId: opts.seatCategoryId,
    isActive: true,
  }).returning({ id: dcmsPlansTable.id });

  return { action: "created" as const, id: created!.id };
}

async function seedLinkedPlans() {
  const { categories, tierSeatIds } = await loadMasters();
  let created = 0;
  let updated = 0;

  for (const cat of categories) {
    for (const template of PLAN_TEMPLATES) {
      for (const tier of TIER_ORDER) {
        const tierLabel = tier === "standard" ? "Up to 5 Seater" : "5+ Seater";
        const result = await upsertLinkedPlan({
          name: `${template.name} (${cat.name} · ${tierLabel})`,
          vehicleCategoryId: cat.id,
          seatCategoryId: tierSeatIds[tier],
          price: template.prices[tier],
          includedCleanings: template.includedCleanings,
          includedWashes: template.includedWashes,
          weeklyOffs: template.weeklyOffs,
        });
        if (result.action === "created") created++;
        else updated++;
      }
    }
  }

  console.log(`  ✓ Linked plans: ${created} created, ${updated} updated (${categories.length} car types × ${PLAN_TEMPLATES.length} bundles × 2 seater tiers)`);
}

async function migrateLegacyPlans() {
  const legacy = await db
    .select()
    .from(dcmsPlansTable)
    .where(and(
      isNull(dcmsPlansTable.vehicleCategoryId),
      isNull(dcmsPlansTable.seatCategoryId),
    ));

  if (!legacy.length) {
    console.log("  ✓ No legacy unlinked plans to retire");
    return;
  }

  const { categories, tierSeatIds } = await loadMasters();
  let expanded = 0;

  for (const old of legacy) {
    const basePrice = parseFloat(old.price);
    const largePrice = (basePrice * 1.1875).toFixed(0); // 1600→1900 ratio from website

    for (const cat of categories) {
      for (const tier of TIER_ORDER) {
        const tierLabel = tier === "standard" ? "Up to 5 Seater" : "5+ Seater";
        await upsertLinkedPlan({
          name: `${old.name} (${cat.name} · ${tierLabel})`,
          vehicleCategoryId: cat.id,
          seatCategoryId: tierSeatIds[tier],
          price: tier === "standard" ? old.price : largePrice,
          includedCleanings: old.includedCleanings,
          includedWashes: old.includedWashes,
          weeklyOffs: old.weeklyOffs,
        });
        expanded++;
      }
    }

    await db.update(dcmsPlansTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(dcmsPlansTable.id, old.id));
  }

  console.log(`  ✓ Legacy plans: ${legacy.length} retired, ${expanded} tier variants ensured`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Add it to .env");
  }

  console.log("DCMS plan migration — car type + seater tier linking\n");

  await applySchemaMigration();
  await seedLinkedPlans();
  await migrateLegacyPlans();

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      linked: sql<number>`count(*) filter (where vehicle_category_id is not null)::int`,
      active: sql<number>`count(*) filter (where is_active)::int`,
    })
    .from(dcmsPlansTable);

  console.log(`\nDone. Plans: ${stats?.linked}/${stats?.total} linked, ${stats?.active} active.`);

  const { pool } = await import("@workspace/db");
  await pool.end();
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
