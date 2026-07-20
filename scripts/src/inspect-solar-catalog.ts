import "./load-env.js";
import { db, servicesTable, catalogPackagesTable, catalogPackageEntitlementsTable, solarPricingSlabsTable } from "@workspace/db";

async function main() {
  const svcs = await db.select().from(servicesTable);
  console.log("SERVICES (solar-ish):");
  for (const s of svcs.filter(s =>
    (s.category || "").includes("solar")
    || (s.name || "").toLowerCase().includes("solar")
    || s.pricingModel === "solar_slab"
  )) {
    console.log({
      id: s.id, name: s.name, slug: s.slug, category: s.category,
      pricingModel: s.pricingModel, basePrice: s.basePrice, isActive: s.isActive, status: s.status,
    });
  }

  const pkgs = await db.select().from(catalogPackagesTable);
  console.log("\nPACKAGES:");
  for (const p of pkgs) {
    const ents = await db.select().from(catalogPackageEntitlementsTable)
      .where((await import("drizzle-orm")).eq(catalogPackageEntitlementsTable.packageId, p.id));
    console.log({
      id: p.id, name: p.name, slug: p.slug, solarTerm: p.solarTerm, price: p.price, status: p.status,
      entitlements: ents.map(e => ({ type: e.entitlementType, credits: e.creditCount, serviceId: e.serviceId })),
    });
  }

  const slabs = await db.select().from(solarPricingSlabsTable);
  console.log("\nSLABS active:", slabs.filter(s => s.isActive).length, "total", slabs.length);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
