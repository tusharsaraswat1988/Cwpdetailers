import { Router, type Request, type Response } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { tenantStamp } from "../middlewares/tenantScope";
import {
  listPlans, getPlanById, createPlans, updatePlan, setPlanActive, deletePlan, planHasSubscriptions,
} from "../lib/dcms/planService";
import {
  createSubscription, listSubscriptions, getSubscriptionDetail,
  updateSubscriptionLocation, assignStaff, listStaffAssignments, renewSubscription,
  getCustomerActiveSubscription,
} from "../lib/dcms/subscriptionService";
import { completeVisit, listVisits, listWashes } from "../lib/dcms/visitService";
import { searchVehicleByRegistration, searchVehicleFromOcrText } from "../lib/dcms/vehicleSearch";
import { recognizePlateFromOcrText, shouldAutoSelectFromOcrConfidence } from "../lib/dcms/plateOcrEngine";
import { searchCustomers, searchVehicles, searchStaff, searchSubscriptions } from "../lib/dcms/entitySearch";
import { getStaffDailyRoute } from "../lib/dcms/dailyRouteService";
import { listSubscriptionsWithOutstandingVisits, runMissedVisitScheduler } from "../lib/dcms/missedVisitService";
import {
  adminPauseSubscription, adminResumeSubscription, customerRequestPause,
  approvePauseRequest, rejectPauseRequest, listPauseHistory, listPendingPauseRequests,
} from "../lib/dcms/pauseService";
import { submitVisitFeedback, getPendingFeedbackForCustomer, getFeedbackStats } from "../lib/dcms/feedbackService";
import { getStaffPerformanceMetrics } from "../lib/dcms/staffPerformanceService";
import { listNotificationEvents } from "../lib/dcms/notificationEvents";
import { getRenewalOperationsStats } from "../lib/dcms/analyticsService";
import { dcmsRateLimit } from "../middlewares/dcmsRateLimit";
import { todayStrInIST } from "../lib/dcms/dateUtils";
import { ImageValidationError } from "../lib/dcms/imageValidation";
import { getAdminDashboardStats, getCustomerDashboardStats } from "../lib/dcms/analyticsService";
import { db, dcmsActivityLogsTable, dcmsSubscriptionsTable } from "@workspace/db";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { OPERATIONAL_ROLE_SLUGS, staffHasOperationalRole } from "../lib/staffEcosystem/operationalRoles";

const router = Router();

function handleError(req: Request, res: Response, err: unknown, fallback = "Request failed"): Response {
  req.log.error({ err }, "DCMS error");
  const msg = err instanceof Error ? err.message : fallback;
  if (msg === "Outside Service Area") return res.status(422).json({ error: msg });
  if (err instanceof ImageValidationError) return res.status(422).json({ error: msg });
  if (msg.includes("not found") || msg.includes("not assigned")) return res.status(404).json({ error: msg });
  if (msg.includes("blocked") || msg.includes("No remaining")) return res.status(400).json({ error: msg });
  if (msg.includes("does not match") || msg.includes("must be linked")) return res.status(400).json({ error: msg });
  return res.status(500).json({ error: msg });
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/admin/dashboard",
  requireAuth,
  requirePermission("daily_cleaning", "view_reports"),
  async (req, res) => {
    try {
      const stats = await getAdminDashboardStats();
      return res.json(stats);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Plans ───────────────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/plans",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;
      const linkedOnly = req.query.linked === "true";
      const plans = await listPlans(activeOnly, vehicleId, linkedOnly);
      const planIds = plans.map(p => p.id);
      const usageRows = planIds.length
        ? await db
          .select({
            planId: dcmsSubscriptionsTable.planId,
            count: sql<number>`count(*)::int`,
          })
          .from(dcmsSubscriptionsTable)
          .where(inArray(dcmsSubscriptionsTable.planId, planIds))
          .groupBy(dcmsSubscriptionsTable.planId)
        : [];
      const usageMap = new Map(usageRows.map(r => [r.planId, r.count > 0]));
      const withUsage = plans.map(p => ({
        ...p,
        hasSubscriptions: usageMap.get(p.id) ?? false,
      }));
      return res.json(withUsage);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/plans/:id",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const plan = await getPlanById(Number(req.params.id));
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      return res.json({ ...plan, hasSubscriptions: await planHasSubscriptions(plan.id) });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/plans",
  requireAuth,
  requirePermission("daily_cleaning", "manage_plans"),
  async (req, res) => {
    try {
      const {
        name, description, price, includedCleanings, includedWashes, weeklyOffs,
        vehicleCategoryId, seatCategoryId, allVehicleCategories, vehicleCategoryIds,
        allSeatTiers, seatPricingTiers, addons, showOnHomepage,
      } = req.body;
      if (!name || price == null || includedCleanings == null) {
        return res.status(400).json({ error: "name, price, and includedCleanings are required" });
      }
      const hasScope = allVehicleCategories || allSeatTiers
        || (vehicleCategoryIds?.length > 0) || (seatPricingTiers?.length > 0)
        || (vehicleCategoryId != null && seatCategoryId != null);
      if (!hasScope) {
        return res.status(400).json({ error: "Select car type(s) and seater tier(s), or choose All" });
      }
      const plans = await createPlans({
        name,
        description,
        price: String(price),
        includedCleanings: Number(includedCleanings),
        includedWashes: Number(includedWashes ?? 0),
        weeklyOffs: Number(weeklyOffs ?? 1),
        vehicleCategoryId: vehicleCategoryId != null ? Number(vehicleCategoryId) : undefined,
        seatCategoryId: seatCategoryId != null ? Number(seatCategoryId) : undefined,
        allVehicleCategories: Boolean(allVehicleCategories),
        vehicleCategoryIds: vehicleCategoryIds?.map(Number),
        allSeatTiers: Boolean(allSeatTiers),
        seatPricingTiers,
        addons,
        showOnHomepage: showOnHomepage != null ? Boolean(showOnHomepage) : undefined,
        companyId: req.user!.companyId,
      }, req.user!.id);
      if (plans.length === 1) return res.status(201).json(plans[0]);
      return res.status(201).json({ plans, count: plans.length });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.patch(
  "/daily-cleaning/plans/:id",
  requireAuth,
  requirePermission("daily_cleaning", "manage_plans"),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const {
        name, description, price, includedCleanings, includedWashes, weeklyOffs, isActive,
        vehicleCategoryId, seatCategoryId, allVehicleCategories, allSeatTiers, addons, showOnHomepage,
      } = req.body;

      if (showOnHomepage != null && Object.keys(req.body).length === 1) {
        const plan = await updatePlan(id, { showOnHomepage: Boolean(showOnHomepage) }, req.user!.id);
        if (!plan) return res.status(404).json({ error: "Plan not found" });
        return res.json(plan);
      }

      if (isActive != null) {
        const plan = await setPlanActive(id, Boolean(isActive), req.user!.id);
        if (!plan) return res.status(404).json({ error: "Plan not found" });
        return res.json(plan);
      }

      const plan = await updatePlan(id, {
        name, description, price: price != null ? String(price) : undefined,
        includedCleanings: includedCleanings != null ? Number(includedCleanings) : undefined,
        includedWashes: includedWashes != null ? Number(includedWashes) : undefined,
        weeklyOffs: weeklyOffs != null ? Number(weeklyOffs) : undefined,
        vehicleCategoryId: vehicleCategoryId === null ? null : (vehicleCategoryId != null ? Number(vehicleCategoryId) : undefined),
        seatCategoryId: seatCategoryId === null ? null : (seatCategoryId != null ? Number(seatCategoryId) : undefined),
        allVehicleCategories: allVehicleCategories != null ? Boolean(allVehicleCategories) : undefined,
        allSeatTiers: allSeatTiers != null ? Boolean(allSeatTiers) : undefined,
        addons,
        showOnHomepage: showOnHomepage != null ? Boolean(showOnHomepage) : undefined,
      }, req.user!.id);
      if (!plan) return res.status(404).json({ error: "Plan not found" });
      return res.json(plan);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.delete(
  "/daily-cleaning/plans/:id",
  requireAuth,
  requirePermission("daily_cleaning", "manage_plans"),
  async (req, res) => {
    try {
      const result = await deletePlan(Number(req.params.id), req.user!.id);
      if (!result.ok) return res.status(400).json({ error: result.error });
      return res.status(204).send();
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Subscriptions ───────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/subscriptions",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const subs = await listSubscriptions({
        status: req.query.status as string | undefined,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
      });
      return res.json(subs);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/subscriptions/:id",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const detail = await getSubscriptionDetail(Number(req.params.id));
      if (!detail) return res.status(404).json({ error: "Subscription not found" });
      return res.json(detail);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/subscriptions",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const { customerId, vehicleId, planId, startDate, latitude, longitude, radiusMeters } = req.body;
      if (!customerId || !vehicleId || !planId || !startDate) {
        return res.status(400).json({ error: "customerId, vehicleId, planId, and startDate are required" });
      }
      const stamped = tenantStamp(req, {});
      const sub = await createSubscription({
        customerId: Number(customerId),
        vehicleId: Number(vehicleId),
        planId: Number(planId),
        startDate,
        latitude: latitude != null ? Number(latitude) : undefined,
        longitude: longitude != null ? Number(longitude) : undefined,
        radiusMeters: radiusMeters != null ? Number(radiusMeters) : undefined,
        companyId: stamped.companyId,
        franchiseeId: stamped.franchiseeId,
        branchId: stamped.branchId,
      }, req.user!.id);
      return res.status(201).json(sub);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/subscriptions/:id/renew",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const sub = await renewSubscription(Number(req.params.id), req.user!.id);
      return res.json(sub);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.patch(
  "/daily-cleaning/subscriptions/:id/location",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const { latitude, longitude, radiusMeters } = req.body;
      if (latitude == null || longitude == null) {
        return res.status(400).json({ error: "latitude and longitude are required" });
      }
      await updateSubscriptionLocation(
        Number(req.params.id),
        Number(latitude),
        Number(longitude),
        Number(radiusMeters ?? 100),
        req.user!.id,
      );
      return res.json({ ok: true });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Assignments ─────────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/assignments",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;
      const assignments = await listStaffAssignments(staffId);
      return res.json(assignments);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/assignments",
  requireAuth,
  requirePermission("daily_cleaning", "manage_assignments"),
  async (req, res) => {
    try {
      const { subscriptionId, staffId, routeOrder } = req.body;
      if (!subscriptionId || !staffId) {
        return res.status(400).json({ error: "subscriptionId and staffId are required" });
      }
      const assignment = await assignStaff(
        Number(subscriptionId),
        Number(staffId),
        req.user!.id,
        routeOrder != null ? Number(routeOrder) : undefined,
      );
      return res.status(201).json(assignment);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Visits ──────────────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/visits",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const visits = await listVisits({
        subscriptionId: req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined,
        staffId: req.query.staffId ? Number(req.query.staffId) : undefined,
        status: req.query.status as "completed" | "rejected" | undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
      });
      return res.json(visits);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/visits/complete",
  requireAuth,
  requirePermission("daily_cleaning", "complete_visits"),
  dcmsRateLimit(30, 60_000),
  async (req, res) => {
    try {
      const { subscriptionId, visitType, imageBase64, latitude, longitude, accuracy, exif, ocrText, ocrConfidence, confirmedRegistration } = req.body;
      if (!subscriptionId || !imageBase64 || latitude == null || longitude == null) {
        return res.status(400).json({ error: "subscriptionId, imageBase64, latitude, and longitude are required" });
      }
      const staffId = req.user!.staffId;
      if (!staffId) return res.status(403).json({ error: "Staff account required" });

      const result = await completeVisit({
        subscriptionId: Number(subscriptionId),
        staffId,
        staffName: req.user!.name,
        visitType: visitType ?? "cleaning",
        imageBase64,
        exif: exif ?? null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy != null ? Number(accuracy) : undefined,
        performedBy: req.user!.id,
        ocrText: ocrText ?? null,
        ocrConfidence: ocrConfidence != null ? Number(ocrConfidence) : null,
        confirmedRegistration: confirmedRegistration ?? null,
      });
      return res.status(201).json(result);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Vehicle Search (Staff) ──────────────────────────────────────────────────

router.get(
  "/daily-cleaning/vehicles/search",
  requireAuth,
  requirePermission("daily_cleaning", "complete_visits"),
  async (req, res) => {
    try {
      const reg = req.query.registration as string | undefined;
      const ocrText = req.query.ocrText as string | undefined;
      if (!reg && !ocrText) {
        return res.status(400).json({ error: "registration or ocrText query param required" });
      }
      const staffId = req.user!.staffId ?? undefined;
      const result = reg
        ? await searchVehicleByRegistration(reg, staffId)
        : await searchVehicleFromOcrText(ocrText!, staffId);
      if (!result) return res.status(404).json({ error: "Vehicle not found" });
      return res.json(result);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/plates/recognize",
  requireAuth,
  requirePermission("daily_cleaning", "complete_visits"),
  dcmsRateLimit(60, 60_000),
  async (req, res) => {
    try {
      const { rawText, confidence } = req.body as { rawText?: string; confidence?: number };
      if (!rawText) return res.status(400).json({ error: "rawText is required" });
      const ocrResult = recognizePlateFromOcrText(rawText, Number(confidence ?? 0));
      const staffId = req.user!.staffId ?? undefined;
      let vehicle = null;
      if (ocrResult.normalizedRegistration) {
        vehicle = await searchVehicleByRegistration(ocrResult.normalizedRegistration, staffId);
      }
      return res.json({
        ocr: ocrResult,
        autoSelect: shouldAutoSelectFromOcrConfidence(ocrResult.confidence),
        vehicle,
      });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Staff Dashboard ─────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/staff/assignments",
  requireAuth,
  requirePermission("daily_cleaning", "complete_visits"),
  async (req, res) => {
    try {
      const staffId = req.user!.staffId;
      if (!staffId) return res.status(403).json({ error: "Staff account required" });
      const hasRole = await staffHasOperationalRole(staffId, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
      if (!hasRole) {
        return res.status(403).json({ error: "Daily Car Cleaner operational role required for daily cleaning assignments" });
      }
      const assignments = await listStaffAssignments(staffId);
      return res.json(assignments);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Entity Search (no raw IDs in UI) ───────────────────────────────────────

router.get("/daily-cleaning/search/customers", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    const q = String(req.query.q ?? "");
    return res.json(await searchCustomers(q));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/search/vehicles", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    return res.json(await searchVehicles({
      query: req.query.q as string | undefined,
      customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
      registration: req.query.registration as string | undefined,
      brand: req.query.brand as string | undefined,
      model: req.query.model as string | undefined,
    }));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/search/staff", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    const roleSlug = typeof req.query.roleSlug === "string" && req.query.roleSlug.trim()
      ? req.query.roleSlug.trim()
      : undefined;
    return res.json(await searchStaff(String(req.query.q ?? ""), { roleSlug }));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/search/subscriptions", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    return res.json(await searchSubscriptions(String(req.query.q ?? "")));
  } catch (err) { return handleError(req, res, err); }
});

// ─── Staff Daily Route ───────────────────────────────────────────────────────

router.get("/daily-cleaning/staff/daily-route", requireAuth, requirePermission("daily_cleaning", "complete_visits"), async (req, res) => {
  try {
    const staffId = req.user!.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });
    const hasRole = await staffHasOperationalRole(staffId, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
    if (!hasRole) {
      return res.status(403).json({ error: "Daily Car Cleaner operational role required for the daily route" });
    }
    const date = req.query.date as string | undefined;
    return res.json(await getStaffDailyRoute(staffId, date));
  } catch (err) { return handleError(req, res, err); }
});

// ─── Wash History ────────────────────────────────────────────────────────────

router.get("/daily-cleaning/washes", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    return res.json(await listWashes({
      subscriptionId: req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined,
      vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
      month: req.query.month ? Number(req.query.month) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
    }));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/customer/washes", requireAuth, async (req, res) => {
  try {
    const customerId = req.user!.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer account required" });
    const subs = await getCustomerActiveSubscription(customerId);
    const allWashes = [];
    for (const s of subs) {
      const washes = await listWashes({
        subscriptionId: s.subscription.id,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
      });
      allWashes.push(...washes);
    }
    return res.json(allWashes);
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/subscriptions/outstanding", requireAuth, requirePermission("daily_cleaning", "view_reports"), async (req, res) => {
  try {
    return res.json(await listSubscriptionsWithOutstandingVisits());
  } catch (err) { return handleError(req, res, err); }
});

router.post("/daily-cleaning/admin/sync-missed", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    const date = req.body.date ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return res.json(await runMissedVisitScheduler(date));
  } catch (err) { return handleError(req, res, err); }
});

/** External cron hook (Render cron / manual). Requires CRON_SECRET header when env set. */
router.post("/daily-cleaning/cron/end-of-day", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers["x-cron-secret"] !== secret) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const date = todayStrInIST();
    const missed = await runMissedVisitScheduler(date);
    const { autoResumeExpiredPauses } = await import("../lib/dcms/pauseService");
    const { runDcmsMaintenanceJobs } = await import("../lib/dcms/maintenanceService");
    const resumed = await autoResumeExpiredPauses(date);
    const maintenance = await runDcmsMaintenanceJobs();
    return res.json({ missed, resumed, maintenance, date });
  } catch (err) { return handleError(req, res, err); }
});

// ─── Pause Management ────────────────────────────────────────────────────────

router.post("/daily-cleaning/subscriptions/:id/pause", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    const { pauseStartDate, pauseEndDate, pauseReason } = req.body;
    if (!pauseStartDate || !pauseEndDate) {
      return res.status(400).json({ error: "pauseStartDate and pauseEndDate are required" });
    }
    const result = await adminPauseSubscription(
      Number(req.params.id),
      pauseStartDate,
      pauseEndDate,
      pauseReason ?? "Admin pause",
      req.user!.id,
    );
    return res.json(result);
  } catch (err) { return handleError(req, res, err); }
});

router.post("/daily-cleaning/subscriptions/:id/resume", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    return res.json(await adminResumeSubscription(Number(req.params.id), req.user!.id));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/subscriptions/:id/pause-history", requireAuth, requirePermission("daily_cleaning", "view"), async (req, res) => {
  try {
    return res.json(await listPauseHistory(Number(req.params.id)));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/pause-requests", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    return res.json(await listPendingPauseRequests());
  } catch (err) { return handleError(req, res, err); }
});

router.post("/daily-cleaning/pause-requests/:id/approve", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    return res.json(await approvePauseRequest(Number(req.params.id), req.user!.id));
  } catch (err) { return handleError(req, res, err); }
});

router.post("/daily-cleaning/pause-requests/:id/reject", requireAuth, requirePermission("daily_cleaning", "manage_subscriptions"), async (req, res) => {
  try {
    return res.json(await rejectPauseRequest(Number(req.params.id), req.user!.id, req.body.reason));
  } catch (err) { return handleError(req, res, err); }
});

router.post("/daily-cleaning/customer/pause-request", requireAuth, dcmsRateLimit(5, 60_000), async (req, res) => {
  try {
    const customerId = req.user!.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer account required" });
    const { subscriptionId, pauseStartDate, pauseEndDate, pauseReason } = req.body;
    if (!subscriptionId || !pauseStartDate || !pauseEndDate) {
      return res.status(400).json({ error: "subscriptionId, pauseStartDate, pauseEndDate required" });
    }
    const result = await customerRequestPause(
      Number(subscriptionId), customerId, pauseStartDate, pauseEndDate, pauseReason ?? "",
    );
    return res.status(201).json(result);
  } catch (err) { return handleError(req, res, err); }
});

// ─── Visit Feedback ──────────────────────────────────────────────────────────

router.post("/daily-cleaning/customer/feedback", requireAuth, dcmsRateLimit(10, 60_000), async (req, res) => {
  try {
    const customerId = req.user!.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer account required" });
    const { visitId, rating, comment } = req.body;
    if (!visitId || !rating || !["yes", "no"].includes(rating)) {
      return res.status(400).json({ error: "visitId and rating (yes/no) required" });
    }
    return res.status(201).json(await submitVisitFeedback({
      visitId: Number(visitId), customerId, rating, comment,
    }));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/customer/pending-feedback", requireAuth, async (req, res) => {
  try {
    const customerId = req.user!.customerId;
    if (!customerId) return res.status(403).json({ error: "Customer account required" });
    return res.json(await getPendingFeedbackForCustomer(customerId));
  } catch (err) { return handleError(req, res, err); }
});

router.get("/daily-cleaning/admin/feedback-stats", requireAuth, requirePermission("daily_cleaning", "view_reports"), async (req, res) => {
  try {
    return res.json(await getFeedbackStats());
  } catch (err) { return handleError(req, res, err); }
});

// ─── Staff Performance ───────────────────────────────────────────────────────

router.get("/daily-cleaning/admin/staff-performance", requireAuth, requirePermission("daily_cleaning", "view_reports"), async (req, res) => {
  try {
    return res.json(await getStaffPerformanceMetrics());
  } catch (err) { return handleError(req, res, err); }
});

// ─── Renewal Operations ──────────────────────────────────────────────────────

router.get("/daily-cleaning/admin/renewal-ops", requireAuth, requirePermission("daily_cleaning", "view_reports"), async (req, res) => {
  try {
    return res.json(await getRenewalOperationsStats());
  } catch (err) { return handleError(req, res, err); }
});

// ─── Notification Events (WhatsApp-ready) ───────────────────────────────────

router.get("/daily-cleaning/admin/notification-events", requireAuth, requirePermission("daily_cleaning", "view_reports"), async (req, res) => {
  try {
    return res.json(await listNotificationEvents({
      eventType: req.query.eventType as any,
      unprocessedOnly: req.query.unprocessed === "true",
    }));
  } catch (err) { return handleError(req, res, err); }
});

// ─── Customer Portal ─────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/customer/dashboard",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });
      const subs = await getCustomerActiveSubscription(customerId);
      const stats = await getCustomerDashboardStats(
        customerId,
        req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
      );
      return res.json({ subscriptions: subs, stats });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/customer/visits",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });
      const subs = await getCustomerActiveSubscription(customerId);
      const subIds = subs.map(s => s.subscription.id);
      if (subIds.length === 0) return res.json([]);

      const visits = await listVisits({
        subscriptionId: req.query.subscriptionId ? Number(req.query.subscriptionId) : subIds[0],
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
        status: "completed",
      });
      return res.json(visits);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/customer/gallery",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });
      const subs = await getCustomerActiveSubscription(customerId);
      const allVisits = [];
      for (const s of subs) {
        const visits = await listVisits({
          subscriptionId: s.subscription.id,
          vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
          month: req.query.month ? Number(req.query.month) : undefined,
          year: req.query.year ? Number(req.query.year) : undefined,
          status: "completed",
        });
        allVisits.push(...visits.filter(v => v.visit.photoUrl));
      }
      return res.json(allVisits);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Activity Logs ───────────────────────────────────────────────────────────

router.get(
  "/daily-cleaning/activity-logs",
  requireAuth,
  requirePermission("daily_cleaning", "view_reports"),
  async (req, res) => {
    try {
      const subscriptionId = req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined;
      const logs = await db
        .select()
        .from(dcmsActivityLogsTable)
        .where(subscriptionId ? eq(dcmsActivityLogsTable.subscriptionId, subscriptionId) : undefined)
        .orderBy(desc(dcmsActivityLogsTable.createdAt))
        .limit(100);
      return res.json(logs);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

export default router;
