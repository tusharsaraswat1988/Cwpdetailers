/**
 * Clean solar catalog for rate-card model:
 * - Keep one active one-time solar_slab service
 * - Archive duplicate/legacy list-price solar services
 * - Ensure 6 / 12 month AMC packages exist with solar_visit entitlements
 */
import "./load-env.js";
import {
  db,
  servicesTable,
  catalogPackagesTable,
  catalogPackageEntitlementsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

async function main() {
  const services = await db.select().from(servicesTable);
  const solarServices = services.filter(s =>
    s.category === "solar_cleaning"
    || s.pricingModel === "solar_slab"
    || (s.name || "").toLowerCase().includes("solar panel cleaning"),
  );

  // Prefer existing solar_slab active service
  let keeper = solarServices.find(s => s.pricingModel === "solar_slab" && s.isActive && s.status !== "archived")
    ?? solarServices.find(s => s.category === "solar_cleaning" && s.isActive)
    ?? solarServices[0];

  if (!keeper) throw new Error("No solar service found to keep");

  await db.update(servicesTable).set({
    name: "One Time Cleaning",
    slug: "one-time-solar-cleaning",
    pricingModel: "solar_slab",
    pricingType: "exclusive",
    gstRate: "18",
    // Display fallback only — live quote uses rate card
    basePrice: "0",
    isActive: true,
    status: "active",
    shortDescription: "Quoted from panel count on the solar rate card (GST extra).",
    updatedAt: new Date(),
  }).where(eq(servicesTable.id, keeper.id));

  for (const s of solarServices) {
    if (s.id === keeper.id) continue;
    await db.update(servicesTable).set({
      isActive: false,
      status: "archived",
      updatedAt: new Date(),
    }).where(eq(servicesTable.id, s.id));
    console.log(`Archived duplicate service #${s.id} ${s.name}`);
  }
  console.log(`Keeper one-time service #${keeper.id}`);

  const packageDefs = [
    {
      name: "6 Month Solar AMC",
      slug: "6-month-solar-amc-package",
      solarTerm: "amc_6" as const,
      validityDays: 180,
      credits: 6,
      features: ["6 Cleaning Visits", "180 Days Validity", "Quoted from panel count"],
    },
    {
      name: "12 Month Solar AMC",
      slug: "12-month-solar-amc-package",
      solarTerm: "amc_12" as const,
      validityDays: 365,
      credits: 12,
      features: ["12 Cleaning Visits", "365 Days Validity", "Quoted from panel count"],
    },
  ];

  for (const def of packageDefs) {
    const [existing] = await db.select().from(catalogPackagesTable)
      .where(eq(catalogPackagesTable.slug, def.slug)).limit(1);
    let packageId: number;
    if (existing) {
      packageId = existing.id;
      await db.update(catalogPackagesTable).set({
        name: def.name,
        solarTerm: def.solarTerm,
        pricingType: "exclusive",
        price: "0",
        validityDays: def.validityDays,
        features: def.features,
        status: "active",
        updatedAt: new Date(),
      }).where(eq(catalogPackagesTable.id, packageId));
      console.log(`Updated package #${packageId} ${def.slug}`);
    } else {
      const [row] = await db.insert(catalogPackagesTable).values({
        name: def.name,
        slug: def.slug,
        price: "0",
        pricingType: "exclusive",
        solarTerm: def.solarTerm,
        validityDays: def.validityDays,
        features: def.features,
        status: "active",
        sortOrder: def.solarTerm === "amc_6" ? 10 : 20,
      }).returning();
      packageId = row.id;
      console.log(`Created package #${packageId} ${def.slug}`);
    }

    const ents = await db.select().from(catalogPackageEntitlementsTable)
      .where(and(
        eq(catalogPackageEntitlementsTable.packageId, packageId),
        eq(catalogPackageEntitlementsTable.entitlementType, "solar_visit"),
      ));
    if (!ents[0]) {
      await db.insert(catalogPackageEntitlementsTable).values({
        packageId,
        serviceId: keeper.id,
        entitlementType: "solar_visit",
        creditCount: def.credits,
      });
      console.log(`  + solar_visit × ${def.credits}`);
    } else if (ents[0].creditCount !== def.credits || ents[0].serviceId !== keeper.id) {
      await db.update(catalogPackageEntitlementsTable).set({
        serviceId: keeper.id,
        creditCount: def.credits,
      }).where(eq(catalogPackageEntitlementsTable.id, ents[0].id));
      console.log(`  ~ solar_visit updated to × ${def.credits}`);
    }
  }

  console.log("Solar catalog cleanup done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
