import { Router } from "express";
import { db } from "@workspace/db";
import { servicesTable, serviceCategoriesTable, serviceAddonLinksTable } from "@workspace/db";
import { eq, and, asc, sql } from "drizzle-orm";

const router = Router();

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function resolveCategoryFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...body };
  if (body.serviceCategoryId != null) {
    const catId = Number(body.serviceCategoryId);
    const [cat] = await db.select().from(serviceCategoriesTable)
      .where(eq(serviceCategoriesTable.id, catId)).limit(1);
    if (cat) {
      out.serviceCategoryId = catId;
      if (cat.legacyCategory) out.category = cat.legacyCategory;
    }
  }
  if (body.name && !body.slug) out.slug = slugify(String(body.name));
  if (body.basePrice != null) out.basePrice = String(body.basePrice);
  if (body.gstRate != null) out.gstRate = String(body.gstRate);
  return out;
}

const SERVICE_FIELDS = [
  "name", "slug", "description", "shortDescription", "longDescription",
  "serviceCategoryId", "category", "basePrice", "gstRate", "pricingType", "pricingModel",
  "durationMinutes", "isActive", "status", "imageUrl", "features", "benefits", "process",
  "seoTitle", "seoDescription", "assignmentStrategy",
] as const;

function pickServiceFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const key of SERVICE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

router.get("/services", async (req, res) => {
  try {
    const { category, isActive, includeInactive } = req.query as Record<string, string>;
    const conditions = [];
    if (category) conditions.push(eq(servicesTable.category, category as (typeof servicesTable.category)["_"]["data"]));
    if (isActive !== undefined) conditions.push(eq(servicesTable.isActive, isActive === "true"));
    else if (includeInactive !== "true") conditions.push(eq(servicesTable.isActive, true));

    const data = await db
      .select({
        id: servicesTable.id,
        name: servicesTable.name,
        slug: servicesTable.slug,
        description: servicesTable.description,
        shortDescription: servicesTable.shortDescription,
        longDescription: servicesTable.longDescription,
        serviceCategoryId: servicesTable.serviceCategoryId,
        category: servicesTable.category,
        basePrice: servicesTable.basePrice,
        gstRate: servicesTable.gstRate,
        pricingType: servicesTable.pricingType,
        pricingModel: servicesTable.pricingModel,
        durationMinutes: servicesTable.durationMinutes,
        isActive: servicesTable.isActive,
        status: servicesTable.status,
        imageUrl: servicesTable.imageUrl,
        features: servicesTable.features,
        benefits: servicesTable.benefits,
        process: servicesTable.process,
        assignmentStrategy: servicesTable.assignmentStrategy,
        seoTitle: servicesTable.seoTitle,
        seoDescription: servicesTable.seoDescription,
        createdAt: servicesTable.createdAt,
        updatedAt: servicesTable.updatedAt,
        categoryName: serviceCategoriesTable.name,
        categorySlug: serviceCategoriesTable.slug,
      })
      .from(servicesTable)
      .leftJoin(serviceCategoriesTable, eq(servicesTable.serviceCategoryId, serviceCategoriesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(serviceCategoriesTable.sortOrder), asc(servicesTable.name));

    const linkCounts = await db
      .select({
        serviceId: serviceAddonLinksTable.serviceId,
        count: sql<number>`count(*)::int`,
      })
      .from(serviceAddonLinksTable)
      .where(eq(serviceAddonLinksTable.isActive, true))
      .groupBy(serviceAddonLinksTable.serviceId);
    const countMap = Object.fromEntries(
      linkCounts.filter(r => r.serviceId != null).map(r => [r.serviceId!, r.count]),
    );

    return res.json(data.map(s => ({ ...s, addonCount: countMap[s.id] ?? 0 })));
  } catch (err) {
    req.log.error({ err }, "List services error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [service] = await db
      .select({
        id: servicesTable.id,
        name: servicesTable.name,
        slug: servicesTable.slug,
        description: servicesTable.description,
        shortDescription: servicesTable.shortDescription,
        longDescription: servicesTable.longDescription,
        serviceCategoryId: servicesTable.serviceCategoryId,
        category: servicesTable.category,
        basePrice: servicesTable.basePrice,
        gstRate: servicesTable.gstRate,
        pricingType: servicesTable.pricingType,
        pricingModel: servicesTable.pricingModel,
        durationMinutes: servicesTable.durationMinutes,
        isActive: servicesTable.isActive,
        status: servicesTable.status,
        imageUrl: servicesTable.imageUrl,
        features: servicesTable.features,
        benefits: servicesTable.benefits,
        process: servicesTable.process,
        assignmentStrategy: servicesTable.assignmentStrategy,
        seoTitle: servicesTable.seoTitle,
        seoDescription: servicesTable.seoDescription,
        createdAt: servicesTable.createdAt,
        updatedAt: servicesTable.updatedAt,
        categoryName: serviceCategoriesTable.name,
        categorySlug: serviceCategoriesTable.slug,
      })
      .from(servicesTable)
      .leftJoin(serviceCategoriesTable, eq(servicesTable.serviceCategoryId, serviceCategoriesTable.id))
      .where(eq(servicesTable.id, id))
      .limit(1);
    if (!service) return res.status(404).json({ error: "Service not found" });
    return res.json(service);
  } catch (err) {
    req.log.error({ err }, "Get service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  try {
    const resolved = await resolveCategoryFields(req.body);
    const { name, category, basePrice } = resolved;
    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({ error: "name, category (or serviceCategoryId), and basePrice are required" });
    }
    const values = pickServiceFields(resolved);
    values.isActive = values.isActive !== false;
    values.features = values.features ?? [];
    const [service] = await db.insert(servicesTable).values(values as any).returning();
    return res.status(201).json(service);
  } catch (err) {
    req.log.error({ err }, "Create service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const resolved = await resolveCategoryFields(req.body);
    const updateData = { ...pickServiceFields(resolved), updatedAt: new Date() };
    const [service] = await db.update(servicesTable).set(updateData as any)
      .where(eq(servicesTable.id, id)).returning();
    if (!service) return res.status(404).json({ error: "Service not found" });
    return res.json(service);
  } catch (err) {
    req.log.error({ err }, "Update service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(servicesTable)
      .set({ isActive: false, status: "archived", updatedAt: new Date() })
      .where(eq(servicesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete service error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
