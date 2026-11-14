import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { uxExperimentsTable, citiesTable, branchesTable, servicesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  getActiveExperimentsForScreen,
  logExperimentExposure,
  recordExperimentConversion,
  getExperimentAnalytics,
} from "../lib/ux/uxExperimentService";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// 1. Public / Customer Facing Experiment Resolution & Telemetry
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/ux/experiments/active
 * Resolves active A/B experiments and deterministic variant assignments for session
 */
router.get("/ux/experiments/active", async (req: Request, res: Response) => {
  try {
    const { targetScreen, cityId, branchId, sessionId, customerId } = req.query as Record<string, string>;

    const resolvedSessionId = sessionId || (req.headers["x-session-id"] as string) || "anon";

    const experiments = await getActiveExperimentsForScreen({
      targetScreen: targetScreen || undefined,
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      sessionId: resolvedSessionId,
      customerId: customerId ? parseInt(customerId, 10) : undefined,
    });

    return res.json({
      success: true,
      experiments,
      sessionId: resolvedSessionId,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to resolve active experiments" });
  }
});

/**
 * POST /api/ux/experiments/exposure
 * Records exposure to an experiment variant
 */
router.post("/ux/experiments/exposure", async (req: Request, res: Response) => {
  try {
    const { experimentId, variantId, sessionId, customerId, cityId, deviceType, metadata } = req.body;

    if (!experimentId || !variantId || !sessionId) {
      return res.status(400).json({ error: "experimentId, variantId, and sessionId are required" });
    }

    const exposure = await logExperimentExposure({
      experimentId: Number(experimentId),
      variantId: String(variantId),
      sessionId: String(sessionId),
      customerId: customerId ? Number(customerId) : undefined,
      cityId: cityId ? Number(cityId) : undefined,
      deviceType: deviceType || "mobile",
      metadata,
    });

    return res.json({ success: true, exposure });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to log exposure" });
  }
});

/**
 * POST /api/ux/experiments/conversion
 * Records a conversion event against active exposures for the session
 */
router.post("/ux/experiments/conversion", async (req: Request, res: Response) => {
  try {
    const { sessionId, customerId, eventName, conversionValue } = req.body;

    if (!sessionId || !eventName) {
      return res.status(400).json({ error: "sessionId and eventName are required" });
    }

    const conversions = await recordExperimentConversion({
      sessionId: String(sessionId),
      customerId: customerId ? Number(customerId) : undefined,
      eventName: String(eventName),
      conversionValue: conversionValue != null ? Number(conversionValue) : undefined,
    });

    return res.json({ success: true, updatedCount: conversions.length, conversions });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to record conversion" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Admin Experiment Management & Analytics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/ux-experiments
 * List all experiments with city and target info
 */
router.get("/admin/ux-experiments", requireAuth, async (req: Request, res: Response) => {
  try {
    const experiments = await db
      .select({
        id: uxExperimentsTable.id,
        key: uxExperimentsTable.key,
        name: uxExperimentsTable.name,
        description: uxExperimentsTable.description,
        targetScreen: uxExperimentsTable.targetScreen,
        cityId: uxExperimentsTable.cityId,
        branchId: uxExperimentsTable.branchId,
        serviceId: uxExperimentsTable.serviceId,
        status: uxExperimentsTable.status,
        variants: uxExperimentsTable.variants,
        trafficAllocation: uxExperimentsTable.trafficAllocation,
        primaryMetric: uxExperimentsTable.primaryMetric,
        winnerVariantId: uxExperimentsTable.winnerVariantId,
        startDate: uxExperimentsTable.startDate,
        endDate: uxExperimentsTable.endDate,
        createdAt: uxExperimentsTable.createdAt,
        updatedAt: uxExperimentsTable.updatedAt,
      })
      .from(uxExperimentsTable)
      .orderBy(desc(uxExperimentsTable.createdAt));

    return res.json({ experiments });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to list experiments" });
  }
});

/**
 * GET /api/admin/ux-experiments/:id
 * Retrieve single experiment with statistical analytics report
 */
router.get("/admin/ux-experiments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid experiment ID" });

    const report = await getExperimentAnalytics(id);
    if (!report) return res.status(404).json({ error: "Experiment not found" });

    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch experiment report" });
  }
});

/**
 * POST /api/admin/ux-experiments
 * Create a new UX experiment
 */
router.post("/admin/ux-experiments", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      key,
      name,
      description,
      targetScreen = "homepage",
      cityId,
      branchId,
      serviceId,
      status = "draft",
      variants = [],
      trafficAllocation = 100,
      primaryMetric = "booking_confirmed",
    } = req.body;

    if (!key || !name) {
      return res.status(400).json({ error: "key and name are required" });
    }

    // Default variants if not provided
    const configuredVariants = Array.isArray(variants) && variants.length > 0
      ? variants
      : [
          { id: "control", name: "Control (Default)", weight: 50, config: {} },
          { id: "variant_b", name: "Variant B", weight: 50, config: {} },
        ];

    const [created] = await db
      .insert(uxExperimentsTable)
      .values({
        key: String(key).trim().toLowerCase(),
        name: String(name).trim(),
        description: description ? String(description).trim() : null,
        targetScreen: String(targetScreen).trim(),
        cityId: cityId ? Number(cityId) : null,
        branchId: branchId ? Number(branchId) : null,
        serviceId: serviceId ? Number(serviceId) : null,
        status: String(status),
        variants: configuredVariants,
        trafficAllocation: Number(trafficAllocation) || 100,
        primaryMetric: String(primaryMetric),
      })
      .returning();

    return res.status(201).json({ success: true, experiment: created });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to create experiment" });
  }
});

/**
 * PUT /api/admin/ux-experiments/:id
 * Update status, variants, or winner of an experiment
 */
router.put("/admin/ux-experiments/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid experiment ID" });

    const {
      name,
      description,
      status,
      variants,
      trafficAllocation,
      primaryMetric,
      winnerVariantId,
    } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (variants !== undefined) updateData.variants = variants;
    if (trafficAllocation !== undefined) updateData.trafficAllocation = Number(trafficAllocation);
    if (primaryMetric !== undefined) updateData.primaryMetric = primaryMetric;
    if (winnerVariantId !== undefined) updateData.winnerVariantId = winnerVariantId;

    if (status === "active" && !updateData.startDate) {
      updateData.startDate = new Date();
    } else if (status === "completed" && !updateData.endDate) {
      updateData.endDate = new Date();
    }

    const [updated] = await db
      .update(uxExperimentsTable)
      .set(updateData)
      .where(eq(uxExperimentsTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Experiment not found" });

    return res.json({ success: true, experiment: updated });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to update experiment" });
  }
});

export default router;
