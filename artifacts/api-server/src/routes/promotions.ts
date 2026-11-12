import { Router } from "express";
import { db } from "@workspace/db";
import {
  promotionsTable,
  citiesTable,
  servicesTable,
  type Promotion,
  type InsertPromotion,
} from "@workspace/db";
import { eq, and, or, sql, asc, desc, isNull, lte, gte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public Promotions & Banners Discovery
// ─────────────────────────────────────────────────────────────────────────────
router.get("/promotions", async (req, res) => {
  try {
    const {
      cityId,
      citySlug,
      placement,
      bannerType,
      limit,
    } = req.query as Record<string, string>;

    const now = new Date();
    const conditions = [
      eq(promotionsTable.isActive, true),
      or(isNull(promotionsTable.startDate), lte(promotionsTable.startDate, now)),
      or(isNull(promotionsTable.endDate), gte(promotionsTable.endDate, now)),
    ];

    if (placement) {
      conditions.push(eq(promotionsTable.placement, placement));
    }

    if (bannerType) {
      conditions.push(eq(promotionsTable.bannerType, bannerType));
    }

    // Resolve cityId from citySlug if needed
    let resolvedCityId = cityId ? parseInt(cityId, 10) : undefined;
    if (!resolvedCityId && citySlug) {
      const [cityRow] = await db
        .select({ id: citiesTable.id })
        .from(citiesTable)
        .where(eq(citiesTable.slug, citySlug.toLowerCase().trim()))
        .limit(1);
      if (cityRow) {
        resolvedCityId = cityRow.id;
      }
    }

    if (resolvedCityId && !Number.isNaN(resolvedCityId)) {
      // Include targeted promotions for this city OR global fallbacks (city_id IS NULL)
      conditions.push(
        or(
          eq(promotionsTable.cityId, resolvedCityId),
          isNull(promotionsTable.cityId)
        )
      );
    }

    const maxLimit = limit ? Math.min(parseInt(limit, 10), 50) : 20;

    // Order: city-specific first, then sortOrder, then newest
    const orderClause = resolvedCityId
      ? [
          sql`CASE WHEN ${promotionsTable.cityId} = ${resolvedCityId} THEN 0 ELSE 1 END`,
          asc(promotionsTable.sortOrder),
          desc(promotionsTable.id),
        ]
      : [asc(promotionsTable.sortOrder), desc(promotionsTable.id)];

    const list = await db
      .select({
        id: promotionsTable.id,
        title: promotionsTable.title,
        subtitle: promotionsTable.subtitle,
        bannerType: promotionsTable.bannerType,
        placement: promotionsTable.placement,
        cityId: promotionsTable.cityId,
        cityName: citiesTable.name,
        serviceId: promotionsTable.serviceId,
        serviceName: servicesTable.name,
        serviceSlug: servicesTable.slug,
        badgeText: promotionsTable.badgeText,
        imageUrl: promotionsTable.imageUrl,
        mobileImageUrl: promotionsTable.mobileImageUrl,
        ctaText: promotionsTable.ctaText,
        ctaLink: promotionsTable.ctaLink,
        highlights: promotionsTable.highlights,
        advertiserName: promotionsTable.advertiserName,
        startDate: promotionsTable.startDate,
        endDate: promotionsTable.endDate,
        isActive: promotionsTable.isActive,
        sortOrder: promotionsTable.sortOrder,
        metadata: promotionsTable.metadata,
      })
      .from(promotionsTable)
      .leftJoin(citiesTable, eq(promotionsTable.cityId, citiesTable.id))
      .leftJoin(servicesTable, eq(promotionsTable.serviceId, servicesTable.id))
      .where(and(...conditions))
      .orderBy(...orderClause)
      .limit(maxLimit);

    // Asynchronously log impressions (fire-and-forget, non-blocking)
    if (list.length > 0) {
      const ids = list.map(p => p.id);
      db.update(promotionsTable)
        .set({
          impressionCount: sql`${promotionsTable.impressionCount} + 1`,
        })
        .where(sql`${promotionsTable.id} IN (${sql.join(ids, sql`, `)})`)
        .catch(err => {
          req.log.warn({ err }, "Failed to increment promotion impressions");
        });
    }

    return res.json({
      promotions: list,
      resolvedCityId: resolvedCityId || null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to query promotions");
    return res.status(500).json({ error: "Failed to query promotions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Track Promotion Click
// ─────────────────────────────────────────────────────────────────────────────
router.post("/promotions/:id/click", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid promotion id" });
    }

    const [updated] = await db
      .update(promotionsTable)
      .set({
        clickCount: sql`${promotionsTable.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(promotionsTable.id, id))
      .returning({ id: promotionsTable.id, clickCount: promotionsTable.clickCount });

    if (!updated) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    return res.json({ success: true, id: updated.id, clickCount: updated.clickCount });
  } catch (err) {
    req.log.error({ err }, "Failed to record promotion click");
    return res.status(500).json({ error: "Failed to record click" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Admin: List All Promotions & Campaigns
// ─────────────────────────────────────────────────────────────────────────────
router.get("/promotions/admin", requireAuth, async (req, res) => {
  try {
    const { cityId, placement, bannerType } = req.query as Record<string, string>;
    const conditions = [];

    if (cityId) {
      conditions.push(eq(promotionsTable.cityId, parseInt(cityId, 10)));
    }
    if (placement) {
      conditions.push(eq(promotionsTable.placement, placement));
    }
    if (bannerType) {
      conditions.push(eq(promotionsTable.bannerType, bannerType));
    }

    const list = await db
      .select({
        id: promotionsTable.id,
        title: promotionsTable.title,
        subtitle: promotionsTable.subtitle,
        bannerType: promotionsTable.bannerType,
        placement: promotionsTable.placement,
        cityId: promotionsTable.cityId,
        cityName: citiesTable.name,
        serviceId: promotionsTable.serviceId,
        serviceName: servicesTable.name,
        badgeText: promotionsTable.badgeText,
        imageUrl: promotionsTable.imageUrl,
        mobileImageUrl: promotionsTable.mobileImageUrl,
        ctaText: promotionsTable.ctaText,
        ctaLink: promotionsTable.ctaLink,
        highlights: promotionsTable.highlights,
        advertiserName: promotionsTable.advertiserName,
        advertiserContact: promotionsTable.advertiserContact,
        startDate: promotionsTable.startDate,
        endDate: promotionsTable.endDate,
        isActive: promotionsTable.isActive,
        sortOrder: promotionsTable.sortOrder,
        clickCount: promotionsTable.clickCount,
        impressionCount: promotionsTable.impressionCount,
        metadata: promotionsTable.metadata,
        createdAt: promotionsTable.createdAt,
        updatedAt: promotionsTable.updatedAt,
      })
      .from(promotionsTable)
      .leftJoin(citiesTable, eq(promotionsTable.cityId, citiesTable.id))
      .leftJoin(servicesTable, eq(promotionsTable.serviceId, servicesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(promotionsTable.sortOrder), desc(promotionsTable.id));

    return res.json({ promotions: list });
  } catch (err) {
    req.log.error({ err }, "Admin promotions list error");
    return res.status(500).json({ error: "Failed to list promotions" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Admin: Create Promotion
// ─────────────────────────────────────────────────────────────────────────────
router.post("/promotions", requireAuth, async (req, res) => {
  try {
    const body = req.body;
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return res.status(400).json({ error: "Promotion title is required" });
    }

    const [created] = await db
      .insert(promotionsTable)
      .values({
        title: body.title.trim(),
        subtitle: body.subtitle?.trim() || null,
        bannerType: body.bannerType || "first_party",
        placement: body.placement || "home_hero",
        cityId: body.cityId ? parseInt(body.cityId, 10) : null,
        serviceId: body.serviceId ? parseInt(body.serviceId, 10) : null,
        badgeText: body.badgeText?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        mobileImageUrl: body.mobileImageUrl?.trim() || null,
        ctaText: body.ctaText?.trim() || null,
        ctaLink: body.ctaLink?.trim() || null,
        highlights: Array.isArray(body.highlights) ? body.highlights : null,
        advertiserName: body.advertiserName?.trim() || null,
        advertiserContact: body.advertiserContact?.trim() || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        sortOrder: body.sortOrder ? parseInt(body.sortOrder, 10) : 0,
        metadata: body.metadata || null,
      })
      .returning();

    return res.status(201).json({ promotion: created });
  } catch (err) {
    req.log.error({ err }, "Failed to create promotion");
    return res.status(500).json({ error: "Failed to create promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Admin: Update Promotion
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/promotions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid promotion id" });
    }

    const body = req.body;
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle ? body.subtitle.trim() : null;
    if (body.bannerType !== undefined) updateData.bannerType = body.bannerType;
    if (body.placement !== undefined) updateData.placement = body.placement;
    if (body.cityId !== undefined) updateData.cityId = body.cityId ? parseInt(body.cityId, 10) : null;
    if (body.serviceId !== undefined) updateData.serviceId = body.serviceId ? parseInt(body.serviceId, 10) : null;
    if (body.badgeText !== undefined) updateData.badgeText = body.badgeText ? body.badgeText.trim() : null;
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl ? body.imageUrl.trim() : null;
    if (body.mobileImageUrl !== undefined) updateData.mobileImageUrl = body.mobileImageUrl ? body.mobileImageUrl.trim() : null;
    if (body.ctaText !== undefined) updateData.ctaText = body.ctaText ? body.ctaText.trim() : null;
    if (body.ctaLink !== undefined) updateData.ctaLink = body.ctaLink ? body.ctaLink.trim() : null;
    if (body.highlights !== undefined) updateData.highlights = Array.isArray(body.highlights) ? body.highlights : null;
    if (body.advertiserName !== undefined) updateData.advertiserName = body.advertiserName ? body.advertiserName.trim() : null;
    if (body.advertiserContact !== undefined) updateData.advertiserContact = body.advertiserContact ? body.advertiserContact.trim() : null;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.sortOrder !== undefined) updateData.sortOrder = parseInt(body.sortOrder, 10);
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const [updated] = await db
      .update(promotionsTable)
      .set(updateData)
      .where(eq(promotionsTable.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    return res.json({ promotion: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update promotion");
    return res.status(500).json({ error: "Failed to update promotion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Admin: Delete Promotion
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/promotions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) {
      return res.status(400).json({ error: "Invalid promotion id" });
    }

    const [deleted] = await db
      .delete(promotionsTable)
      .where(eq(promotionsTable.id, id))
      .returning({ id: promotionsTable.id });

    if (!deleted) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    return res.json({ success: true, id: deleted.id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete promotion");
    return res.status(500).json({ error: "Failed to delete promotion" });
  }
});

export default router;
