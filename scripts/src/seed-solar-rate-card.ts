/**
 * Upsert KLEAN SOLAR flyer defaults into solar_pricing_slabs.
 * Safe to re-run — never overwrites admin-edited rates for existing band rows.
 */
import "./load-env.js";
import { db } from "@workspace/db";
import {
  servicesTable,
  citiesTable,
  solarPricingSlabsTable,
  catalogPackagesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";

async function main() {
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.slug, "varanasi")).limit(1);
  if (!city) throw new Error("Varanasi city not found");

  const allServices = await db.select().from(servicesTable);
  let solarSvc = allServices.find(s => s.pricingModel === "solar_slab")
    ?? allServices.find(s => s.category === "solar_cleaning")
    ?? allServices.find(s => (s.slug ?? "").includes("solar") && !(s.slug ?? "").includes("amc"))
    ?? allServices.find(s => (s.name ?? "").toLowerCase().includes("solar") && !(s.name ?? "").toLowerCase().includes("amc"));

  if (!solarSvc) {
    console.error("Available services:", allServices.map(s => ({ id: s.id, name: s.name, category: s.category, pricingModel: s.pricingModel, slug: s.slug })));
    throw new Error("No solar cleaning service found");
  }

  await db.update(servicesTable)
    .set({
      pricingModel: "solar_slab",
      pricingType: "exclusive",
      gstRate: "18",
      updatedAt: new Date(),
    })
    .where(eq(servicesTable.id, solarSvc.id));

  // Deactivate legacy single open-ended one_time slabs (1–∞)
  const existing = await db.select().from(solarPricingSlabsTable)
    .where(eq(solarPricingSlabsTable.serviceId, solarSvc.id));
  for (const s of existing) {
    if (
      s.term === "one_time"
      && s.minPanels === 1
      && s.maxPanels == null
      && !s.requiresSiteVisit
      && existing.filter(x => x.term === "one_time").length <= 2
    ) {
      // only deactivate if it looks like the old single-row seed
      const matrixExists = existing.some(x => x.term === "one_time" && x.maxPanels != null);
      if (!matrixExists) {
        await db.update(solarPricingSlabsTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(solarPricingSlabsTable.id, s.id));
      }
    }
  }

  const rateCardDefaults = [
    { term: "one_time" as const, minPanels: 1, maxPanels: 30, pricePerPanel: "60", minimumBilling: "800", requiresSiteVisit: false, sortOrder: 10 },
    { term: "one_time" as const, minPanels: 31, maxPanels: 100, pricePerPanel: "50", minimumBilling: "800", requiresSiteVisit: false, sortOrder: 20 },
    { term: "one_time" as const, minPanels: 101, maxPanels: null, pricePerPanel: null, minimumBilling: "800", requiresSiteVisit: true, sortOrder: 30 },
    { term: "amc_6" as const, minPanels: 1, maxPanels: 30, pricePerPanel: "50", minimumBilling: "700", requiresSiteVisit: false, sortOrder: 40 },
    { term: "amc_6" as const, minPanels: 31, maxPanels: 100, pricePerPanel: "45", minimumBilling: "700", requiresSiteVisit: false, sortOrder: 50 },
    { term: "amc_6" as const, minPanels: 101, maxPanels: null, pricePerPanel: null, minimumBilling: "700", requiresSiteVisit: true, sortOrder: 60 },
    { term: "amc_12" as const, minPanels: 1, maxPanels: 30, pricePerPanel: "45", minimumBilling: "700", requiresSiteVisit: false, sortOrder: 70 },
    { term: "amc_12" as const, minPanels: 31, maxPanels: 100, pricePerPanel: "40", minimumBilling: "700", requiresSiteVisit: false, sortOrder: 80 },
    { term: "amc_12" as const, minPanels: 101, maxPanels: null, pricePerPanel: null, minimumBilling: "700", requiresSiteVisit: true, sortOrder: 90 },
  ];

  const fresh = await db.select().from(solarPricingSlabsTable)
    .where(eq(solarPricingSlabsTable.serviceId, solarSvc.id));

  let inserted = 0;
  for (const row of rateCardDefaults) {
    const match = fresh.find(s =>
      s.term === row.term
      && s.minPanels === row.minPanels
      && (s.maxPanels ?? null) === (row.maxPanels ?? null),
    );
    if (!match) {
      await db.insert(solarPricingSlabsTable).values({
        serviceId: solarSvc.id,
        cityId: city.id,
        term: row.term,
        minPanels: row.minPanels,
        maxPanels: row.maxPanels,
        pricePerPanel: row.pricePerPanel,
        minimumBilling: row.minimumBilling,
        requiresSiteVisit: row.requiresSiteVisit,
        sortOrder: row.sortOrder,
        isActive: true,
      });
      inserted++;
    }
  }

  // Tag AMC packages
  for (const [slug, term] of [
    ["6-month-solar-amc-package", "amc_6"],
    ["12-month-solar-amc-package", "amc_12"],
  ] as const) {
    await db.update(catalogPackagesTable)
      .set({
        solarTerm: term,
        pricingType: "exclusive",
        updatedAt: new Date(),
      })
      .where(eq(catalogPackagesTable.slug, slug));
  }

  console.log(`Solar rate card ready for service #${solarSvc.id} (inserted ${inserted} new rows)`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
