import { Router } from "express";
import { db } from "@workspace/db";
import {
  vehicleCategoriesTable, seatCategoriesTable, fuelTypesTable,
  vehicleBrandsTable, vehicleModelsTable,
  statesTable, citiesTable, serviceAreasTable, pincodesTable,
  savedLocationsTable,
  serviceCategoriesTable, servicePlansTable, servicePricingTable,
  vehiclesTable, solarSitesTable, customersTable,
} from "@workspace/db";
import { eq, and, ilike, or, sql, asc } from "drizzle-orm";
import { rowInScope } from "../middlewares/tenantScope";
import { resolveVehiclePricing, getVehicleModelDetails } from "../lib/dynamicPricing";
import { invalidateCoverageCacheForMasterUpdate } from "../lib/coverage";

const router = Router();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function genericList<T extends { isActive?: boolean }>(
  table: any,
  req: any,
  res: any,
  opts?: { searchCol?: any; join?: () => Promise<any[]>; orderBy?: any },
) {
  try {
    const { q, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(table.isActive, isActive === "true"));
    if (q && opts?.searchCol) conditions.push(ilike(opts.searchCol, `%${q}%`));

    const data = await db.select().from(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(opts?.orderBy ?? asc(table.sortOrder ?? table.name));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function genericCreate(table: any, req: any, res: any, required: string[], onMutated?: () => void) {
  try {
    for (const f of required) {
      if (req.body[f] === undefined || req.body[f] === "") {
        return res.status(400).json({ error: `${f} is required` });
      }
    }
    const rows = await db.insert(table).values(req.body).returning();
    const row = Array.isArray(rows) ? rows[0] : rows;
    onMutated?.();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function genericUpdate(table: any, req: any, res: any, onMutated?: () => void) {
  try {
    const id = parseInt(req.params.id);
    const updateData = { ...req.body, updatedAt: new Date() };
    delete updateData.id;
    delete updateData.createdAt;
    const [row] = await db.update(table).set(updateData).where(eq(table.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    onMutated?.();
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Update error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function genericDelete(table: any, req: any, res: any, onMutated?: () => void) {
  try {
    const id = parseInt(req.params.id);
    await db.update(table).set({ isActive: false, updatedAt: new Date() }).where(eq(table.id, id));
    onMutated?.();
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete error");
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ─── Vehicle Masters ─────────────────────────────────────────────────────────

router.get("/masters/vehicle-categories", (req, res) =>
  genericList(vehicleCategoriesTable, req, res, { searchCol: vehicleCategoriesTable.name, orderBy: asc(vehicleCategoriesTable.sortOrder) }));
router.post("/masters/vehicle-categories", (req, res) =>
  genericCreate(vehicleCategoriesTable, req, res, ["name", "slug"]));
router.patch("/masters/vehicle-categories/:id", (req, res) => genericUpdate(vehicleCategoriesTable, req, res));
router.delete("/masters/vehicle-categories/:id", (req, res) => genericDelete(vehicleCategoriesTable, req, res));

router.get("/masters/seat-categories", (req, res) =>
  genericList(seatCategoriesTable, req, res, { searchCol: seatCategoriesTable.name, orderBy: asc(seatCategoriesTable.sortOrder) }));
router.post("/masters/seat-categories", (req, res) =>
  genericCreate(seatCategoriesTable, req, res, ["name", "slug", "seatCount"]));
router.patch("/masters/seat-categories/:id", (req, res) => genericUpdate(seatCategoriesTable, req, res));
router.delete("/masters/seat-categories/:id", (req, res) => genericDelete(seatCategoriesTable, req, res));

router.get("/masters/fuel-types", (req, res) =>
  genericList(fuelTypesTable, req, res, { searchCol: fuelTypesTable.name, orderBy: asc(fuelTypesTable.sortOrder) }));
router.post("/masters/fuel-types", (req, res) =>
  genericCreate(fuelTypesTable, req, res, ["name", "slug"]));
router.patch("/masters/fuel-types/:id", (req, res) => genericUpdate(fuelTypesTable, req, res));
router.delete("/masters/fuel-types/:id", (req, res) => genericDelete(fuelTypesTable, req, res));

router.get("/masters/vehicle-brands", async (req, res) => {
  try {
    const { q, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(vehicleBrandsTable.isActive, isActive === "true"));
    if (q) conditions.push(ilike(vehicleBrandsTable.name, `%${q}%`));
    const data = await db.select().from(vehicleBrandsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(vehicleBrandsTable.sortOrder), asc(vehicleBrandsTable.name))
      .limit(q ? 20 : 500);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List brands error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/vehicle-brands", (req, res) =>
  genericCreate(vehicleBrandsTable, req, res, ["name", "slug"]));
router.patch("/masters/vehicle-brands/:id", (req, res) => genericUpdate(vehicleBrandsTable, req, res));
router.delete("/masters/vehicle-brands/:id", (req, res) => genericDelete(vehicleBrandsTable, req, res));

router.get("/masters/vehicle-models", async (req, res) => {
  try {
    const { q, brandId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(vehicleModelsTable.isActive, isActive === "true"));
    if (brandId) conditions.push(eq(vehicleModelsTable.brandId, parseInt(brandId)));
    if (q) {
      conditions.push(or(
        ilike(vehicleModelsTable.name, `%${q}%`),
        ilike(vehicleBrandsTable.name, `%${q}%`),
      )!);
    }
    const data = await db
      .select({
        id: vehicleModelsTable.id,
        brandId: vehicleModelsTable.brandId,
        name: vehicleModelsTable.name,
        slug: vehicleModelsTable.slug,
        vehicleCategoryId: vehicleModelsTable.vehicleCategoryId,
        seatCategoryId: vehicleModelsTable.seatCategoryId,
        fuelTypeId: vehicleModelsTable.fuelTypeId,
        isActive: vehicleModelsTable.isActive,
        brandName: vehicleBrandsTable.name,
        categoryName: vehicleCategoriesTable.name,
        categorySlug: vehicleCategoriesTable.slug,
        seatName: seatCategoriesTable.name,
        seatCount: seatCategoriesTable.seatCount,
        fuelName: fuelTypesTable.name,
      })
      .from(vehicleModelsTable)
      .innerJoin(vehicleBrandsTable, eq(vehicleModelsTable.brandId, vehicleBrandsTable.id))
      .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
      .innerJoin(seatCategoriesTable, eq(vehicleModelsTable.seatCategoryId, seatCategoriesTable.id))
      .leftJoin(fuelTypesTable, eq(vehicleModelsTable.fuelTypeId, fuelTypesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(vehicleBrandsTable.name), asc(vehicleModelsTable.name))
      .limit(q ? 30 : 1000);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List models error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/vehicle-models", (req, res) =>
  genericCreate(vehicleModelsTable, req, res, ["brandId", "name", "slug", "vehicleCategoryId", "seatCategoryId"]));
router.patch("/masters/vehicle-models/:id", (req, res) => genericUpdate(vehicleModelsTable, req, res));
router.delete("/masters/vehicle-models/:id", (req, res) => genericDelete(vehicleModelsTable, req, res));

router.get("/masters/vehicle-models/:id/details", async (req, res) => {
  try {
    const details = await getVehicleModelDetails(parseInt(req.params.id));
    if (!details) return res.status(404).json({ error: "Model not found" });
    return res.json(details);
  } catch (err) {
    req.log.error({ err }, "Model details error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── City Masters ────────────────────────────────────────────────────────────

router.get("/masters/states", (req, res) =>
  genericList(statesTable, req, res, { searchCol: statesTable.name, orderBy: asc(statesTable.name) }));
router.post("/masters/states", (req, res) => genericCreate(statesTable, req, res, ["name", "code"]));
router.patch("/masters/states/:id", (req, res) => genericUpdate(statesTable, req, res));
router.delete("/masters/states/:id", (req, res) => genericDelete(statesTable, req, res));

router.get("/masters/cities", async (req, res) => {
  try {
    const { q, stateId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(citiesTable.isActive, isActive === "true"));
    if (stateId) conditions.push(eq(citiesTable.stateId, parseInt(stateId)));
    if (q) conditions.push(ilike(citiesTable.name, `%${q}%`));
    const data = await db
      .select({
        id: citiesTable.id,
        stateId: citiesTable.stateId,
        name: citiesTable.name,
        slug: citiesTable.slug,
        isActive: citiesTable.isActive,
        stateName: statesTable.name,
        stateCode: statesTable.code,
      })
      .from(citiesTable)
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(citiesTable.name))
      .limit(q ? 20 : 500);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List cities error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/cities", (req, res) =>
  genericCreate(citiesTable, req, res, ["stateId", "name", "slug"], () => invalidateCoverageCacheForMasterUpdate("cities")));
router.patch("/masters/cities/:id", (req, res) =>
  genericUpdate(citiesTable, req, res, () => invalidateCoverageCacheForMasterUpdate("cities")));
router.delete("/masters/cities/:id", (req, res) =>
  genericDelete(citiesTable, req, res, () => invalidateCoverageCacheForMasterUpdate("cities")));

router.get("/masters/service-areas", async (req, res) => {
  try {
    const { q, cityId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(serviceAreasTable.isActive, isActive === "true"));
    if (cityId) conditions.push(eq(serviceAreasTable.cityId, parseInt(cityId)));
    if (q) conditions.push(ilike(serviceAreasTable.name, `%${q}%`));
    const data = await db
      .select({
        id: serviceAreasTable.id,
        cityId: serviceAreasTable.cityId,
        name: serviceAreasTable.name,
        isActive: serviceAreasTable.isActive,
        cityName: citiesTable.name,
      })
      .from(serviceAreasTable)
      .innerJoin(citiesTable, eq(serviceAreasTable.cityId, citiesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(serviceAreasTable.name))
      .limit(q ? 20 : 500);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List service areas error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/service-areas", (req, res) =>
  genericCreate(serviceAreasTable, req, res, ["cityId", "name"], () => invalidateCoverageCacheForMasterUpdate("service_areas")));
router.patch("/masters/service-areas/:id", (req, res) =>
  genericUpdate(serviceAreasTable, req, res, () => invalidateCoverageCacheForMasterUpdate("service_areas")));
router.delete("/masters/service-areas/:id", (req, res) =>
  genericDelete(serviceAreasTable, req, res, () => invalidateCoverageCacheForMasterUpdate("service_areas")));

router.get("/masters/pincodes", async (req, res) => {
  try {
    const { q, serviceAreaId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(pincodesTable.isActive, isActive === "true"));
    if (serviceAreaId) conditions.push(eq(pincodesTable.serviceAreaId, parseInt(serviceAreaId)));
    if (q) conditions.push(ilike(pincodesTable.pincode, `${q}%`));
    const data = await db
      .select({
        id: pincodesTable.id,
        serviceAreaId: pincodesTable.serviceAreaId,
        pincode: pincodesTable.pincode,
        latitude: pincodesTable.latitude,
        longitude: pincodesTable.longitude,
        isActive: pincodesTable.isActive,
        areaName: serviceAreasTable.name,
        cityName: citiesTable.name,
      })
      .from(pincodesTable)
      .innerJoin(serviceAreasTable, eq(pincodesTable.serviceAreaId, serviceAreasTable.id))
      .innerJoin(citiesTable, eq(serviceAreasTable.cityId, citiesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(pincodesTable.pincode))
      .limit(q ? 20 : 500);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List pincodes error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/pincodes", (req, res) =>
  genericCreate(pincodesTable, req, res, ["serviceAreaId", "pincode"], () => {
    invalidateCoverageCacheForMasterUpdate("pincodes", { pincode: req.body?.pincode });
  }));
router.patch("/masters/pincodes/:id", (req, res) =>
  genericUpdate(pincodesTable, req, res, () => invalidateCoverageCacheForMasterUpdate("pincodes")));
router.delete("/masters/pincodes/:id", (req, res) =>
  genericDelete(pincodesTable, req, res, () => invalidateCoverageCacheForMasterUpdate("pincodes")));

router.get("/masters/pincodes/lookup/:pincode", async (req, res) => {
  try {
    const [row] = await db
      .select({
        pincode: pincodesTable.pincode,
        latitude: pincodesTable.latitude,
        longitude: pincodesTable.longitude,
        areaName: serviceAreasTable.name,
        cityName: citiesTable.name,
        stateName: statesTable.name,
        stateCode: statesTable.code,
      })
      .from(pincodesTable)
      .innerJoin(serviceAreasTable, eq(pincodesTable.serviceAreaId, serviceAreasTable.id))
      .innerJoin(citiesTable, eq(serviceAreasTable.cityId, citiesTable.id))
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(and(eq(pincodesTable.pincode, req.params.pincode), eq(pincodesTable.isActive, true)))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Pincode not in service area" });
    return res.json(row);
  } catch (err) {
    req.log.error({ err }, "Pincode lookup error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Service Categories & Plans ────────────────────────────────────────────────

router.get("/masters/service-categories", (req, res) =>
  genericList(serviceCategoriesTable, req, res, { searchCol: serviceCategoriesTable.name, orderBy: asc(serviceCategoriesTable.sortOrder) }));
router.post("/masters/service-categories", (req, res) =>
  genericCreate(serviceCategoriesTable, req, res, ["name", "slug"]));
router.patch("/masters/service-categories/:id", (req, res) => genericUpdate(serviceCategoriesTable, req, res));
router.delete("/masters/service-categories/:id", (req, res) => genericDelete(serviceCategoriesTable, req, res));

router.get("/masters/service-plans", async (req, res) => {
  try {
    const { serviceId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(servicePlansTable.isActive, isActive === "true"));
    if (serviceId) conditions.push(eq(servicePlansTable.serviceId, parseInt(serviceId)));
    const data = await db.select().from(servicePlansTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(servicePlansTable.sortOrder));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List plans error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/service-plans", (req, res) =>
  genericCreate(servicePlansTable, req, res, ["serviceId", "name", "price"]));
router.patch("/masters/service-plans/:id", (req, res) => genericUpdate(servicePlansTable, req, res));
router.delete("/masters/service-plans/:id", (req, res) => genericDelete(servicePlansTable, req, res));

router.get("/masters/service-pricing", async (req, res) => {
  try {
    const { serviceId, isActive } = req.query as Record<string, string>;
    const conditions = [];
    if (isActive !== undefined) conditions.push(eq(servicePricingTable.isActive, isActive === "true"));
    if (serviceId) conditions.push(eq(servicePricingTable.serviceId, parseInt(serviceId)));
    const data = await db
      .select({
        id: servicePricingTable.id,
        serviceId: servicePricingTable.serviceId,
        vehicleCategoryId: servicePricingTable.vehicleCategoryId,
        seatCategoryId: servicePricingTable.seatCategoryId,
        price: servicePricingTable.price,
        durationMinutes: servicePricingTable.durationMinutes,
        isActive: servicePricingTable.isActive,
        categoryName: vehicleCategoriesTable.name,
        seatName: seatCategoriesTable.name,
      })
      .from(servicePricingTable)
      .leftJoin(vehicleCategoriesTable, eq(servicePricingTable.vehicleCategoryId, vehicleCategoriesTable.id))
      .leftJoin(seatCategoriesTable, eq(servicePricingTable.seatCategoryId, seatCategoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List pricing error");
    return res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/masters/service-pricing", (req, res) =>
  genericCreate(servicePricingTable, req, res, ["serviceId", "price"]));
router.patch("/masters/service-pricing/:id", (req, res) => genericUpdate(servicePricingTable, req, res));
router.delete("/masters/service-pricing/:id", (req, res) => genericDelete(servicePricingTable, req, res));

router.get("/pricing/quote", async (req, res) => {
  try {
    const { serviceId, vehicleModelId, panelCount, cityId, citySlug } = req.query as Record<string, string>;
    if (!serviceId) {
      return res.status(400).json({ error: "serviceId is required" });
    }
    const { resolveCatalogPricing } = await import("../lib/catalog/pricingEngine");
    const pricing = await resolveCatalogPricing({
      serviceId: parseInt(serviceId),
      vehicleModelId: vehicleModelId ? parseInt(vehicleModelId) : undefined,
      panelCount: panelCount ? parseInt(panelCount) : undefined,
      cityId: cityId ? parseInt(cityId) : undefined,
      citySlug,
    });
    if (!pricing) return res.status(404).json({ error: "Pricing not found" });
    return res.json(pricing);
  } catch (err) {
    req.log.error({ err }, "Pricing quote error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Saved Locations ─────────────────────────────────────────────────────────

router.get("/saved-locations", async (req, res) => {
  try {
    const { customerId } = req.query as Record<string, string>;
    if (!customerId) return res.status(400).json({ error: "customerId is required" });
    const cid = parseInt(customerId);
    if (req.user?.role === "customer" && req.scope?.customerId && req.scope.customerId !== cid) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const data = await db.select().from(savedLocationsTable)
      .where(eq(savedLocationsTable.customerId, cid))
      .orderBy(sql`${savedLocationsTable.isDefault} DESC`, asc(savedLocationsTable.label));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List saved locations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/saved-locations", async (req, res) => {
  try {
    const { customerId, label, address, latitude, longitude, placeId, isDefault } = req.body;
    if (!customerId || !label || !address || latitude == null || longitude == null) {
      return res.status(400).json({ error: "customerId, label, address, latitude, longitude are required" });
    }
    if (req.user?.role === "customer" && req.scope?.customerId && req.scope.customerId !== customerId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (isDefault) {
      await db.update(savedLocationsTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(savedLocationsTable.customerId, customerId));
    }
    const [loc] = await db.insert(savedLocationsTable).values({
      customerId, label, address, latitude, longitude, placeId, isDefault: isDefault ?? false,
    }).returning();
    return res.status(201).json(loc);
  } catch (err) {
    req.log.error({ err }, "Create saved location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/saved-locations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(savedLocationsTable).where(eq(savedLocationsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user?.role === "customer" && req.scope?.customerId && req.scope.customerId !== existing.customerId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { label, address, latitude, longitude, placeId, isDefault } = req.body;
    if (isDefault) {
      await db.update(savedLocationsTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(savedLocationsTable.customerId, existing.customerId));
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (label !== undefined) updateData.label = label;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (placeId !== undefined) updateData.placeId = placeId;
    if (isDefault !== undefined) updateData.isDefault = isDefault;
    const [loc] = await db.update(savedLocationsTable).set(updateData).where(eq(savedLocationsTable.id, id)).returning();
    return res.json(loc);
  } catch (err) {
    req.log.error({ err }, "Update saved location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/saved-locations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(savedLocationsTable).where(eq(savedLocationsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (req.user?.role === "customer" && req.scope?.customerId && req.scope.customerId !== existing.customerId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(savedLocationsTable).where(eq(savedLocationsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete saved location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Catalog (public-facing) ─────────────────────────────────────────────────

router.get("/catalog/services", async (req, res) => {
  try {
    const { servicesTable: svc } = await import("@workspace/db");
    const data = await db
      .select({
        id: svc.id,
        name: svc.name,
        description: svc.description,
        category: svc.category,
        serviceCategoryId: svc.serviceCategoryId,
        basePrice: svc.basePrice,
        durationMinutes: svc.durationMinutes,
        imageUrl: svc.imageUrl,
        features: svc.features,
        categoryName: serviceCategoriesTable.name,
        categorySlug: serviceCategoriesTable.slug,
        categoryIcon: serviceCategoriesTable.iconUrl,
      })
      .from(svc)
      .leftJoin(serviceCategoriesTable, eq(svc.serviceCategoryId, serviceCategoriesTable.id))
      .where(eq(svc.isActive, true))
      .orderBy(asc(serviceCategoriesTable.sortOrder), asc(svc.name));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Catalog services error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/catalog/plans", async (req, res) => {
  try {
    const { serviceId } = req.query as Record<string, string>;
    const conditions = [eq(servicePlansTable.isActive, true)];
    if (serviceId) conditions.push(eq(servicePlansTable.serviceId, parseInt(serviceId)));
    const data = await db
      .select()
      .from(servicePlansTable)
      .where(and(...conditions))
      .orderBy(asc(servicePlansTable.sortOrder));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Catalog plans error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { slugify };
export default router;
