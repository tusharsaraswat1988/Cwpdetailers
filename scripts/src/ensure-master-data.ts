/** Seed vehicle/city master data when tables exist but brands are empty. */
import "./load-env.js";
import { db, pool, vehicleBrandsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { seedMasterData } from "./seed-master-data.js";

export async function ensureMasterDataSeeded(): Promise<{ seeded: boolean; brandCount: number }> {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(vehicleBrandsTable);
  const brandCount = Number(row?.count ?? 0);
  if (brandCount > 0) {
    return { seeded: false, brandCount };
  }

  console.log("Vehicle master data is empty — seeding brands, models, cities…");
  await seedMasterData();

  const [after] = await db.select({ count: sql<number>`count(*)::int` }).from(vehicleBrandsTable);
  return { seeded: true, brandCount: Number(after?.count ?? 0) };
}

const isMain =
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` ||
  process.argv[1]?.includes("ensure-master-data");

if (isMain) {
  ensureMasterDataSeeded()
    .then(result => {
      if (result.seeded) {
        console.log(`✅ Seeded ${result.brandCount} vehicle brands (and related master data).`);
      } else {
        console.log(`Master data already present (${result.brandCount} brands).`);
      }
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      pool.end().finally(() => process.exit(1));
    });
}
