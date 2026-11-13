import { Router } from "express";
import { db } from "@workspace/db";
import {
  catalogSettingsTable,
  serviceCityAvailabilityTable,
  serviceAvailabilityMatrixTable,
  servicePricingTable,
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
  branchesTable,
} from "@workspace/db";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import { listHomepagePlans } from "../lib/catalog/homepagePlans";
import { getSolarRateCard, resolveCatalogPricing, resolveCityId } from "../lib/catalog/pricingEngine";
import {
  getCityBranchServiceMatrix,
  setServiceAvailability,
  isServiceBookableInScope,
  getEffectiveServicesForScope,
} from "../lib/catalog/serviceAvailabilityService";
import type { SolarPricingTerm } from "@workspace/db";
import { tenantStamp } from "../middlewares/tenantScope";
import { createInvoiceForPackagePurchase } from "../lib/billing/invoiceService";
import {
  grantPackageEntitlements,
  checkSelfBookingEligibility,
  getReminderHookCandidates,
  refreshEntitlementStatuses,
} from "../lib/catalog/entitlementEngine";
import {
  getPackageAddons,
  getPackageAddonsForPackages,
  replacePackageAddons,
  resolvePackageAddonPrice,
  type PackageAddonInput,
} from "../lib/catalog/packageAddonService";
import { invalidateCoverageCacheForMasterUpdate } from "../lib/coverage";

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

router.get("/catalog/settings", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
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
  invalidateCoverageCacheForMasterUpdate("service_availability", { cityId: Number(cityId) });
  return res.status(201).json(row);
});

router.patch("/catalog/city-availability/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(serviceCityAvailabilityTable)
      .where(eq(serviceCityAvailabilityTable.id, id)).limit(1);
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;
    const [row] = await db.update(serviceCityAvailabilityTable).set(updateData)
      .where(eq(serviceCityAvailabilityTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const cityId = row.cityId ?? existing?.cityId;
    if (cityId) invalidateCoverageCacheForMasterUpdate("service_availability", { cityId });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Service Availability Matrix (PRD Phase 19, SVC-012) ───────────────────

router.get("/catalog/matrix", async (req, res) => {
  try {
    const { cityId, branchId, serviceId, includeInactive } = req.query as Record<string, string>;
    const parsedBranchId = branchId !== undefined
      ? (branchId === "null" || branchId === "" ? null : parseInt(branchId, 10))
      : undefined;

    const data = await getCityBranchServiceMatrix({
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      branchId: parsedBranchId,
      serviceId: serviceId ? parseInt(serviceId, 10) : undefined,
      includeInactive: includeInactive === "true",
    });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Get service availability matrix error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog/matrix", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const {
      serviceId, cityId, branchId, isActive, bookingModes,
      effectiveFrom, effectiveUntil, basePriceOverride,
      packageConfigId, operationalConstraints, adminNotes,
    } = req.body;

    if (!serviceId || !cityId) {
      return res.status(400).json({ error: "serviceId and cityId are required" });
    }

    // Branch scoping authorization
    if (!req.scope?.isSuperAdmin && req.scope?.branchIds !== null && branchId != null) {
      if (!req.scope.branchIds.includes(Number(branchId))) {
        return res.status(403).json({ error: "Unauthorized branch scope" });
      }
    }

    const row = await setServiceAvailability({
      serviceId: Number(serviceId),
      cityId: Number(cityId),
      branchId: branchId != null && branchId !== "" ? Number(branchId) : null,
      isActive: isActive !== false,
      bookingModes: Array.isArray(bookingModes) ? bookingModes : ["one_time"],
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
      basePriceOverride: basePriceOverride != null && basePriceOverride !== "" ? Number(basePriceOverride) : null,
      packageConfigId: packageConfigId ? Number(packageConfigId) : null,
      operationalConstraints: operationalConstraints ?? {},
      adminNotes: adminNotes ?? null,
      performedBy: req.user.id,
    });

    return res.status(201).json(row);
  } catch (err: any) {
    req.log.error({ err }, "Set service availability error");
    return res.status(400).json({ error: err.message || "Failed to set availability" });
  }
});

router.get("/catalog/preview", async (req, res) => {
  try {
    const { cityId, branchId, date } = req.query as Record<string, string>;
    if (!cityId) return res.status(400).json({ error: "cityId is required" });

    const services = await getEffectiveServicesForScope({
      cityId: parseInt(cityId, 10),
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      targetDate: date ? new Date(date) : undefined,
    });
    return res.json(services);
  } catch (err) {
    req.log.error({ err }, "Catalog preview error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Centralized Pricing Rules Management (PRD Phase 19, SVC-013) ───────────

router.get("/catalog/pricing-rules", async (req, res) => {
  try {
    const { serviceId, cityId, branchId, vehicleCategoryId, seatCategoryId, includeInactive } = req.query as Record<string, string>;
    const conditions = [];
    if (includeInactive !== "true") conditions.push(eq(servicePricingTable.isActive, true));
    if (serviceId) conditions.push(eq(servicePricingTable.serviceId, parseInt(serviceId, 10)));
    if (cityId) conditions.push(eq(servicePricingTable.cityId, parseInt(cityId, 10)));
    if (branchId) conditions.push(eq(servicePricingTable.branchId, parseInt(branchId, 10)));
    if (vehicleCategoryId) conditions.push(eq(servicePricingTable.vehicleCategoryId, parseInt(vehicleCategoryId, 10)));
    if (seatCategoryId) conditions.push(eq(servicePricingTable.seatCategoryId, parseInt(seatCategoryId, 10)));

    const rows = await db
      .select({
        id: servicePricingTable.id,
        serviceId: servicePricingTable.serviceId,
        cityId: servicePricingTable.cityId,
        branchId: servicePricingTable.branchId,
        vehicleCategoryId: servicePricingTable.vehicleCategoryId,
        seatCategoryId: servicePricingTable.seatCategoryId,
        price: servicePricingTable.price,
        gstRate: servicePricingTable.gstRate,
        pricingType: servicePricingTable.pricingType,
        durationMinutes: servicePricingTable.durationMinutes,
        isActive: servicePricingTable.isActive,
        effectiveFrom: servicePricingTable.effectiveFrom,
        effectiveUntil: servicePricingTable.effectiveUntil,
        createdAt: servicePricingTable.createdAt,
        updatedAt: servicePricingTable.updatedAt,
        serviceName: servicesTable.name,
        cityName: citiesTable.name,
        branchName: branchesTable.name,
      })
      .from(servicePricingTable)
      .leftJoin(servicesTable, eq(servicePricingTable.serviceId, servicesTable.id))
      .leftJoin(citiesTable, eq(servicePricingTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(servicePricingTable.branchId, branchesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(servicePricingTable.updatedAt));

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "List pricing rules error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/catalog/pricing-rules", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const {
      serviceId, cityId, branchId, vehicleCategoryId, seatCategoryId,
      price, gstRate, pricingType, durationMinutes, isActive,
      effectiveFrom, effectiveUntil,
    } = req.body;

    if (!serviceId) return res.status(400).json({ error: "serviceId is required" });
    if (price == null || Number(price) <= 0) {
      return res.status(400).json({ error: "price must be a positive number greater than 0" });
    }

    const [row] = await db.insert(servicePricingTable).values({
      serviceId: Number(serviceId),
      cityId: cityId ? Number(cityId) : null,
      branchId: branchId ? Number(branchId) : null,
      vehicleCategoryId: vehicleCategoryId ? Number(vehicleCategoryId) : null,
      seatCategoryId: seatCategoryId ? Number(seatCategoryId) : null,
      price: String(price),
      gstRate: gstRate ? String(gstRate) : null,
      pricingType: pricingType ?? "inclusive",
      durationMinutes: durationMinutes ? Number(durationMinutes) : null,
      isActive: isActive !== false,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
    }).returning();

    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create pricing rule error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/catalog/pricing-rules/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    const body = { ...req.body, updatedAt: new Date() };
    delete body.id;
    delete body.createdAt;
    if (body.price != null && Number(body.price) <= 0) {
      return res.status(400).json({ error: "price must be a positive number greater than 0" });
    }
    const [row] = await db.update(servicePricingTable).set(body).where(eq(servicePricingTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Pricing rule not found" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update pricing rule error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/catalog/pricing-rules/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    const id = parseInt(req.params.id, 10);
    await db.update(servicePricingTable).set({ isActive: false, updatedAt: new Date() }).where(eq(servicePricingTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete pricing rule error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Solar Slabs ─────────────────────────────────────────────────────────────

router.get("/catalog/solar-slabs", async (req, res) => {
  const { serviceId, cityId, packageId, term, includeInactive } = req.query as Record<string, string>;
  const conditions = includeInactive === "true" ? [] : [eq(solarPricingSlabsTable.isActive, true)];
  if (serviceId) conditions.push(eq(solarPricingSlabsTable.serviceId, parseInt(serviceId)));
  if (cityId) conditions.push(eq(solarPricingSlabsTable.cityId, parseInt(cityId)));
  if (packageId) conditions.push(eq(solarPricingSlabsTable.packageId, parseInt(packageId)));
  if (term) conditions.push(eq(solarPricingSlabsTable.term, term as SolarPricingTerm));
  const data = await db.select().from(solarPricingSlabsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(solarPricingSlabsTable.term), asc(solarPricingSlabsTable.minPanels), asc(solarPricingSlabsTable.sortOrder));
  return res.json(data);
});

/** Public rate card for landing / marketing — all bands & rates from DB. */
router.get("/catalog/solar-rate-card", async (req, res) => {
  const { serviceId, cityId, citySlug } = req.query as Record<string, string>;
  const card = await getSolarRateCard({
    serviceId: serviceId ? parseInt(serviceId) : undefined,
    cityId: cityId ? parseInt(cityId) : undefined,
    citySlug,
  });
  return res.json(card);
});

router.post("/catalog/solar-slabs", async (req, res) => {
  const body = req.body ?? {};
  if (body.serviceId == null) return res.status(400).json({ error: "serviceId is required" });
  if (body.term == null) body.term = "one_time";
  if (body.requiresSiteVisit && (body.pricePerPanel === "" || body.pricePerPanel == null)) {
    body.pricePerPanel = null;
  }
  const [row] = await db.insert(solarPricingSlabsTable).values(body).returning();
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
  const { serviceId, categoryId, includeInactive, withLinks } = req.query as Record<string, string>;
  if (serviceId || categoryId) {
    const links = await db.select({
      addon: serviceAddonsTable,
      linkId: serviceAddonLinksTable.id,
    })
      .from(serviceAddonLinksTable)
      .innerJoin(serviceAddonsTable, eq(serviceAddonLinksTable.addonId, serviceAddonsTable.id))
      .where(and(
        eq(serviceAddonLinksTable.isActive, true),
        includeInactive === "true" ? undefined : eq(serviceAddonsTable.isActive, true),
        serviceId ? eq(serviceAddonLinksTable.serviceId, parseInt(serviceId)) : undefined,
        categoryId ? eq(serviceAddonLinksTable.serviceCategoryId, parseInt(categoryId)) : undefined,
      ));
    return res.json(links.map(l => ({ ...l.addon, linkId: l.linkId })));
  }

  const data = await db.select().from(serviceAddonsTable)
    .where(includeInactive === "true" ? undefined : eq(serviceAddonsTable.isActive, true))
    .orderBy(asc(serviceAddonsTable.sortOrder), asc(serviceAddonsTable.id));

  if (withLinks !== "true") return res.json(data);

  const addonIds = data.map(a => a.id);
  if (!addonIds.length) return res.json(data.map(a => ({ ...a, links: [], linkCount: 0 })));

  const linkRows = await db
    .select({
      linkId: serviceAddonLinksTable.id,
      addonId: serviceAddonLinksTable.addonId,
      serviceId: serviceAddonLinksTable.serviceId,
      serviceName: servicesTable.name,
    })
    .from(serviceAddonLinksTable)
    .leftJoin(servicesTable, eq(serviceAddonLinksTable.serviceId, servicesTable.id))
    .where(and(
      eq(serviceAddonLinksTable.isActive, true),
      inArray(serviceAddonLinksTable.addonId, addonIds),
    ));

  const linksByAddon = new Map<number, Array<{ linkId: number; serviceId: number | null; serviceName: string | null }>>();
  for (const row of linkRows) {
    const list = linksByAddon.get(row.addonId) ?? [];
    list.push({ linkId: row.linkId, serviceId: row.serviceId, serviceName: row.serviceName });
    linksByAddon.set(row.addonId, list);
  }

  return res.json(data.map(a => {
    const links = linksByAddon.get(a.id) ?? [];
    return { ...a, links, linkCount: links.length };
  }));
});

router.get("/catalog/addons/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [addon] = await db.select().from(serviceAddonsTable).where(eq(serviceAddonsTable.id, id)).limit(1);
  if (!addon) return res.status(404).json({ error: "Not found" });

  const linkRows = await db
    .select({
      linkId: serviceAddonLinksTable.id,
      serviceId: serviceAddonLinksTable.serviceId,
      serviceName: servicesTable.name,
      isActive: serviceAddonLinksTable.isActive,
    })
    .from(serviceAddonLinksTable)
    .leftJoin(servicesTable, eq(serviceAddonLinksTable.serviceId, servicesTable.id))
    .where(and(
      eq(serviceAddonLinksTable.addonId, id),
      eq(serviceAddonLinksTable.isActive, true),
    ));

  return res.json({
    ...addon,
    links: linkRows.map(l => ({
      linkId: l.linkId,
      serviceId: l.serviceId,
      serviceName: l.serviceName,
    })),
    linkCount: linkRows.length,
  });
});

router.post("/catalog/addons", async (req, res) => {
  try {
    const { serviceId, serviceCategoryId, serviceIds, ...addonData } = req.body;
    const body = { ...addonData, slug: addonData.slug ?? slugify(addonData.name) };
    const [row] = await db.insert(serviceAddonsTable).values(body).returning();

    const ids: number[] = Array.isArray(serviceIds)
      ? serviceIds.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
      : [];
    if (serviceId) ids.push(Number(serviceId));

    for (const sid of [...new Set(ids)]) {
      await db.insert(serviceAddonLinksTable).values({
        addonId: row.id,
        serviceId: sid,
        serviceCategoryId: null,
        isActive: true,
      });
    }
    if (serviceCategoryId && !ids.length) {
      await db.insert(serviceAddonLinksTable).values({
        addonId: row.id,
        serviceId: null,
        serviceCategoryId,
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
  try {
    const { addonId, serviceId, serviceCategoryId } = req.body as {
      addonId?: number;
      serviceId?: number | null;
      serviceCategoryId?: number | null;
    };
    if (!addonId || (!serviceId && !serviceCategoryId)) {
      return res.status(400).json({ error: "addonId and serviceId (or serviceCategoryId) required" });
    }

    const existing = await db.select().from(serviceAddonLinksTable)
      .where(and(
        eq(serviceAddonLinksTable.addonId, addonId),
        serviceId ? eq(serviceAddonLinksTable.serviceId, serviceId) : undefined,
        serviceCategoryId ? eq(serviceAddonLinksTable.serviceCategoryId, serviceCategoryId) : undefined,
      ))
      .limit(1);

    if (existing[0]) {
      const [row] = await db.update(serviceAddonLinksTable)
        .set({ isActive: true })
        .where(eq(serviceAddonLinksTable.id, existing[0].id))
        .returning();
      return res.json(row);
    }

    const [row] = await db.insert(serviceAddonLinksTable).values({
      addonId,
      serviceId: serviceId ?? null,
      serviceCategoryId: serviceCategoryId ?? null,
      isActive: true,
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create addon link error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/catalog/addon-links/:id", async (req, res) => {
  await db.update(serviceAddonLinksTable)
    .set({ isActive: false })
    .where(eq(serviceAddonLinksTable.id, parseInt(req.params.id)));
  return res.status(204).send();
});

// ─── Packages ────────────────────────────────────────────────────────────────

function normalizePackageAddons(raw: unknown): PackageAddonInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a: any, i: number) => ({
      addonId: Number(a.addonId),
      extraPrice: a.extraPrice != null && a.extraPrice !== "" ? String(a.extraPrice) : null,
      sortOrder: a.sortOrder ?? i,
    }))
    .filter(a => Number.isFinite(a.addonId));
}

router.get("/catalog/packages", async (req, res) => {
  const { cityId, citySlug, status, homepage } = req.query as Record<string, string>;
  const conditions = [];
  if (status) conditions.push(eq(catalogPackagesTable.status, status as any));
  else conditions.push(eq(catalogPackagesTable.status, "active"));
  if (homepage === "true") conditions.push(eq(catalogPackagesTable.showOnHomepage, true));
  if (cityId) conditions.push(eq(catalogPackagesTable.cityId, parseInt(cityId)));
  if (citySlug) {
    const cid = await resolveCityId(citySlug);
    if (cid) conditions.push(eq(catalogPackagesTable.cityId, cid));
  }
  const packages = await db.select().from(catalogPackagesTable)
    .where(and(...conditions))
    .orderBy(asc(catalogPackagesTable.sortOrder));

  const addonsByPkg = await getPackageAddonsForPackages(packages.map(p => p.id));

  const withExtras = await Promise.all(packages.map(async (pkg) => {
    const items = await db.select().from(catalogPackageEntitlementsTable)
      .where(eq(catalogPackageEntitlementsTable.packageId, pkg.id))
      .orderBy(asc(catalogPackageEntitlementsTable.sortOrder));
    return { ...pkg, entitlements: items, addons: addonsByPkg.get(pkg.id) ?? [] };
  }));
  return res.json(withExtras);
});

router.get("/catalog/packages/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [pkg] = await db.select().from(catalogPackagesTable).where(eq(catalogPackagesTable.id, id)).limit(1);
  if (!pkg) return res.status(404).json({ error: "Not found" });
  const items = await db.select().from(catalogPackageEntitlementsTable)
    .where(eq(catalogPackageEntitlementsTable.packageId, id));
  const addons = await getPackageAddons(id);
  return res.json({ ...pkg, entitlements: items, addons });
});

router.post("/catalog/packages", async (req, res) => {
  try {
    const { addons: rawAddons, solarVisitCredits, entitlements: rawEntitlements, ...rest } = req.body;
    if (!rest.name) return res.status(400).json({ error: "Package name is required" });
    if (rest.price != null && Number(rest.price) <= 0) {
      return res.status(400).json({ error: "Package price must be greater than 0" });
    }
    if (rest.includedVisits != null && Number(rest.includedVisits) <= 0) {
      return res.status(400).json({ error: "includedVisits must be positive" });
    }

    const addons = normalizePackageAddons(rawAddons);
    const addonPrice = await resolvePackageAddonPrice(addons);
    const basePrice = Number(rest.price ?? 0);
    const body = {
      ...rest,
      slug: rest.slug ?? slugify(rest.name),
      price: (basePrice + addonPrice).toFixed(2),
      version: rest.version ?? 1,
    };
    // Drop non-column fields
    delete (body as { solarVisitCredits?: unknown }).solarVisitCredits;
    delete (body as { entitlements?: unknown }).entitlements;
    const [row] = await db.insert(catalogPackagesTable).values(body).returning();
    if (addons.length) await replacePackageAddons(row.id, addons);

    // Auto-attach solar_visit entitlements when creating AMC packages
    const credits = solarVisitCredits != null ? parseInt(String(solarVisitCredits), 10) : NaN;
    if (row.solarTerm && Number.isFinite(credits) && credits > 0) {
      const [solarSvc] = await db.select({ id: servicesTable.id })
        .from(servicesTable)
        .where(eq(servicesTable.pricingModel, "solar_slab"))
        .limit(1);
      if (solarSvc) {
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: row.id,
          serviceId: solarSvc.id,
          entitlementType: "solar_visit",
          creditCount: credits,
        });
      }
    } else if (Array.isArray(rawEntitlements)) {
      for (const ent of rawEntitlements) {
        if (!ent?.serviceId || !ent?.entitlementType || !ent?.creditCount) continue;
        await db.insert(catalogPackageEntitlementsTable).values({
          packageId: row.id,
          serviceId: ent.serviceId,
          entitlementType: ent.entitlementType,
          creditCount: ent.creditCount,
        });
      }
    }

    const items = await db.select().from(catalogPackageEntitlementsTable)
      .where(eq(catalogPackageEntitlementsTable.packageId, row.id));
    const savedAddons = await getPackageAddons(row.id);
    return res.status(201).json({ ...row, entitlements: items, addons: savedAddons });
  } catch (err: any) {
    req.log.error({ err }, "Create package error");
    return res.status(400).json({ error: err.message || "Internal server error" });
  }
});

router.patch("/catalog/packages/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { addons: rawAddons, solarVisitCredits: _svc, entitlements: _ents, ...rest } = req.body;
    if (rest.price != null && Number(rest.price) <= 0) {
      return res.status(400).json({ error: "Package price must be greater than 0" });
    }
    if (rest.includedVisits != null && Number(rest.includedVisits) <= 0) {
      return res.status(400).json({ error: "includedVisits must be positive" });
    }

    const updateData: Record<string, unknown> = {
      ...rest,
      version: sql`${catalogPackagesTable.version} + 1`,
      updatedAt: new Date(),
    };
    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.solarVisitCredits;
    delete updateData.entitlements;

    if (rawAddons !== undefined) {
      const addons = normalizePackageAddons(rawAddons);
      const addonPrice = await resolvePackageAddonPrice(addons);
      const basePrice = Number(rest.price ?? 0);
      updateData.price = (basePrice + addonPrice).toFixed(2);
      await replacePackageAddons(id, addons);
    }

    const [row] = await db.update(catalogPackagesTable)
      .set(updateData)
      .where(eq(catalogPackagesTable.id, id))
      .returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    const addons = await getPackageAddons(id);
    return res.json({ ...row, addons });
  } catch (err: any) {
    req.log.error({ err }, "Update package error");
    return res.status(400).json({ error: err.message || "Internal server error" });
  }
});

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
  try {
    const { customerId, packageId, cityId, branchId, subscriptionId, vehicleId, solarSiteId } = req.body;
    if (!customerId || !packageId) return res.status(400).json({ error: "customerId and packageId required" });
    const stamped = tenantStamp(req, {});

    const result = await db.transaction(async (tx) => {
      const grants = await grantPackageEntitlements(customerId, packageId, {
        cityId, branchId, subscriptionId, vehicleId, solarSiteId,
      }, tx);
      const invoice = await createInvoiceForPackagePurchase(
        customerId,
        packageId,
        stamped,
        tx,
      );
      return { grants, invoice };
    });

    return res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }, "Grant package error");
    return res.status(400).json({ error: err.message || "Failed to purchase package" });
  }
});

router.get("/catalog/self-booking/check", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Authentication required" });
  const { customerId, serviceId, cityId, citySlug } = req.query as Record<string, string>;
  if (!customerId || !serviceId) return res.status(400).json({ error: "customerId and serviceId required" });
  const parsedCustomerId = parseInt(customerId, 10);
  if (req.user.role === "customer" && req.scope?.customerId !== parsedCustomerId) {
    return res.status(403).json({ error: "Permission denied — cannot probe other customer entitlements" });
  }
  const cid = cityId ? parseInt(cityId) : (citySlug ? await resolveCityId(citySlug) : null);
  const result = await checkSelfBookingEligibility({
    customerId: parsedCustomerId,
    serviceId: parseInt(serviceId, 10),
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

router.get("/catalog/homepage-plans", async (req, res) => {
  const { citySlug } = req.query as Record<string, string>;
  const plans = await listHomepagePlans(citySlug);
  return res.json(plans);
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
  const {
    serviceId, packageId, vehicleModelId, vehicleId, seatCategoryId,
    panelCount, cityId, citySlug, term, manualAmount,
  } = req.query as Record<string, string>;
  if (!serviceId && !packageId) {
    return res.status(400).json({ error: "serviceId or packageId is required" });
  }

  let resolvedModelId = vehicleModelId ? parseInt(vehicleModelId) : undefined;
  let resolvedSeatId = seatCategoryId ? parseInt(seatCategoryId) : undefined;

  // Prefer seating stored on the vehicle when quoting by vehicleId
  if (vehicleId) {
    const vid = parseInt(vehicleId);
    const { vehiclesTable } = await import("@workspace/db");
    const [vehicle] = await db.select({
      vehicleModelId: vehiclesTable.vehicleModelId,
      seatCategoryId: vehiclesTable.seatCategoryId,
    }).from(vehiclesTable).where(eq(vehiclesTable.id, vid)).limit(1);
    if (vehicle) {
      if (resolvedModelId == null && vehicle.vehicleModelId != null) {
        resolvedModelId = vehicle.vehicleModelId;
      }
      if (resolvedSeatId == null && vehicle.seatCategoryId != null) {
        resolvedSeatId = vehicle.seatCategoryId;
      }
    }
  }

  const pricing = await resolveCatalogPricing({
    serviceId: serviceId ? parseInt(serviceId) : undefined,
    packageId: packageId ? parseInt(packageId) : undefined,
    vehicleModelId: resolvedModelId,
    seatCategoryId: resolvedSeatId,
    panelCount: panelCount ? parseInt(panelCount) : undefined,
    term: term as SolarPricingTerm | undefined,
    cityId: cityId ? parseInt(cityId) : undefined,
    citySlug,
    manualAmount: manualAmount != null && manualAmount !== "" ? parseFloat(manualAmount) : undefined,
  });
  if (!pricing) return res.status(404).json({ error: "Pricing not found" });
  return res.json(pricing);
});

// ─── Enhanced Public Catalog ─────────────────────────────────────────────────

router.get("/catalog/services/:citySlug", async (req, res) => {
  const cityId = await resolveCityId(req.params.citySlug);
  if (!cityId) return res.status(404).json({ error: "City not found" });

  const branchId = req.query.branchId ? parseInt(req.query.branchId as string, 10) : undefined;
  const effectiveItems = await getEffectiveServicesForScope({
    cityId,
    branchId,
  });

  const availableOnly = effectiveItems
    .filter(item => item.isAvailable)
    .map(item => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      code: item.code,
      description: item.description,
      shortDescription: item.shortDescription,
      category: item.category,
      serviceType: item.serviceType,
      basePrice: String(item.effectivePrice),
      effectivePrice: item.effectivePrice,
      gstRate: String(item.gstRate),
      pricingType: item.pricingType,
      durationMinutes: item.durationMinutes,
      imageUrl: item.imageUrl,
      bookingModes: item.bookingModes,
      cityBaseOverride: item.cityPriceOverride != null ? String(item.cityPriceOverride) : null,
      branchBaseOverride: item.branchPriceOverride != null ? String(item.branchPriceOverride) : null,
    }));

  return res.json(availableOnly);
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
