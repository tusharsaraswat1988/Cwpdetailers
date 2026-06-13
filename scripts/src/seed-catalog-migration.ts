/**
 * Migrates existing Varanasi services into the Service Catalog Engine.
 * Run after migration 008: pnpm --filter @workspace/scripts run seed:catalog
 */
import "./load-env.js";
import { db } from "@workspace/db";
import {
  servicesTable, serviceCategoriesTable, servicePricingTable,
  citiesTable, serviceCityAvailabilityTable, solarPricingSlabsTable,
  serviceAddonsTable, serviceAddonLinksTable,
  catalogPackagesTable, catalogPackageEntitlementsTable,
  homepageSectionsTable, servicePlansTable,
} from "@workspace/db";
import { eq, sql, isNull } from "drizzle-orm";

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function getVaranasiCityId() {
  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.slug, "varanasi")).limit(1);
  if (!city) throw new Error("Varanasi city not found — run seed-master-data first");
  return city.id;
}

async function upsertCategory(def: { name: string; slug: string; legacyCategory: string; sortOrder: number }) {
  const existing = await db.select().from(serviceCategoriesTable).where(eq(serviceCategoriesTable.slug, def.slug)).limit(1);
  if (existing[0]) {
    await db.update(serviceCategoriesTable).set({
      name: def.name,
      legacyCategory: def.legacyCategory,
      sortOrder: def.sortOrder,
      showOnWebsite: true,
      showInBooking: true,
      showInSeo: true,
      updatedAt: new Date(),
    }).where(eq(serviceCategoriesTable.id, existing[0].id));
    return existing[0].id;
  }
  const [row] = await db.insert(serviceCategoriesTable).values({
    ...def,
    showOnWebsite: true,
    showInBooking: true,
    showInSeo: true,
  }).returning();
  return row.id;
}

export async function seedCatalogMigration() {
  console.log("Migrating Varanasi service catalog...");
  const varanasiId = await getVaranasiCityId();

  const catIds = {
    carWash: await upsertCategory({ name: "Doorstep Car Wash", slug: "doorstep-car-wash", legacyCategory: "car_wash", sortOrder: 1 }),
    dailyCleaning: await upsertCategory({ name: "Daily Car Cleaning", slug: "daily-car-cleaning", legacyCategory: "subscription", sortOrder: 2 }),
    solar: await upsertCategory({ name: "Solar Cleaning", slug: "solar-cleaning", legacyCategory: "solar_cleaning", sortOrder: 3 }),
    amc: await upsertCategory({ name: "Solar AMC", slug: "solar-amc", legacyCategory: "amc", sortOrder: 4 }),
    detailing: await upsertCategory({ name: "Detailing", slug: "detailing", legacyCategory: "detailing", sortOrder: 5 }),
  };

  const allServices = await db.select().from(servicesTable);

  const serviceDefs: Array<{
    match: (s: typeof allServices[0]) => boolean;
    updates: Record<string, unknown>;
  }> = [
    {
      match: s => s.name.toLowerCase().includes("basic") && s.category === "car_wash",
      updates: { slug: "single-wash", name: "Single Wash", serviceCategoryId: catIds.carWash, pricingModel: "vehicle_matrix" },
    },
    {
      match: s => s.name.toLowerCase().includes("premium") && s.category === "car_wash",
      updates: { slug: "premium-wash", name: "Premium Wash", serviceCategoryId: catIds.carWash, pricingModel: "vehicle_matrix" },
    },
    {
      match: s => s.category === "solar_cleaning",
      updates: { slug: "one-time-solar-cleaning", name: "One Time Cleaning", serviceCategoryId: catIds.solar, pricingModel: "solar_slab" },
    },
    {
      match: s => s.category === "amc",
      updates: { slug: "12-month-solar-amc", name: "12 Month Solar AMC", serviceCategoryId: catIds.amc, pricingModel: "fixed", basePrice: "9999" },
    },
    {
      match: s => s.category === "detailing",
      updates: { slug: "interior-detailing", serviceCategoryId: catIds.detailing, pricingModel: "vehicle_matrix" },
    },
  ];

  for (const svc of allServices) {
    const def = serviceDefs.find(d => d.match(svc));
    const updates: Record<string, unknown> = {
      slug: def?.updates.slug ?? slug(svc.name),
      gstRate: "18",
      pricingType: "inclusive",
      status: "active",
      updatedAt: new Date(),
      ...def?.updates,
    };
    await db.update(servicesTable).set(updates).where(eq(servicesTable.id, svc.id));

    await db.insert(serviceCityAvailabilityTable).values({
      serviceId: svc.id,
      cityId: varanasiId,
      isActive: true,
    }).onConflictDoNothing();
  }

  // Tag existing pricing rows with Varanasi city
  await db.update(servicePricingTable)
    .set({ cityId: varanasiId, updatedAt: new Date() })
    .where(isNull(servicePricingTable.cityId));

  // Solar slab — ₹60/panel, min ₹800
  const solarSvc = allServices.find(s => s.category === "solar_cleaning");
  if (solarSvc) {
    const existing = await db.select().from(solarPricingSlabsTable)
      .where(eq(solarPricingSlabsTable.serviceId, solarSvc.id)).limit(1);
    if (!existing[0]) {
      await db.insert(solarPricingSlabsTable).values({
        serviceId: solarSvc.id,
        cityId: varanasiId,
        minPanels: 1,
        maxPanels: null,
        pricePerPanel: "60",
        minimumBilling: "800",
        sortOrder: 1,
      });
    }
  }

  // Addons
  const addonDefs = [
    { name: "Car Waxing", slug: "car-waxing", basePrice: "500" },
    { name: "Windshield Hard Water Treatment", slug: "windshield-hard-water", basePrice: "1200" },
    { name: "Tyre Dressing", slug: "tyre-dressing", basePrice: "250" },
    { name: "Interior Vacuum", slug: "interior-vacuum", basePrice: "300" },
  ];
  for (let i = 0; i < addonDefs.length; i++) {
    const a = addonDefs[i];
    let addonId: number;
    const existing = await db.select().from(serviceAddonsTable).where(eq(serviceAddonsTable.slug, a.slug)).limit(1);
    if (existing[0]) addonId = existing[0].id;
    else {
      const [row] = await db.insert(serviceAddonsTable).values({ ...a, sortOrder: i + 1 }).returning();
      addonId = row.id;
    }
    const carWashServices = allServices.filter(s => s.category === "car_wash" || s.category === "subscription");
    for (const svc of carWashServices) {
      const linkExists = await db.select().from(serviceAddonLinksTable)
        .where(sql`${serviceAddonLinksTable.addonId} = ${addonId} AND ${serviceAddonLinksTable.serviceId} = ${svc.id}`)
        .limit(1);
      if (!linkExists[0]) {
        await db.insert(serviceAddonLinksTable).values({ addonId, serviceId: svc.id });
      }
    }
    if (solarSvc) {
      const linkExists = await db.select().from(serviceAddonLinksTable)
        .where(sql`${serviceAddonLinksTable.addonId} = ${addonId} AND ${serviceAddonLinksTable.serviceId} = ${solarSvc.id}`)
        .limit(1);
      if (!linkExists[0]) {
        await db.insert(serviceAddonLinksTable).values({ addonId, serviceId: solarSvc.id });
      }
    }
  }

  // Packages from service_plans + new catalog packages
  const carWash = allServices.find(s => s.category === "car_wash");
  const planRows = carWash
    ? await db.select().from(servicePlansTable).where(eq(servicePlansTable.serviceId, carWash.id))
    : [];

  const packageDefs = [
    {
      name: "Daily Cleaning + 2 Washes",
      slug: "daily-cleaning-2-washes",
      price: "1600",
      validityDays: 30,
      offDays: [3],
      tag: "BEST VALUE",
      isHighlighted: true,
      features: ["30 Daily Cleanings", "2 Full Washes", "Wednesday Weekly Off"],
      entitlements: [
        { serviceSlug: "single-wash", type: "wash_credit" as const, credits: 2 },
        { serviceSlug: "premium-wash", type: "cleaning_credit" as const, credits: 30 },
      ],
    },
    {
      name: "4 Wash Package",
      slug: "4-wash-package",
      price: "1600",
      validityDays: 180,
      tag: "FLEXIBLE",
      features: ["4 Full Washes", "180 Days Validity"],
      entitlements: [{ serviceSlug: "premium-wash", type: "wash_credit" as const, credits: 4 }],
    },
    {
      name: "12 Month Solar AMC",
      slug: "12-month-solar-amc-package",
      price: "9999",
      validityDays: 365,
      features: ["12 Cleaning Visits", "365 Days Validity"],
      entitlements: [{ serviceSlug: "one-time-solar-cleaning", type: "solar_visit" as const, credits: 12 }],
    },
    {
      name: "6 Month Solar AMC",
      slug: "6-month-solar-amc-package",
      price: "5499",
      validityDays: 180,
      features: ["6 Cleaning Visits", "180 Days Validity"],
      entitlements: [{ serviceSlug: "one-time-solar-cleaning", type: "solar_visit" as const, credits: 6 }],
    },
  ];

  const updatedServices = await db.select().from(servicesTable);
  const svcBySlug = Object.fromEntries(updatedServices.filter(s => s.slug).map(s => [s.slug!, s]));

  for (let i = 0; i < packageDefs.length; i++) {
    const p = packageDefs[i];
    const existing = await db.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.slug, p.slug)).limit(1);
    let packageId: number;
    if (existing[0]) packageId = existing[0].id;
    else {
      const [row] = await db.insert(catalogPackagesTable).values({
        name: p.name,
        slug: p.slug,
        price: p.price,
        validityDays: p.validityDays,
        offDays: p.offDays ?? [],
        tag: p.tag,
        isHighlighted: p.isHighlighted ?? false,
        features: p.features,
        cityId: varanasiId,
        serviceCategoryId: p.slug.includes("solar") ? catIds.amc : catIds.dailyCleaning,
        sortOrder: i + 1,
      }).returning();
      packageId = row.id;
    }

    for (const ent of p.entitlements) {
      const targetSvc = svcBySlug[ent.serviceSlug];
      if (!targetSvc) continue;
      const exists = await db.select().from(catalogPackageEntitlementsTable)
        .where(sql`${catalogPackageEntitlementsTable.packageId} = ${packageId} AND ${catalogPackageEntitlementsTable.serviceId} = ${targetSvc.id}`)
        .limit(1);
      if (!exists[0]) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId,
          serviceId: targetSvc.id,
          entitlementType: ent.type,
          creditCount: ent.credits,
        });
      }
    }
  }

  // Migrate service_plans prices to catalog packages if not already
  for (const plan of planRows) {
    const pkgSlug = slug(plan.name);
    const exists = await db.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.slug, pkgSlug)).limit(1);
    if (!exists[0] && carWash) {
      await db.insert(catalogPackagesTable).values({
        name: plan.name,
        slug: pkgSlug,
        price: plan.price,
        validityDays: (plan.durationMonths ?? 1) * 30,
        features: plan.features ?? [],
        tag: plan.tag,
        isHighlighted: plan.isHighlighted,
        cityId: varanasiId,
        serviceCategoryId: catIds.dailyCleaning,
        sortOrder: plan.sortOrder,
      });
    }
  }

  // Homepage CMS sections
  const sections = [
    {
      sectionKey: "hero",
      title: "Premium Car Care at Your Doorstep",
      subtitle: "Varanasi's trusted car wash, daily cleaning & solar panel care",
      content: { ctaPrimary: "Book Now", ctaSecondary: "View Plans" },
    },
    {
      sectionKey: "cities",
      title: "Cities We Serve",
      content: { cities: [{ name: "Varanasi", slug: "varanasi", active: true }, { name: "Patna", slug: "patna", active: false }, { name: "Lucknow", slug: "lucknow", active: false }] },
    },
    {
      sectionKey: "testimonials",
      title: "What Our Customers Say",
      content: {
        items: [
          { name: "Rahul S.", text: "Daily cleaning service is a game changer. My car always looks fresh!", rating: 5 },
          { name: "Priya M.", text: "Professional solar panel cleaning. Noticed improved efficiency.", rating: 5 },
        ],
      },
    },
    {
      sectionKey: "stats",
      title: "CWP by the Numbers",
      content: { stats: [{ label: "Happy Customers", value: "500+" }, { label: "Services Completed", value: "10,000+" }, { label: "Cities", value: "1" }] },
    },
    {
      sectionKey: "faqs",
      title: "Frequently Asked Questions",
      content: {
        items: [
          { q: "What areas do you serve?", a: "We currently serve Varanasi with expansion to Patna and Lucknow coming soon." },
          { q: "Are prices inclusive of GST?", a: "Yes, all displayed prices are GST inclusive unless stated otherwise." },
        ],
      },
    },
    {
      sectionKey: "contact",
      title: "Get in Touch",
      content: { phone: "0542-2500001", email: "hello@cwpdetailers.com", address: "Lanka, Varanasi" },
    },
  ];

  for (const sec of sections) {
    await db.insert(homepageSectionsTable).values(sec)
      .onConflictDoUpdate({
        target: homepageSectionsTable.sectionKey,
        set: { title: sec.title, subtitle: sec.subtitle, content: sec.content, updatedAt: new Date() },
      });
  }

  // Patna + Lucknow placeholder city pricing (Daily Cleaning ₹1100 example)
  for (const citySlug of ["patna", "lucknow"]) {
    const [city] = await db.select().from(citiesTable).where(eq(citiesTable.slug, citySlug)).limit(1);
    if (!city) {
      const [up] = await db.select().from(citiesTable).where(eq(citiesTable.slug, "uttar-pradesh")).limit(1);
      // create city if missing
      const stateId = up?.stateId ?? (await db.select().from(citiesTable).where(eq(citiesTable.slug, "varanasi")).limit(1))[0]?.stateId;
      if (stateId) {
        const name = citySlug === "patna" ? "Patna" : "Lucknow";
        const [newCity] = await db.insert(citiesTable).values({ stateId, name, slug: citySlug }).returning();
        for (const svc of updatedServices.filter(s => s.category === "subscription" || s.slug === "premium-wash")) {
          await db.insert(serviceCityAvailabilityTable).values({
            serviceId: svc.id,
            cityId: newCity.id,
            basePriceOverride: citySlug === "patna" ? "1100" : "1050",
            isActive: false,
          }).onConflictDoNothing();
        }
      }
    }
  }

  console.log("Service catalog migration complete.");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.includes("seed-catalog-migration")) {
  seedCatalogMigration()
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
}
