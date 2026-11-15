import "./load-env.js";
import { db, catalogPackagesTable, catalogPackageEntitlementsTable, servicesTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";

async function main() {
  console.log("Checking and backfilling catalog_package_entitlements...");

  // 1. Find services
  const allServices = await db.select().from(servicesTable);
  const washSvc = allServices.find(s => s.slug === "doorstep-car-wash" || s.category === "car_wash") ?? allServices[0];
  const dcmsSvc = allServices.find(s => s.slug === "daily-car-cleaning" || s.category === "subscription");
  const solarSvc = allServices.find(s => s.slug === "solar-cleaning" || s.category === "solar_cleaning");

  console.log("Services mapped:", {
    wash: washSvc?.id,
    dcms: dcmsSvc?.id,
    solar: solarSvc?.id,
  });

  const packages = await db.select().from(catalogPackagesTable);

  for (const pkg of packages) {
    console.log(`Processing package: [${pkg.id}] ${pkg.name} (${pkg.slug})`);

    const existingEnts = await db.select().from(catalogPackageEntitlementsTable)
      .where(eq(catalogPackageEntitlementsTable.packageId, pkg.id));

    if (existingEnts.length > 0) {
      console.log(`  Package already has ${existingEnts.length} entitlements:`, existingEnts);
      continue;
    }

    if (pkg.slug === "4-wash-package" || pkg.name.toLowerCase().includes("4 wash") || pkg.name.toLowerCase().includes("wash package")) {
      if (washSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: pkg.id,
          serviceId: washSvc.id,
          entitlementType: "wash_credit",
          creditCount: 4,
          sortOrder: 1,
        });
        console.log(`  Inserted wash_credit (4) for ${pkg.name}`);
      }
    } else if (pkg.slug === "daily-cleaning-2-washes") {
      if (washSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: pkg.id,
          serviceId: washSvc.id,
          entitlementType: "wash_credit",
          creditCount: 2,
          sortOrder: 1,
        });
        console.log(`  Inserted wash_credit (2) for ${pkg.name}`);
      }
      if (dcmsSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: pkg.id,
          serviceId: dcmsSvc.id,
          entitlementType: "cleaning_credit",
          creditCount: 30,
          sortOrder: 2,
        });
        console.log(`  Inserted cleaning_credit (30) for ${pkg.name}`);
      }
    } else if (pkg.slug === "12-month-solar-amc-package" || pkg.solarTerm === "amc_12") {
      if (solarSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: pkg.id,
          serviceId: solarSvc.id,
          entitlementType: "solar_visit",
          creditCount: 12,
          sortOrder: 1,
        });
        console.log(`  Inserted solar_visit (12) for ${pkg.name}`);
      }
    } else if (pkg.slug === "6-month-solar-amc-package" || pkg.solarTerm === "amc_6") {
      if (solarSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: pkg.id,
          serviceId: solarSvc.id,
          entitlementType: "solar_visit",
          creditCount: 6,
          sortOrder: 1,
        });
        console.log(`  Inserted solar_visit (6) for ${pkg.name}`);
      }
    }
  }

  const finalEnts = await db.select().from(catalogPackageEntitlementsTable);
  console.log(`Backfill complete. Total entitlements in DB now: ${finalEnts.length}`);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
