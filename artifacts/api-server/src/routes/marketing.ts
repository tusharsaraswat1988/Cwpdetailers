import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  homepageSectionsTable,
  marketingCampaignsTable,
  cityLandingPagesTable,
  marketingMediaAssetsTable,
  promotionsTable,
  citiesTable,
  branchesTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, or, isNull, sql, asc, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  resolveHomepageSections,
  resolveHeroBanners,
  resolveCityLandingPage,
} from "../lib/marketing/contentResolutionService";
import {
  validateCouponAndCalculateDiscount,
  recordCampaignUsage,
} from "../lib/marketing/campaignValidationService";
import {
  logMarketingEvent,
  getMarketingAnalyticsSummary,
} from "../lib/marketing/marketingAnalyticsService";
import {
  logFunnelEvent,
  getBookingFunnelAnalytics,
} from "../lib/marketing/bookingFunnelAnalyticsService";
import { getEffectiveServicesForScope } from "../lib/catalog/serviceAvailabilityService";

const router = Router();

// Helper to check city/branch scope authorization for administrative changes
function checkScopePermission(req: Request, targetCityId?: number | null, targetBranchId?: number | null): boolean {
  const user = req.user;
  if (!user) return false;

  // Platform admins can manage all scopes
  if (["superadmin", "central_admin", "admin"].includes(user.role)) {
    return true;
  }

  // City admins must be within their authorized city
  if (user.role === "city_admin") {
    if (targetCityId && req.scope?.cityId && targetCityId !== req.scope.cityId) {
      return false;
    }
    // Cannot manage global content
    if (!targetCityId) {
      return false;
    }
    return true;
  }

  // Branch managers must be within their authorized branches
  if (["branch_manager", "manager"].includes(user.role)) {
    if (targetBranchId && req.scope?.branchIds && !req.scope.branchIds.includes(targetBranchId)) {
      return false;
    }
    if (!targetBranchId) {
      return false;
    }
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public Customer Discovery Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marketing/homepage-sections
 * Dynamic, configuration-driven homepage sections resolution
 */
router.get("/marketing/homepage-sections", async (req: Request, res: Response) => {
  try {
    const { cityId, citySlug, branchId } = req.query as Record<string, string>;

    let resolvedCityId = cityId ? parseInt(cityId, 10) : null;
    if (!resolvedCityId && citySlug) {
      const [cityRow] = await db
        .select({ id: citiesTable.id })
        .from(citiesTable)
        .where(eq(citiesTable.slug, citySlug.toLowerCase().trim()))
        .limit(1);
      if (cityRow) resolvedCityId = cityRow.id;
    }

    const resolvedBranchId = branchId ? parseInt(branchId, 10) : null;

    const sections = await resolveHomepageSections({
      cityId: resolvedCityId,
      branchId: resolvedBranchId,
      includeDrafts: false,
    });

    return res.json({
      sections,
      resolvedCityId,
      resolvedBranchId,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve homepage sections");
    return res.status(500).json({ error: "Failed to resolve homepage sections" });
  }
});

/**
 * GET /api/marketing/hero-banners
 * City/Branch-aware hero banner carousel resolution
 */
router.get("/marketing/hero-banners", async (req: Request, res: Response) => {
  try {
    const { cityId, citySlug, branchId, placement = "home_hero", limit } = req.query as Record<string, string>;

    let resolvedCityId = cityId ? parseInt(cityId, 10) : null;
    if (!resolvedCityId && citySlug) {
      const [cityRow] = await db
        .select({ id: citiesTable.id })
        .from(citiesTable)
        .where(eq(citiesTable.slug, citySlug.toLowerCase().trim()))
        .limit(1);
      if (cityRow) resolvedCityId = cityRow.id;
    }

    const resolvedBranchId = branchId ? parseInt(branchId, 10) : null;

    const banners = await resolveHeroBanners({
      cityId: resolvedCityId,
      branchId: resolvedBranchId,
      placement,
      limit: limit ? parseInt(limit, 10) : 10,
      includeDrafts: false,
    });

    // Fire-and-forget background impression logging for returned banners
    if (banners.length > 0) {
      for (const banner of banners) {
        logMarketingEvent({
          eventType: "banner_impression",
          bannerId: banner.id,
          cityId: resolvedCityId,
          branchId: resolvedBranchId,
        }).catch(() => {});
      }
    }

    return res.json({
      banners,
      resolvedCityId,
      resolvedBranchId,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve hero banners");
    return res.status(500).json({ error: "Failed to resolve hero banners" });
  }
});

/**
 * GET /api/marketing/city-landing/:citySlug
 * Dynamic city landing page content and SEO metadata
 */
router.get("/marketing/city-landing/:citySlug", async (req: Request, res: Response) => {
  try {
    const { citySlug } = req.params;
    const { branchId } = req.query as Record<string, string>;

    const landing = await resolveCityLandingPage({
      citySlug,
      branchId: branchId ? parseInt(branchId, 10) : null,
    });

    if (!landing) {
      return res.status(404).json({ error: "City not found" });
    }

    // Attach active services available in this city from Phase 19 matrix
    const effectiveServices = await getEffectiveServicesForScope({
      cityId: landing.city.id,
      branchId: branchId ? parseInt(branchId, 10) : null,
    });

    return res.json({
      ...landing,
      availableServices: effectiveServices,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to resolve city landing page");
    return res.status(500).json({ error: "Failed to resolve city landing page" });
  }
});

/**
 * POST /api/marketing/coupons/validate
 * Authoritative Backend Coupon Validation
 */
router.post("/marketing/coupons/validate", async (req: Request, res: Response) => {
  try {
    const {
      code,
      orderAmount,
      cityId,
      branchId,
      customerId,
      serviceId,
      packageId,
      vehicleCategory,
    } = req.body;

    if (!code || typeof orderAmount !== "number" || orderAmount < 0) {
      return res.status(400).json({ error: "Code and valid orderAmount are required" });
    }

    const result = await validateCouponAndCalculateDiscount({
      code,
      orderAmount,
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      customerId: customerId ? parseInt(customerId, 10) : null,
      serviceId: serviceId ? parseInt(serviceId, 10) : null,
      packageId: packageId || null,
      vehicleCategory: vehicleCategory || null,
    });

    // Log coupon validation attempt event
    logMarketingEvent({
      eventType: "coupon_applied",
      campaignId: result.campaign?.id || null,
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      customerId: customerId ? parseInt(customerId, 10) : null,
      metadata: { code, isValid: result.isValid, errorCode: result.errorCode },
    }).catch(() => {});

    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to validate coupon");
    return res.status(500).json({ error: "Failed to validate coupon" });
  }
});

/**
 * POST /api/marketing/events
 * Public event tracking endpoint for clicks, impressions, conversions
 */
router.post("/marketing/events", async (req: Request, res: Response) => {
  try {
    const {
      eventType,
      bannerId,
      campaignId,
      cityId,
      branchId,
      customerId,
      sessionId,
      orderId,
      conversionValue,
      metadata,
    } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: "eventType is required" });
    }

    const event = await logMarketingEvent({
      eventType,
      bannerId: bannerId ? parseInt(bannerId, 10) : null,
      campaignId: campaignId ? parseInt(campaignId, 10) : null,
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      customerId: customerId ? parseInt(customerId, 10) : null,
      sessionId,
      orderId,
      conversionValue: typeof conversionValue === "number" ? conversionValue : null,
      metadata,
    });

    return res.json({ success: true, eventId: event?.id });
  } catch (err) {
    req.log.error({ err }, "Failed to record marketing event");
    return res.status(500).json({ error: "Failed to record marketing event" });
  }
});

/**
 * POST /api/marketing/funnel/event
 * Records a booking conversion funnel milestone
 */
router.post("/marketing/funnel/event", async (req: Request, res: Response) => {
  try {
    const {
      milestone,
      sessionId,
      customerId,
      cityId,
      branchId,
      serviceId,
      serviceName,
      orderId,
      deviceType,
      conversionValue,
      metadata,
    } = req.body;

    if (!milestone) {
      return res.status(400).json({ error: "milestone is required" });
    }

    const resolvedSessionId = sessionId || (req.headers["x-session-id"] as string) || "anon";

    const event = await logFunnelEvent({
      milestone,
      sessionId: resolvedSessionId,
      customerId: customerId ? parseInt(customerId, 10) : (req.user?.customerId || null),
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      serviceId: serviceId ? parseInt(serviceId, 10) : null,
      serviceName: serviceName ? String(serviceName) : null,
      orderId: orderId ? String(orderId) : null,
      deviceType: deviceType || "mobile",
      conversionValue: typeof conversionValue === "number" ? conversionValue : null,
      metadata,
    });

    return res.json({ success: true, eventId: event?.id, milestone });
  } catch (err) {
    req.log.error({ err }, "Failed to record funnel event");
    return res.status(500).json({ error: "Failed to record funnel event" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin Marketing CMS Hub Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/marketing/sections
 * List all homepage sections for administrative management
 */
router.get("/marketing/sections", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, branchId } = req.query as Record<string, string>;
    const conditions = [];

    if (cityId) {
      conditions.push(eq(homepageSectionsTable.cityId, parseInt(cityId, 10)));
    }
    if (branchId) {
      conditions.push(eq(homepageSectionsTable.branchId, parseInt(branchId, 10)));
    }

    const list = await db
      .select({
        id: homepageSectionsTable.id,
        sectionKey: homepageSectionsTable.sectionKey,
        title: homepageSectionsTable.title,
        subtitle: homepageSectionsTable.subtitle,
        cityId: homepageSectionsTable.cityId,
        cityName: citiesTable.name,
        branchId: homepageSectionsTable.branchId,
        branchName: branchesTable.name,
        isEnabled: homepageSectionsTable.isEnabled,
        sortOrder: homepageSectionsTable.sortOrder,
        content: homepageSectionsTable.content,
        scheduledPublishAt: homepageSectionsTable.scheduledPublishAt,
        expiresAt: homepageSectionsTable.expiresAt,
        metadata: homepageSectionsTable.metadata,
        createdAt: homepageSectionsTable.createdAt,
        updatedAt: homepageSectionsTable.updatedAt,
      })
      .from(homepageSectionsTable)
      .leftJoin(citiesTable, eq(homepageSectionsTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(homepageSectionsTable.branchId, branchesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(homepageSectionsTable.sortOrder), asc(homepageSectionsTable.id));

    return res.json({ sections: list });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch homepage sections");
    return res.status(500).json({ error: "Failed to fetch homepage sections" });
  }
});

/**
 * POST /api/marketing/sections
 * Create a new homepage section
 */
router.post("/marketing/sections", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.sectionKey || !body.title) {
      return res.status(400).json({ error: "sectionKey and title are required" });
    }

    const targetCityId = body.cityId ? parseInt(body.cityId, 10) : null;
    const targetBranchId = body.branchId ? parseInt(body.branchId, 10) : null;

    if (!checkScopePermission(req, targetCityId, targetBranchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    const [created] = await db
      .insert(homepageSectionsTable)
      .values({
        sectionKey: body.sectionKey.trim(),
        title: body.title.trim(),
        subtitle: body.subtitle ? body.subtitle.trim() : null,
        cityId: targetCityId,
        branchId: targetBranchId,
        isEnabled: body.isEnabled !== undefined ? Boolean(body.isEnabled) : true,
        sortOrder: body.sortOrder ? parseInt(body.sortOrder, 10) : 0,
        content: body.content || {},
        scheduledPublishAt: body.scheduledPublishAt ? new Date(body.scheduledPublishAt) : null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        metadata: body.metadata || {},
      })
      .returning();

    return res.status(201).json({ section: created });
  } catch (err) {
    req.log.error({ err }, "Failed to create homepage section");
    return res.status(500).json({ error: "Failed to create homepage section" });
  }
});

/**
 * PATCH /api/marketing/sections/:id
 * Update a homepage section
 */
router.patch("/marketing/sections/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid section id" });

    const [existing] = await db
      .select()
      .from(homepageSectionsTable)
      .where(eq(homepageSectionsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Section not found" });

    if (!checkScopePermission(req, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    const body = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.sectionKey !== undefined) updateData.sectionKey = body.sectionKey;
    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.subtitle !== undefined) updateData.subtitle = body.subtitle ? body.subtitle.trim() : null;
    if (body.isEnabled !== undefined) updateData.isEnabled = Boolean(body.isEnabled);
    if (body.sortOrder !== undefined) updateData.sortOrder = parseInt(body.sortOrder, 10);
    if (body.content !== undefined) updateData.content = body.content;
    if (body.scheduledPublishAt !== undefined) {
      updateData.scheduledPublishAt = body.scheduledPublishAt ? new Date(body.scheduledPublishAt) : null;
    }
    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    }
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const [updated] = await db
      .update(homepageSectionsTable)
      .set(updateData)
      .where(eq(homepageSectionsTable.id, id))
      .returning();

    return res.json({ section: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update homepage section");
    return res.status(500).json({ error: "Failed to update homepage section" });
  }
});

/**
 * DELETE /api/marketing/sections/:id
 */
router.delete("/marketing/sections/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid section id" });

    const [existing] = await db
      .select()
      .from(homepageSectionsTable)
      .where(eq(homepageSectionsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Section not found" });

    if (!checkScopePermission(req, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    await db.delete(homepageSectionsTable).where(eq(homepageSectionsTable.id, id));
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete homepage section");
    return res.status(500).json({ error: "Failed to delete homepage section" });
  }
});

/**
 * POST /api/marketing/sections/reorder
 * Bulk reorder sections
 */
router.post("/marketing/sections/reorder", requireAuth, async (req: Request, res: Response) => {
  try {
    const { sectionIds } = req.body;
    if (!Array.isArray(sectionIds)) {
      return res.status(400).json({ error: "sectionIds array required" });
    }

    for (let i = 0; i < sectionIds.length; i++) {
      const id = sectionIds[i];
      await db
        .update(homepageSectionsTable)
        .set({ sortOrder: i + 1, updatedAt: new Date() })
        .where(eq(homepageSectionsTable.id, id));
    }

    return res.json({ success: true, reorderedCount: sectionIds.length });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder homepage sections");
    return res.status(500).json({ error: "Failed to reorder homepage sections" });
  }
});

/**
 * GET /api/marketing/campaigns
 * List all campaigns and promotional coupon rules
 */
router.get("/marketing/campaigns", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, branchId, status } = req.query as Record<string, string>;
    const conditions = [];

    if (cityId) conditions.push(eq(marketingCampaignsTable.cityId, parseInt(cityId, 10)));
    if (branchId) conditions.push(eq(marketingCampaignsTable.branchId, parseInt(branchId, 10)));
    if (status) conditions.push(eq(marketingCampaignsTable.status, status));

    const list = await db
      .select({
        id: marketingCampaignsTable.id,
        code: marketingCampaignsTable.code,
        name: marketingCampaignsTable.name,
        description: marketingCampaignsTable.description,
        cityId: marketingCampaignsTable.cityId,
        cityName: citiesTable.name,
        branchId: marketingCampaignsTable.branchId,
        branchName: branchesTable.name,
        offerType: marketingCampaignsTable.offerType,
        discountValue: marketingCampaignsTable.discountValue,
        minOrderAmount: marketingCampaignsTable.minOrderAmount,
        maxDiscountAmount: marketingCampaignsTable.maxDiscountAmount,
        applicableServiceIds: marketingCampaignsTable.applicableServiceIds,
        applicablePackageIds: marketingCampaignsTable.applicablePackageIds,
        applicableVehicleCategories: marketingCampaignsTable.applicableVehicleCategories,
        usageLimit: marketingCampaignsTable.usageLimit,
        usedCount: marketingCampaignsTable.usedCount,
        perCustomerLimit: marketingCampaignsTable.perCustomerLimit,
        eligibilityRule: marketingCampaignsTable.eligibilityRule,
        startDate: marketingCampaignsTable.startDate,
        endDate: marketingCampaignsTable.endDate,
        isActive: marketingCampaignsTable.isActive,
        status: marketingCampaignsTable.status,
        termsAndConditions: marketingCampaignsTable.termsAndConditions,
        bannerId: marketingCampaignsTable.bannerId,
        metadata: marketingCampaignsTable.metadata,
        createdAt: marketingCampaignsTable.createdAt,
        updatedAt: marketingCampaignsTable.updatedAt,
      })
      .from(marketingCampaignsTable)
      .leftJoin(citiesTable, eq(marketingCampaignsTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(marketingCampaignsTable.branchId, branchesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(marketingCampaignsTable.id));

    return res.json({ campaigns: list });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch marketing campaigns");
    return res.status(500).json({ error: "Failed to fetch marketing campaigns" });
  }
});

/**
 * POST /api/marketing/campaigns
 * Create a new campaign coupon offer
 */
router.post("/marketing/campaigns", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.code || !body.name || body.discountValue == null) {
      return res.status(400).json({ error: "code, name, and discountValue are required" });
    }

    const targetCityId = body.cityId ? parseInt(body.cityId, 10) : null;
    const targetBranchId = body.branchId ? parseInt(body.branchId, 10) : null;

    if (!checkScopePermission(req, targetCityId, targetBranchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    const normalizedCode = body.code.trim().toUpperCase();

    const [existing] = await db
      .select({ id: marketingCampaignsTable.id })
      .from(marketingCampaignsTable)
      .where(eq(marketingCampaignsTable.code, normalizedCode))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: `Campaign code "${normalizedCode}" already exists` });
    }

    const [created] = await db
      .insert(marketingCampaignsTable)
      .values({
        code: normalizedCode,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        cityId: targetCityId,
        branchId: targetBranchId,
        offerType: body.offerType || "percentage_discount",
        discountValue: String(body.discountValue),
        minOrderAmount: body.minOrderAmount != null ? String(body.minOrderAmount) : "0",
        maxDiscountAmount: body.maxDiscountAmount != null ? String(body.maxDiscountAmount) : null,
        applicableServiceIds: Array.isArray(body.applicableServiceIds) ? body.applicableServiceIds : [],
        applicablePackageIds: Array.isArray(body.applicablePackageIds) ? body.applicablePackageIds : [],
        applicableVehicleCategories: Array.isArray(body.applicableVehicleCategories)
          ? body.applicableVehicleCategories
          : [],
        usageLimit: body.usageLimit ? parseInt(body.usageLimit, 10) : null,
        perCustomerLimit: body.perCustomerLimit ? parseInt(body.perCustomerLimit, 10) : 1,
        eligibilityRule: body.eligibilityRule || "all",
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
        status: body.status || "active",
        termsAndConditions: body.termsAndConditions?.trim() || null,
        bannerId: body.bannerId ? parseInt(body.bannerId, 10) : null,
        metadata: body.metadata || {},
      })
      .returning();

    return res.status(201).json({ campaign: created });
  } catch (err) {
    req.log.error({ err }, "Failed to create campaign");
    return res.status(500).json({ error: "Failed to create campaign" });
  }
});

/**
 * PATCH /api/marketing/campaigns/:id
 */
router.patch("/marketing/campaigns/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid campaign id" });

    const [existing] = await db
      .select()
      .from(marketingCampaignsTable)
      .where(eq(marketingCampaignsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    if (!checkScopePermission(req, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    const body = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.code !== undefined) updateData.code = body.code.trim().toUpperCase();
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : null;
    if (body.offerType !== undefined) updateData.offerType = body.offerType;
    if (body.discountValue !== undefined) updateData.discountValue = String(body.discountValue);
    if (body.minOrderAmount !== undefined) updateData.minOrderAmount = String(body.minOrderAmount);
    if (body.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount = body.maxDiscountAmount != null ? String(body.maxDiscountAmount) : null;
    }
    if (body.applicableServiceIds !== undefined) updateData.applicableServiceIds = body.applicableServiceIds;
    if (body.applicablePackageIds !== undefined) updateData.applicablePackageIds = body.applicablePackageIds;
    if (body.applicableVehicleCategories !== undefined) updateData.applicableVehicleCategories = body.applicableVehicleCategories;
    if (body.usageLimit !== undefined) updateData.usageLimit = body.usageLimit ? parseInt(body.usageLimit, 10) : null;
    if (body.perCustomerLimit !== undefined) updateData.perCustomerLimit = parseInt(body.perCustomerLimit, 10);
    if (body.eligibilityRule !== undefined) updateData.eligibilityRule = body.eligibilityRule;
    if (body.startDate !== undefined) updateData.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.termsAndConditions !== undefined) updateData.termsAndConditions = body.termsAndConditions;
    if (body.bannerId !== undefined) updateData.bannerId = body.bannerId ? parseInt(body.bannerId, 10) : null;
    if (body.metadata !== undefined) updateData.metadata = body.metadata;

    const [updated] = await db
      .update(marketingCampaignsTable)
      .set(updateData)
      .where(eq(marketingCampaignsTable.id, id))
      .returning();

    return res.json({ campaign: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to update campaign");
    return res.status(500).json({ error: "Failed to update campaign" });
  }
});

/**
 * DELETE /api/marketing/campaigns/:id
 */
router.delete("/marketing/campaigns/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid campaign id" });

    const [existing] = await db
      .select()
      .from(marketingCampaignsTable)
      .where(eq(marketingCampaignsTable.id, id))
      .limit(1);

    if (!existing) return res.status(404).json({ error: "Campaign not found" });

    if (!checkScopePermission(req, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    await db.delete(marketingCampaignsTable).where(eq(marketingCampaignsTable.id, id));
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete campaign");
    return res.status(500).json({ error: "Failed to delete campaign" });
  }
});

/**
 * GET /api/marketing/landing-pages
 * List city landing pages
 */
router.get("/marketing/landing-pages", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await db
      .select({
        id: cityLandingPagesTable.id,
        cityId: cityLandingPagesTable.cityId,
        cityName: citiesTable.name,
        branchId: cityLandingPagesTable.branchId,
        branchName: branchesTable.name,
        slug: cityLandingPagesTable.slug,
        pageTitle: cityLandingPagesTable.pageTitle,
        seoTitle: cityLandingPagesTable.seoTitle,
        seoDescription: cityLandingPagesTable.seoDescription,
        seoKeywords: cityLandingPagesTable.seoKeywords,
        canonicalUrl: cityLandingPagesTable.canonicalUrl,
        ogTitle: cityLandingPagesTable.ogTitle,
        ogDescription: cityLandingPagesTable.ogDescription,
        ogImage: cityLandingPagesTable.ogImage,
        heroHeadline: cityLandingPagesTable.heroHeadline,
        heroSubheadline: cityLandingPagesTable.heroSubheadline,
        customFaqs: cityLandingPagesTable.customFaqs,
        customTestimonials: cityLandingPagesTable.customTestimonials,
        localizedContent: cityLandingPagesTable.localizedContent,
        isPublished: cityLandingPagesTable.isPublished,
        createdAt: cityLandingPagesTable.createdAt,
        updatedAt: cityLandingPagesTable.updatedAt,
      })
      .from(cityLandingPagesTable)
      .leftJoin(citiesTable, eq(cityLandingPagesTable.cityId, citiesTable.id))
      .leftJoin(branchesTable, eq(cityLandingPagesTable.branchId, branchesTable.id))
      .orderBy(asc(citiesTable.name));

    return res.json({ landingPages: list });
  } catch (err) {
    req.log.error({ err }, "Failed to list landing pages");
    return res.status(500).json({ error: "Failed to list landing pages" });
  }
});

/**
 * POST /api/marketing/landing-pages
 * Create or update city landing page
 */
router.post("/marketing/landing-pages", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.cityId || !body.slug || !body.pageTitle) {
      return res.status(400).json({ error: "cityId, slug, and pageTitle are required" });
    }

    const cityId = parseInt(body.cityId, 10);
    const branchId = body.branchId ? parseInt(body.branchId, 10) : null;

    if (!checkScopePermission(req, cityId, branchId)) {
      return res.status(403).json({ error: "Unauthorized scope modification" });
    }

    const [existing] = await db
      .select({ id: cityLandingPagesTable.id })
      .from(cityLandingPagesTable)
      .where(
        and(
          eq(cityLandingPagesTable.cityId, cityId),
          branchId ? eq(cityLandingPagesTable.branchId, branchId) : isNull(cityLandingPagesTable.branchId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(cityLandingPagesTable)
        .set({
          slug: body.slug.toLowerCase().trim(),
          pageTitle: body.pageTitle.trim(),
          seoTitle: body.seoTitle || null,
          seoDescription: body.seoDescription || null,
          seoKeywords: body.seoKeywords || null,
          canonicalUrl: body.canonicalUrl || null,
          ogTitle: body.ogTitle || null,
          ogDescription: body.ogDescription || null,
          ogImage: body.ogImage || null,
          heroHeadline: body.heroHeadline || null,
          heroSubheadline: body.heroSubheadline || null,
          customFaqs: Array.isArray(body.customFaqs) ? body.customFaqs : [],
          customTestimonials: Array.isArray(body.customTestimonials) ? body.customTestimonials : [],
          localizedContent: body.localizedContent || {},
          isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
          updatedAt: new Date(),
        })
        .where(eq(cityLandingPagesTable.id, existing.id))
        .returning();
      return res.json({ landingPage: updated });
    }

    const [created] = await db
      .insert(cityLandingPagesTable)
      .values({
        cityId,
        branchId,
        slug: body.slug.toLowerCase().trim(),
        pageTitle: body.pageTitle.trim(),
        seoTitle: body.seoTitle || null,
        seoDescription: body.seoDescription || null,
        seoKeywords: body.seoKeywords || null,
        canonicalUrl: body.canonicalUrl || null,
        ogTitle: body.ogTitle || null,
        ogDescription: body.ogDescription || null,
        ogImage: body.ogImage || null,
        heroHeadline: body.heroHeadline || null,
        heroSubheadline: body.heroSubheadline || null,
        customFaqs: Array.isArray(body.customFaqs) ? body.customFaqs : [],
        customTestimonials: Array.isArray(body.customTestimonials) ? body.customTestimonials : [],
        localizedContent: body.localizedContent || {},
        isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
      })
      .returning();

    return res.status(201).json({ landingPage: created });
  } catch (err) {
    req.log.error({ err }, "Failed to save city landing page");
    return res.status(500).json({ error: "Failed to save city landing page" });
  }
});

/**
 * GET /api/marketing/media
 * Reusable marketing media library
 */
router.get("/marketing/media", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, tag } = req.query as Record<string, string>;
    const conditions = [eq(marketingMediaAssetsTable.isActive, true)];

    if (cityId) {
      conditions.push(
        or(
          eq(marketingMediaAssetsTable.cityId, parseInt(cityId, 10)),
          isNull(marketingMediaAssetsTable.cityId)
        )!
      );
    }

    const list = await db
      .select()
      .from(marketingMediaAssetsTable)
      .where(and(...conditions))
      .orderBy(desc(marketingMediaAssetsTable.id));

    return res.json({ mediaAssets: list });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch media assets");
    return res.status(500).json({ error: "Failed to fetch media assets" });
  }
});

/**
 * POST /api/marketing/media
 * Register media asset in library
 */
router.post("/marketing/media", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body.title || !body.fileUrl) {
      return res.status(400).json({ error: "title and fileUrl are required" });
    }

    const [asset] = await db
      .insert(marketingMediaAssetsTable)
      .values({
        title: body.title.trim(),
        altText: body.altText?.trim() || null,
        fileUrl: body.fileUrl.trim(),
        thumbnailUrl: body.thumbnailUrl?.trim() || null,
        fileType: body.fileType || "image/jpeg",
        fileSizeBytes: body.fileSizeBytes ? parseInt(body.fileSizeBytes, 10) : null,
        width: body.width ? parseInt(body.width, 10) : null,
        height: body.height ? parseInt(body.height, 10) : null,
        tags: Array.isArray(body.tags) ? body.tags : [],
        cityId: body.cityId ? parseInt(body.cityId, 10) : null,
        branchId: body.branchId ? parseInt(body.branchId, 10) : null,
        isActive: true,
      })
      .returning();

    return res.status(201).json({ mediaAsset: asset });
  } catch (err) {
    req.log.error({ err }, "Failed to save media asset");
    return res.status(500).json({ error: "Failed to save media asset" });
  }
});

/**
 * DELETE /api/marketing/media/:id
 */
router.delete("/marketing/media/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || Number.isNaN(id)) return res.status(400).json({ error: "Invalid media id" });

    await db.delete(marketingMediaAssetsTable).where(eq(marketingMediaAssetsTable.id, id));
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Failed to delete media asset");
    return res.status(500).json({ error: "Failed to delete media asset" });
  }
});

/**
 * GET /api/marketing/analytics
 * Marketing campaign & banner performance analytics
 */
router.get("/marketing/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, branchId, startDate, endDate } = req.query as Record<string, string>;

    const summary = await getMarketingAnalyticsSummary({
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    return res.json(summary);
  } catch (err) {
    req.log.error({ err }, "Failed to generate marketing analytics");
    return res.status(500).json({ error: "Failed to generate marketing analytics" });
  }
});

/**
 * GET /api/marketing/funnel/analytics
 * Booking conversion funnel drop-off and conversion rates
 */
router.get("/marketing/funnel/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, branchId, serviceId, deviceType, startDate, endDate } = req.query as Record<string, string>;

    const analytics = await getBookingFunnelAnalytics({
      cityId: cityId ? parseInt(cityId, 10) : null,
      branchId: branchId ? parseInt(branchId, 10) : null,
      serviceId: serviceId ? parseInt(serviceId, 10) : null,
      deviceType: deviceType || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    });

    return res.json(analytics);
  } catch (err) {
    req.log.error({ err }, "Failed to generate booking funnel analytics");
    return res.status(500).json({ error: "Failed to generate booking funnel analytics" });
  }
});

/**
 * GET /api/marketing/preview
 * Unified Customer Experience Preview Simulation for Admin
 */
router.get("/marketing/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const { cityId, branchId } = req.query as Record<string, string>;
    const targetCityId = cityId ? parseInt(cityId, 10) : null;
    const targetBranchId = branchId ? parseInt(branchId, 10) : null;

    let cityName = "All India (Global)";
    if (targetCityId) {
      const [city] = await db
        .select({ name: citiesTable.name })
        .from(citiesTable)
        .where(eq(citiesTable.id, targetCityId))
        .limit(1);
      if (city) cityName = city.name;
    }

    let branchName: string | null = null;
    if (targetBranchId) {
      const [branch] = await db
        .select({ name: branchesTable.name })
        .from(branchesTable)
        .where(eq(branchesTable.id, targetBranchId))
        .limit(1);
      if (branch) branchName = branch.name;
    }

    const [sections, banners, services, campaigns] = await Promise.all([
      resolveHomepageSections({ cityId: targetCityId, branchId: targetBranchId, includeDrafts: true }),
      resolveHeroBanners({ cityId: targetCityId, branchId: targetBranchId, includeDrafts: true }),
      targetCityId ? getEffectiveServicesForScope({ cityId: targetCityId, branchId: targetBranchId }) : [],
      db
        .select()
        .from(marketingCampaignsTable)
        .where(
          and(
            eq(marketingCampaignsTable.isActive, true),
            targetCityId
              ? or(eq(marketingCampaignsTable.cityId, targetCityId), isNull(marketingCampaignsTable.cityId))
              : isNull(marketingCampaignsTable.cityId)
          )
        )
        .limit(5),
    ]);

    return res.json({
      previewScope: {
        cityId: targetCityId,
        cityName,
        branchId: targetBranchId,
        branchName,
      },
      sections,
      banners,
      services,
      campaigns,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate preview simulation");
    return res.status(500).json({ error: "Failed to generate preview simulation" });
  }
});

export default router;
