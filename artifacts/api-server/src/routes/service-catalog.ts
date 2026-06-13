import { Router } from "express";
import { db } from "@workspace/db";
import {
  catalogSettingsTable,
  serviceCityAvailabilityTable,
  solarPricingSlabsTable,
  serviceAddonsTable,
  serviceAddonLinksTable,
  catalogPackagesTable,
  catalogPackageEntitlementsTable,
  customerEntitlementsTable,
  serviceCityContentTable,
  homepageSectionsTable,
  catalogReminderHooksTable,
  servicesTable,
  serviceCategoriesTable,
  citiesTable,
} from "@workspace/db";
import { eq, and, asc, desc } from "drizzle-orm";
import { resolveCatalogPricing, resolveCityId } from "../lib/catalog/pricingEngine";
import {
  grantPackageEntitlements,
  checkSelfBookingEligibility,
  getReminderHookCandidates,
  refreshEntitlementStatuses,
} from "../lib/catalog/entitlementEngine";

const router = Router();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function genericUpdate(table: any, req: any, res: any) {
  try {
    const id = parseInt(req.params.id);
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;
    const [row] = await db.update(table).set(updateData).where(eq(table.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Catalog Settings ────────────────────────────────────────────────────────

router.get("/catalog/settings", async (_req, res) => {
  const rows = await db.select().from(catalogSettingsTable);
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  return res.json(settings);
});

router.put("/catalog/settings", async (req, res) => {
  const entries = Object.entries(req.body as Record<string, unknown>);
  for (const [key, value] of entries) {
    await db.insert(catalogSettingsTable).values({ key, value })
      .onConflictDoUpdate({ target: catalogSettingsTable.key, set: { value, updatedAt: new Date() } });
  }
  return res.json({ ok: true });
});

// ─── City Availability ───────────────────────────────────────────────────────

router.get("/catalog/city-availability", async (req, res) => {
  const { serviceId, cityId } = req.query as Record<string, string>;
  const conditions = [];
  if (serviceId) conditions.push(eq(serviceCityAvailabilityTable.serviceId, parseInt(serviceId)));
  if (cityId) conditions.push(eq(serviceCityAvailabilityTable.cityId, parseInt(cityId)));
  const data = await db.select().from(serviceCityAvailabilityTable)
    .where(conditions.length ? and(...conditions) : undefined);
  return res.json(data);
});

router.post("/catalog/city-availability", async (req, res) => {
  const { serviceId, cityId, basePriceOverride, isActive } = req.body;
  if (!serviceId || !cityId) return res.status(400).json({ error: "serviceId and cityId required" });
  const [row] = await db.insert(serviceCityAvailabilityTable).values({
    serviceId, cityId, basePriceOverride, isActive: isActive ?? true,
  }).onConflictDoUpdate({
    target: [serviceCityAvailabilityTable.serviceId, serviceCityAvailabilityTable.cityId],
    set: { basePriceOverride, isActive: isActive ?? true, updatedAt: new Date() },
  }).returning();
  return res.status(201).json(row);
});

router.patch("/catalog/city-availability/:id", (req, res) => genericUpdate(serviceCityAvailabilityTable, req, res));

// ─── Solar Slabs ─────────────────────────────────────────────────────────────

router.get("/catalog/solar-slabs", async (req, res) => {
  const { serviceId, cityId } = req.query as Record<string, string>;
  const conditions = [eq(solarPricingSlabsTable.isActive, true)];
  if (serviceId) conditions.push(eq(solarPricingSlabsTable.serviceId, parseInt(serviceId)));
  if (cityId) conditions.push(eq(solarPricingSlabsTable.cityId, parseInt(cityId)));
  const data = await db.select().from(solarPricingSlabsTable)
    .where(and(...conditions))
    .orderBy(asc(solarPricingSlabsTable.sortOrder));
  return res.json(data);
});

router.post("/catalog/solar-slabs", async (req, res) => {
  const [row] = await db.insert(solarPricingSlabsTable).values(req.body).returning();
  return res.status(201).json(row);
});

router.patch("/catalog/solar-slabs/:id", (req, res) => genericUpdate(solarPricingSlabsTable, req, res));

router.delete("/catalog/solar-slabs/:id", async (req, res) => {
  await db.update(solarPricingSlabsTable)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(solarPricingSlabsTable.id, parseInt(req.params.id)));
  return res.status(204).send();
});

// ─── Addons ──────────────────────────────────────────────────────────────────

router.get("/catalog/addons", async (req, res) => {
  const { serviceId, categoryId } = req.query as Record<string, string>;
  if (serviceId || categoryId) {
    const links = await db.select({
      addon: serviceAddonsTable,
      linkId: serviceAddonLinksTable.id,
    })
      .from(serviceAddonLinksTable)
      .innerJoin(serviceAddonsTable, eq(serviceAddonLinksTable.addonId, serviceAddonsTable.id))
      .where(and(
        eq(serviceAddonLinksTable.isActive, true),
        eq(serviceAddonsTable.isActive, true),
        serviceId ? eq(serviceAddonLinksTable.serviceId, parseInt(serviceId)) : undefined,
        categoryId ? eq(serviceAddonLinksTable.serviceCategoryId, parseInt(categoryId)) : undefined,
      ));
    return res.json(links.map(l => ({ ...l.addon, linkId: l.linkId })));
  }
  const data = await db.select().from(serviceAddonsTable)
    .where(eq(serviceAddonsTable.isActive, true))
    .orderBy(asc(serviceAddonsTable.sortOrder));
  return res.json(data);
});

router.post("/catalog/addons", async (req, res) => {
  try {
    const { serviceId, serviceCategoryId, ...addonData } = req.body;
    const body = { ...addonData, slug: addonData.slug ?? slugify(addonData.name) };
    const [row] = await db.insert(serviceAddonsTable).values(body).returning();
    if (serviceId || serviceCategoryId) {
      await db.insert(serviceAddonLinksTable).values({
        addonId: row.id,
        serviceId: serviceId ?? null,
        serviceCategoryId: serviceCategoryId ?? null,
        isActive: true,
      });
    }
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create addon error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/catalog/addons/:id", (req, res) => genericUpdate(serviceAddonsTable, req, res));

router.post("/catalog/addon-links", async (req, res) => {
  const [row] = await db.insert(serviceAddonLinksTable).values(req.body).returning();
  return res.status(201).json(row);
});

router.delete("/catalog/addon-links/:id", async (req, res) => {
  await db.update(serviceAddonLinksTable)
    .set({ isActive: false })
    .where(eq(serviceAddonLinksTable.id, parseInt(req.params.id)));
  return res.status(204).send();
});

// ─── Packages ────────────────────────────────────────────────────────────────

router.get("/catalog/packages", async (req, res) => {
  const { cityId, citySlug, status } = req.query as Record<string, string>;
  const conditions = [];
  if (status) conditions.push(eq(catalogPackagesTable.status, status as any));
  else conditions.push(eq(catalogPackagesTable.status, "active"));
  if (cityId) conditions.push(eq(catalogPackagesTable.cityId, parseInt(cityId)));
  if (citySlug) {
    const cid = await resolveCityId(citySlug);
    if (cid) conditions.push(eq(catalogPackagesTable.cityId, cid));
  }
  const packages = await db.select().from(catalogPackagesTable)
    .where(and(...conditions))
    .orderBy(asc(catalogPackagesTable.sortOrder));

  const withEntitlements = await Promise.all(packages.map(async (pkg) => {
    const items = await db.select().from(catalogPackageEntitlementsTable)
      .where(eq(catalogPackageEntitlementsTable.packageId, pkg.id))
      .orderBy(asc(catalogPackageEntitlementsTable.sortOrder));
    return { ...pkg, entitlements: items };
  }));
  return res.json(withEntitlements);
});

router.get("/catalog/packages/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pkg] = await db.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.id, id)).limit(1);
  if (!pkg) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, id));
  return res.json({ ...pkg, entitlements: items });
});

router.post("/catalog/packages", async (req, res) => {
  const body = { ...req.body, slug: req.body.slug ?? slugify(req.body.name) };
  const [row] = await db.insert(catalogPackagesTable).values(body).returning();
  return res.status(201).json(row);
});

router.patch("/catalog/packages/:id", (req, res) => genericUpdate(catalogPackagesTable, req, res));

router.post("/catalog/packages/:id/entitlements", async (req, res) => {
  const packageId = parseInt(req.params.id);
  const [row] = await db.insert(catalogPackageEntitlementsTable).values({ ...req.body, packageId }).returning();
  return res.status(201).json(row);
});

router.delete("/catalog/package-entitlements/:id", async (req, res) => {
  await db.delete(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.id, parseInt(req.params.id)));
  return res.status(204).send();
});

// ─── Customer Entitlements ───────────────────────────────────────────────────

router.get("/catalog/entitlements", async (req, res) => {
  const { customerId, serviceId, status } = req.query as Record<string, string>;
  const conditions = [];
  if (customerId) conditions.push(eq(customerEntitlementsTable.customerId, parseInt(customerId)));
  if (serviceId) conditions.push(eq(customerEntitlementsTable.serviceId, parseInt(serviceId)));
  if (status) conditions.push(eq(customerEntitlementsTable.status, status as any));
  const data = await db.select().from(customerEntitlementsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(customerEntitlementsTable.createdAt));
  return res.json(data);
});

router.post("/catalog/entitlements/grant-package", async (req, res) => {
  const { customerId, packageId, cityId, subscriptionId } = req.body;
  if (!customerId || !packageId) return res.status(400).json({ error: "customerId and packageId required" });
  const grants = await grantPackageEntitlements(customerId, packageId, { cityId, subscriptionId });
  return res.status(201).json(grants);
});

router.get("/catalog/self-booking/check", async (req, res) => {
  const { customerId, serviceId, cityId, citySlug } = req.query as Record<string, string>;
  if (!customerId || !serviceId) return res.status(400).json({ error: "customerId and serviceId required" });
  const cid = cityId ? parseInt(cityId) : (citySlug ? await resolveCityId(citySlug) : null);
  const result = await checkSelfBookingEligibility({
    customerId: parseInt(customerId),
    serviceId: parseInt(serviceId),
    cityId: cid,
  });
  return res.json(result);
});

// ─── City SEO Content ────────────────────────────────────────────────────────

router.get("/catalog/city-content", async (req, res) => {
  const { serviceId, cityId, citySlug, serviceSlug } = req.query as Record<string, string>;
  if (serviceSlug && citySlug) {
    const [svc] = await db.select().from(servicesTable).where(eq(servicesTable.slug, serviceSlug)).limit(1);
    const cid = await resolveCityId(citySlug);
    if (!svc || !cid) return res.status(404).json({ error: "Not found" });
    const [content] = await db.select().from(serviceCityContentTable)
      .where(and(eq(serviceCityContentTable.serviceId, svc.id), eq(serviceCityContentTable.cityId, cid)))
      .limit(1);
    const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cid)).limit(1);
    return res.json({ service: svc, city, content: content ?? null });
  }
  const conditions = [];
  if (serviceId) conditions.push(eq(serviceCityContentTable.serviceId, parseInt(serviceId)));
  if (cityId) conditions.push(eq(serviceCityContentTable.cityId, parseInt(cityId)));
  const data = await db.select().from(serviceCityContentTable)
    .where(conditions.length ? and(...conditions) : undefined);
  return res.json(data);
});

router.post("/catalog/city-content", async (req, res) => {
  const [row] = await db.insert(serviceCityContentTable).values(req.body)
    .onConflictDoUpdate({
      target: [serviceCityContentTable.serviceId, serviceCityContentTable.cityId],
      set: { ...req.body, updatedAt: new Date() },
    }).returning();
  return res.status(201).json(row);
});

router.patch("/catalog/city-content/:id", (req, res) => genericUpdate(serviceCityContentTable, req, res));

// ─── Homepage CMS ────────────────────────────────────────────────────────────

router.get("/catalog/homepage", async (_req, res) => {
  const sections = await db.select().from(homepageSectionsTable)
    .where(eq(homepageSectionsTable.isActive, true))
    .orderBy(asc(homepageSectionsTable.sortOrder));
  return res.json(sections);
});

router.put("/catalog/homepage/:sectionKey", async (req, res) => {
  const { sectionKey } = req.params;
  const [row] = await db.insert(homepageSectionsTable).values({
    sectionKey,
    ...req.body,
  }).onConflictDoUpdate({
    target: homepageSectionsTable.sectionKey,
    set: { ...req.body, updatedAt: new Date() },
  }).returning();
  return res.json(row);
});

// ─── Reminder Hooks ──────────────────────────────────────────────────────────

router.get("/catalog/reminder-hooks", async (_req, res) => {
  const hooks = await db.select().from(catalogReminderHooksTable).orderBy(asc(catalogReminderHooksTable.hookKey));
  return res.json(hooks);
});

router.get("/catalog/reminder-hooks/:hookKey/candidates", async (req, res) => {
  const candidates = await getReminderHookCandidates(req.params.hookKey);
  return res.json(candidates);
});

router.post("/catalog/reminder-hooks/refresh", async (_req, res) => {
  await refreshEntitlementStatuses();
  return res.json({ ok: true });
});

// ─── Pricing Quote (must be registered before /catalog/:citySlug/:serviceSlug) ─

router.get("/catalog/pricing/quote", async (req, res) => {
  const { serviceId, vehicleModelId, panelCount, cityId, citySlug } = req.query as Record<string, string>;
  if (!serviceId) return res.status(400).json({ error: "serviceId is required" });
  const pricing = await resolveCatalogPricing({
    serviceId: parseInt(serviceId),
    vehicleModelId: vehicleModelId ? parseInt(vehicleModelId) : undefined,
    panelCount: panelCount ? parseInt(panelCount) : undefined,
    cityId: cityId ? parseInt(cityId) : undefined,
    citySlug,
  });
  if (!pricing) return res.status(404).json({ error: "Pricing not found" });
  return res.json(pricing);
});

// ─── Enhanced Public Catalog ─────────────────────────────────────────────────

router.get("/catalog/services/:citySlug", async (req, res) => {
  const cityId = await resolveCityId(req.params.citySlug);
  if (!cityId) return res.status(404).json({ error: "City not found" });

  const data = await db
    .select({
      id: servicesTable.id,
      name: servicesTable.name,
      slug: servicesTable.slug,
      description: servicesTable.description,
      shortDescription: servicesTable.shortDescription,
      category: servicesTable.category,
      basePrice: servicesTable.basePrice,
      gstRate: servicesTable.gstRate,
      pricingType: servicesTable.pricingType,
      pricingModel: servicesTable.pricingModel,
      durationMinutes: servicesTable.durationMinutes,
      imageUrl: servicesTable.imageUrl,
      features: servicesTable.features,
      benefits: servicesTable.benefits,
      categoryName: serviceCategoriesTable.name,
      categorySlug: serviceCategoriesTable.slug,
      cityBaseOverride: serviceCityAvailabilityTable.basePriceOverride,
    })
    .from(servicesTable)
    .innerJoin(serviceCityAvailabilityTable, and(
      eq(serviceCityAvailabilityTable.serviceId, servicesTable.id),
      eq(serviceCityAvailabilityTable.cityId, cityId),
      eq(serviceCityAvailabilityTable.isActive, true),
    ))
    .leftJoin(serviceCategoriesTable, eq(servicesTable.serviceCategoryId, serviceCategoriesTable.id))
    .where(and(eq(servicesTable.isActive, true), eq(servicesTable.status, "active")))
    .orderBy(asc(serviceCategoriesTable.sortOrder), asc(servicesTable.name));
  return res.json(data);
});

router.get("/catalog/:citySlug/:serviceSlug", async (req, res) => {
  const cityId = await resolveCityId(req.params.citySlug);
  if (!cityId) return res.status(404).json({ error: "City not found" });

  const [svc] = await db.select().from(servicesTable)
    .where(and(eq(servicesTable.slug, req.params.serviceSlug), eq(servicesTable.isActive, true)))
    .limit(1);
  if (!svc) return res.status(404).json({ error: "Service not found" });

  const [cityContent] = await db.select().from(serviceCityContentTable)
    .where(and(eq(serviceCityContentTable.serviceId, svc.id), eq(serviceCityContentTable.cityId, cityId)))
    .limit(1);

  const [city] = await db.select().from(citiesTable).where(eq(citiesTable.id, cityId)).limit(1);
  const addons = await db.select({ addon: serviceAddonsTable })
    .from(serviceAddonLinksTable)
    .innerJoin(serviceAddonsTable, eq(serviceAddonLinksTable.addonId, serviceAddonsTable.id))
    .where(and(eq(serviceAddonLinksTable.serviceId, svc.id), eq(serviceAddonLinksTable.isActive, true)));

  return res.json({
    service: svc,
    city,
    cityContent: cityContent ?? null,
    addons: addons.map(a => a.addon),
  });
});

export default router;
