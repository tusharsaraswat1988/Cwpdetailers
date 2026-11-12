import { Router, type Request, type Response } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { tenantStamp } from "../middlewares/tenantScope";
import {
  listPlans, getPlanById, createPlans, updatePlan, setPlanActive, deletePlan, planHasSubscriptions,
} from "../lib/dcms/planService";
import {
  createSubscription, listSubscriptions, getSubscriptionDetail,
  updateSubscriptionLocation, renewSubscription,
  getCustomerActiveSubscription, cancelSubscription,
  listExpiringOrInactiveSubscriptions,
  reassignMonthlyCleaner, listMonthlyCleanerSubscriptions,
} from "../lib/dcms/subscriptionService";
import {
  listDcmsPackageWashes, assignDcmsPackageWash,
} from "../lib/dcms/washAssignmentService";
import {
  createOperationalException, listOperationalExceptions, resolveOperationalException,
} from "../lib/dcms/exceptionService";
import { getSocietyDailyOperations } from "../lib/dcms/societyOperationsService";
import {
  getMediaRetentionPolicy, purgeExpiredVisitMedia, setVisitRetentionHold,
} from "../lib/media/mediaRetentionService";
import { completeVisit, recordCarNotAvailable, listVisits, listWashes, listServiceHistory } from "../lib/dcms/visitService";
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
import {
  db,
  dcmsActivityLogsTable,
  dcmsSubscriptionsTable,
  customersTable,
  vehiclesTable,
  invoicesTable,
  staffTable,
} from "@workspace/db";
import { createCashfreePaymentOrder } from "../lib/cashfree/cashfreeService";
import { pauseSubscription, resumeSubscription } from "../lib/dcms/subscriptionService";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { OPERATIONAL_ROLE_SLUGS, staffHasOperationalRole, attachOperationalRoles } from "../lib/staffEcosystem/operationalRoles";

const router = Router();

function handleError(req: Request, res: Response, err: unknown, fallback = "Request failed"): Response {
  req.log.error({ err }, "DCMS error");
  const msg = err instanceof Error ? err.message : fallback;
  if (msg === "Outside Service Area") return res.status(422).json({ error: msg });
  if (err instanceof ImageValidationError) return res.status(422).json({ error: msg });
  if (msg.includes("not found") || msg.includes("not assigned")) return res.status(404).json({ error: msg });
  if (msg.includes("blocked") || msg.includes("No remaining") || msg.includes("already completed") || msg.includes("already recorded")) return res.status(400).json({ error: msg });
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
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const plans = await listPlans(activeOnly, vehicleId, linkedOnly, false, cityId);
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
      const hasScope = allSeatTiers
        || (seatPricingTiers?.length > 0)
        || seatCategoryId != null;
      if (!hasScope) {
        return res.status(400).json({ error: "Select seater tier(s), or choose All" });
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
      }, req);
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
      if (!detail || !rowInScope(req, detail.subscription)) return res.status(404).json({ error: "Subscription not found" });
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
      const customer = await loadIfInScope(req,
        () => db.select().from(customersTable).where(eq(customersTable.id, Number(customerId))).limit(1).then(r => r[0]),
        r => ({ ...r, customerId: r.id }),
      );
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const [veh] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, Number(vehicleId))).limit(1);
      if (!veh || veh.customerId !== Number(customerId) || !rowInScope(req, veh)) {
        return res.status(400).json({ error: "Vehicle not found for this customer" });
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
        companyId: customer.companyId ?? stamped.companyId,
        franchiseeId: customer.franchiseeId ?? stamped.franchiseeId,
        branchId: customer.branchId ?? stamped.branchId,
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

// ─── Daily Cleaning Dedicated Assignment Endpoints ────────────────────────

router.get(
  "/daily-cleaning/assignments/monthly",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const societyId = req.query.societyId ? Number(req.query.societyId) : undefined;
      const status = req.query.status as string | undefined;
      const unassignedOnly = req.query.unassignedOnly === "true";
      const search = req.query.search as string | undefined;

      const data = await listMonthlyCleanerSubscriptions({
        cityId,
        branchId,
        societyId,
        status,
        unassignedOnly,
        search,
      });
      return res.json(data);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/assignments/monthly/assign",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const { subscriptionId, staffId, reason, notes, routeOrder } = req.body;
      if (!subscriptionId || !staffId) {
        return res.status(400).json({ error: "subscriptionId and staffId are required" });
      }

      const assignment = await reassignMonthlyCleaner({
        subscriptionId: Number(subscriptionId),
        newStaffId: Number(staffId),
        assignedBy: req.user!.id,
        reason: typeof reason === "string" ? reason : undefined,
        notes: typeof notes === "string" ? notes : undefined,
        routeOrder: routeOrder != null ? Number(routeOrder) : undefined,
      });

      return res.status(200).json({ ok: true, assignment });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/assignments/washes",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const subscriptionId = req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined;
      const societyId = req.query.societyId ? Number(req.query.societyId) : undefined;
      const hasRemainingWashes = req.query.hasRemainingWashes === "true";
      const scheduledDate = req.query.scheduledDate as string | undefined;
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
      const search = req.query.search as string | undefined;

      const data = await listDcmsPackageWashes({
        subscriptionId,
        societyId,
        hasRemainingWashes,
        scheduledDate,
        cityId,
        branchId,
        search,
      });
      return res.json(data);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/assignments/washes/assign",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const { subscriptionId, staffId, scheduledDate, scheduledTime, notes } = req.body;
      if (!subscriptionId || !staffId || !scheduledDate) {
        return res.status(400).json({ error: "subscriptionId, staffId, and scheduledDate are required" });
      }

      const result = await assignDcmsPackageWash({
        subscriptionId: Number(subscriptionId),
        staffId: Number(staffId),
        scheduledDate: String(scheduledDate),
        scheduledTime: typeof scheduledTime === "string" ? scheduledTime : undefined,
        assignedBy: req.user!.id,
        notes: typeof notes === "string" ? notes : undefined,
      });

      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/assignments/staff-options",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

      const conditions = [
        eq(staffTable.isActive, true),
        eq(staffTable.verificationStatus, "verified"),
      ];
      if (cityId) conditions.push(eq(staffTable.cityId, cityId));
      if (branchId) conditions.push(eq(staffTable.branchId, branchId));

      const staffRows = await db
        .select({
          id: staffTable.id,
          name: staffTable.name,
          phone: staffTable.phone,
          cityId: staffTable.cityId,
          branchId: staffTable.branchId,
        })
        .from(staffTable)
        .where(and(...conditions))
        .orderBy(staffTable.name);

      const withRoles = await attachOperationalRoles(staffRows);

      const enriched = withRoles.map(s => {
        const roles = (s.operationalRoles ?? []).map(r => r.roleSlug);
        const isCleaner = roles.includes("daily_car_cleaner") || roles.length === 0;
        const isWasher = roles.includes("car_washer") || roles.length === 0;
        return {
          id: s.id,
          name: s.name,
          phone: s.phone,
          cityId: s.cityId,
          branchId: s.branchId,
          operationalRoles: roles,
          isCleaner,
          isWasher,
        };
      });

      return res.json(enriched);
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
        status: req.query.status as "completed" | "rejected" | "car_not_available" | undefined,
        month: req.query.month ? Number(req.query.month) : undefined,
        year: req.query.year ? Number(req.query.year) : undefined,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        from: typeof req.query.from === "string" ? req.query.from : undefined,
        to: typeof req.query.to === "string" ? req.query.to : undefined,
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
    const {
      subscriptionId, visitType, imageBase64, latitude, longitude, accuracy,
      exif, capturedAt, ocrText, ocrConfidence, confirmedRegistration, walkIn,
      gpsUnavailable, gpsUnavailableReason,
    } = req.body ?? {};
    req.log.info({
      dcmsVisitComplete: "http_request_received",
      subscriptionId,
      visitType: visitType ?? "cleaning",
      imageBytes: typeof imageBase64 === "string" ? imageBase64.length : 0,
      latitude,
      longitude,
      accuracy,
      contentLength: req.headers["content-length"],
    }, "POST /daily-cleaning/visits/complete");

    try {
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
        capturedAt: typeof capturedAt === "string" ? capturedAt : undefined,
        walkIn: Boolean(walkIn),
        gpsUnavailable: Boolean(gpsUnavailable),
        gpsUnavailableReason: typeof gpsUnavailableReason === "string" ? gpsUnavailableReason : undefined,
      }, { log: req.log });
      return res.status(201).json(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      req.log.error({
        err: error,
        stack: error.stack,
        dcmsVisitComplete: "http_handler_failed",
      }, `POST /daily-cleaning/visits/complete failed: ${error.message}`);
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/visits/car-not-available",
  requireAuth,
  requirePermission("daily_cleaning", "complete_visits"),
  dcmsRateLimit(30, 60_000),
  async (req, res) => {
    const {
      subscriptionId, latitude, longitude, accuracy, walkIn, imageBase64,
      exif, capturedAt, gpsUnavailable, gpsUnavailableReason,
    } = req.body ?? {};
    try {
      if (!subscriptionId || !imageBase64 || latitude == null || longitude == null) {
        return res.status(400).json({ error: "subscriptionId, imageBase64, latitude, and longitude are required" });
      }
      const staffId = req.user!.staffId;
      if (!staffId) return res.status(403).json({ error: "Staff account required" });

      const result = await recordCarNotAvailable({
        subscriptionId: Number(subscriptionId),
        staffId,
        staffName: req.user!.name,
        latitude: Number(latitude),
        longitude: Number(longitude),
        accuracy: accuracy != null ? Number(accuracy) : undefined,
        performedBy: req.user!.id,
        walkIn: Boolean(walkIn),
        imageBase64,
        exif: exif ?? null,
        capturedAt: typeof capturedAt === "string" ? capturedAt : undefined,
        gpsUnavailable: Boolean(gpsUnavailable),
        gpsUnavailableReason: typeof gpsUnavailableReason === "string" ? gpsUnavailableReason : undefined,
      }, { log: req.log });
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

// ─── Service History (cleaning + wash, grouped by day) ───────────────────────

router.get(
  "/daily-cleaning/service-history",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const from = typeof req.query.from === "string" ? req.query.from : undefined;
      const to = typeof req.query.to === "string" ? req.query.to : undefined;
      if (from && to && from > to) {
        return res.status(400).json({ error: "from must be on or before to" });
      }
      return res.json(await listServiceHistory({
        customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
        vehicleId: req.query.vehicleId ? Number(req.query.vehicleId) : undefined,
        subscriptionId: req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined,
        staffId: req.query.staffId ? Number(req.query.staffId) : undefined,
        status: req.query.status as "completed" | "rejected" | "car_not_available" | undefined,
        from,
        to,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      }));
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

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

import crypto from "crypto";

function safeTimingCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** External cron hook (Render cron / manual). Requires valid CRON_SECRET header and fails closed. */
router.post("/daily-cleaning/cron/end-of-day", async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || typeof secret !== "string" || !secret.trim()) {
      req.log.error("CRON_SECRET not configured on server");
      return res.status(500).json({ error: "Cron execution not configured" });
    }
    const incomingHeader = req.headers["x-cron-secret"];
    const incoming = typeof incomingHeader === "string" ? incomingHeader : "";
    if (!incoming || !safeTimingCompare(incoming, secret)) {
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
        statuses: ["completed", "car_not_available"],
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

/**
 * Customer Self-Service: Available Daily Cleaning Plans
 * GET /api/daily-cleaning/customer/available-plans
 * Filters plans strictly for customer's city and vehicle seater tier.
 */
router.get(
  "/daily-cleaning/customer/available-plans",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const [customer] = await db
        .select({ id: customersTable.id, cityId: customersTable.cityId })
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
        .limit(1);

      const cityId = req.query.cityId ? Number(req.query.cityId) : (customer?.cityId ?? undefined);
      const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;

      const plans = await listPlans(true, vehicleId, true, false, cityId);
      return res.json(plans);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

/**
 * Customer Self-Service: Initiate Subscription Purchase Order
 * POST /api/daily-cleaning/customer/subscribe-order
 * Creates subscription in 'pending_payment' status without enqueuing cleaner routes,
 * generates invoice, and creates Cashfree hosted checkout session.
 */
router.post(
  "/daily-cleaning/customer/subscribe-order",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const {
        vehicleId,
        planId,
        startDate,
        societyId,
        towerId,
        flatNumber,
        parkingLevel,
        parkingBay,
        parkingNotes,
        returnUrl,
      } = req.body;

      if (!vehicleId || !planId || !startDate) {
        return res.status(400).json({
          error: "VALIDATION_FAILED",
          message: "vehicleId, planId, and startDate are required",
        });
      }

      // 1. Verify customer and vehicle ownership
      const [customer] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.id, customerId))
        .limit(1);
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const [vehicle] = await db
        .select()
        .from(vehiclesTable)
        .where(and(eq(vehiclesTable.id, Number(vehicleId)), eq(vehiclesTable.customerId, customerId)))
        .limit(1);
      if (!vehicle) {
        return res.status(400).json({ error: "Vehicle not found for this customer" });
      }

      // 2. Guard: Prevent duplicate active subscriptions on the same vehicle
      const [existingActive] = await db
        .select()
        .from(dcmsSubscriptionsTable)
        .where(
          and(
            eq(dcmsSubscriptionsTable.vehicleId, Number(vehicleId)),
            eq(dcmsSubscriptionsTable.status, "active"),
          ),
        )
        .limit(1);

      if (existingActive) {
        return res.status(409).json({
          error: "ACTIVE_SUBSCRIPTION_EXISTS",
          message: "An active subscription already exists for this vehicle. Please renew or cancel before subscribing again.",
          subscriptionId: existingActive.id,
        });
      }

      // 3. Resolve plan and city
      const plan = await getPlanById(Number(planId));
      if (!plan || !plan.isActive) {
        return res.status(400).json({ error: "Plan not found or currently inactive" });
      }

      const effectiveCityId = customer.cityId ?? plan.cityId ?? 1;

      // 4. Create subscription in 'pending_payment' state (cleaner routes NOT assigned yet)
      const sub = await createSubscription(
        {
          customerId,
          vehicleId: Number(vehicleId),
          planId: Number(planId),
          startDate,
          initialStatus: "pending_payment",
          cityId: effectiveCityId,
          branchId: customer.branchId ?? null,
          societyId: societyId ? Number(societyId) : null,
          towerId: towerId ? Number(towerId) : null,
          parkingBay: parkingBay || null,
        },
        req.user!.id,
      );

      // 5. Look up invoice created for this plan
      const [invoice] = await db
        .select()
        .from(invoicesTable)
        .where(
          and(
            eq(invoicesTable.customerId, customerId),
            eq(invoicesTable.status, "sent"),
          ),
        )
        .orderBy(desc(invoicesTable.id))
        .limit(1);

      // 6. Generate Cashfree payment order session
      const host = req.get("host");
      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const origin = req.get("origin");
      let inferredBaseUrl = origin || (host ? `${proto}://${host}` : undefined);
      if (inferredBaseUrl && inferredBaseUrl.startsWith("http://") && !inferredBaseUrl.includes("localhost") && !inferredBaseUrl.includes("127.0.0.1")) {
        inferredBaseUrl = inferredBaseUrl.replace("http://", "https://");
      }

      const checkoutSession = await createCashfreePaymentOrder({
        customerId,
        invoiceId: invoice?.id,
        subscriptionId: sub.id,
        cityId: effectiveCityId,
        branchId: customer.branchId ?? undefined,
        returnUrl: returnUrl || "/customer/payment/return?order_id={order_id}",
        baseUrl: inferredBaseUrl,
      });

      return res.status(201).json({
        success: true,
        subscriptionId: sub.id,
        status: sub.status,
        invoiceId: invoice?.id,
        ...checkoutSession,
      });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

/**
 * Customer Self-Service: Retry Payment for Pending Subscription
 * POST /api/daily-cleaning/customer/subscriptions/:id/retry-payment
 */
router.post(
  "/daily-cleaning/customer/subscriptions/:id/retry-payment",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const subId = Number(req.params.id);
      const [sub] = await db
        .select()
        .from(dcmsSubscriptionsTable)
        .where(and(eq(dcmsSubscriptionsTable.id, subId), eq(dcmsSubscriptionsTable.customerId, customerId)))
        .limit(1);

      if (!sub) return res.status(404).json({ error: "Subscription not found" });
      if (sub.status !== "pending_payment") {
        return res.status(400).json({
          error: "INVALID_STATE",
          message: `Subscription is in '${sub.status}' state and does not require payment`,
        });
      }

      const host = req.get("host");
      const proto = req.get("x-forwarded-proto") || req.protocol || "https";
      const origin = req.get("origin");
      let inferredBaseUrl = origin || (host ? `${proto}://${host}` : undefined);
      if (inferredBaseUrl && inferredBaseUrl.startsWith("http://") && !inferredBaseUrl.includes("localhost") && !inferredBaseUrl.includes("127.0.0.1")) {
        inferredBaseUrl = inferredBaseUrl.replace("http://", "https://");
      }

      const checkoutSession = await createCashfreePaymentOrder({
        customerId,
        subscriptionId: sub.id,
        cityId: sub.cityId ?? undefined,
        branchId: sub.branchId ?? undefined,
        returnUrl: "/customer/payment/return?order_id={order_id}",
        baseUrl: inferredBaseUrl,
      });

      return res.json({
        success: true,
        subscriptionId: sub.id,
        status: sub.status,
        ...checkoutSession,
      });
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

/**
 * Customer Self-Service: Pause Subscription
 * POST /api/daily-cleaning/customer/subscriptions/:id/pause
 */
router.post(
  "/daily-cleaning/customer/subscriptions/:id/pause",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const subId = Number(req.params.id);
      const [sub] = await db
        .select()
        .from(dcmsSubscriptionsTable)
        .where(and(eq(dcmsSubscriptionsTable.id, subId), eq(dcmsSubscriptionsTable.customerId, customerId)))
        .limit(1);

      if (!sub) return res.status(404).json({ error: "Subscription not found" });

      const { pauseStartDate, pauseEndDate, pauseReason } = req.body;
      const updated = await pauseSubscription(
        subId,
        { pauseStartDate, pauseEndDate, pauseReason },
        req.user!.id,
      );

      return res.json(updated);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

/**
 * Customer Self-Service: Resume Subscription
 * POST /api/daily-cleaning/customer/subscriptions/:id/resume
 */
router.post(
  "/daily-cleaning/customer/subscriptions/:id/resume",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const subId = Number(req.params.id);
      const [sub] = await db
        .select()
        .from(dcmsSubscriptionsTable)
        .where(and(eq(dcmsSubscriptionsTable.id, subId), eq(dcmsSubscriptionsTable.customerId, customerId)))
        .limit(1);

      if (!sub) return res.status(404).json({ error: "Subscription not found" });

      const updated = await resumeSubscription(subId, req.user!.id);
      return res.json(updated);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

/**
 * Customer Self-Service: Cancel Subscription
 * POST /api/daily-cleaning/customer/subscriptions/:id/cancel
 */
router.post(
  "/daily-cleaning/customer/subscriptions/:id/cancel",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = req.user!.customerId;
      if (!customerId) return res.status(403).json({ error: "Customer account required" });

      const subId = Number(req.params.id);
      const [sub] = await db
        .select()
        .from(dcmsSubscriptionsTable)
        .where(and(eq(dcmsSubscriptionsTable.id, subId), eq(dcmsSubscriptionsTable.customerId, customerId)))
        .limit(1);

      if (!sub) return res.status(404).json({ error: "Subscription not found" });

      const updated = await cancelSubscription(subId, req.user!.id, req.body.reason);
      return res.json(updated);
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

// ─── Operational Exceptions ─────────────────────────────────────────────────

router.get(
  "/daily-cleaning/exceptions",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const societyId = req.query.societyId ? Number(req.query.societyId) : undefined;
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const staffId = req.query.staffId ? Number(req.query.staffId) : undefined;
      const subscriptionId = req.query.subscriptionId ? Number(req.query.subscriptionId) : undefined;
      const status = req.query.status as any;
      const exceptionType = req.query.exceptionType as any;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await listOperationalExceptions({
        societyId,
        cityId,
        staffId,
        subscriptionId,
        status,
        exceptionType,
        limit,
        offset,
      });
      return res.json(result);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/exceptions",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const {
        subscriptionId, visitId, societyId, cityId, staffId, exceptionType,
        reason, notes, evidencePhotoUrl,
      } = req.body ?? {};

      if (!subscriptionId || !exceptionType || !reason) {
        return res.status(400).json({ error: "subscriptionId, exceptionType, and reason are required" });
      }

      const created = await createOperationalException({
        subscriptionId: Number(subscriptionId),
        visitId: visitId ? Number(visitId) : null,
        societyId: societyId ? Number(societyId) : null,
        cityId: cityId ? Number(cityId) : null,
        staffId: staffId ? Number(staffId) : null,
        exceptionType,
        reason,
        notes,
        evidencePhotoUrl,
        reportedBy: req.user!.id,
        companyId: req.user!.companyId,
      });
      return res.status(201).json(created);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/exceptions/:id/resolve",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const exceptionId = Number(req.params.id);
      const { action, resolutionNotes, newStaffId } = req.body ?? {};
      if (!action || !resolutionNotes) {
        return res.status(400).json({ error: "action and resolutionNotes are required" });
      }

      const updated = await resolveOperationalException({
        exceptionId,
        action,
        resolutionNotes,
        resolvedBy: req.user!.id,
        newStaffId: newStaffId ? Number(newStaffId) : undefined,
      });
      return res.json(updated);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Society Operations Dashboard ───────────────────────────────────────────

router.get(
  "/daily-cleaning/societies/daily-operations",
  requireAuth,
  requirePermission("daily_cleaning", "view_reports"),
  async (req, res) => {
    try {
      const date = req.query.date as string | undefined;
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const data = await getSocietyDailyOperations(date, cityId);
      return res.json(data);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Subscription Lifecycle: Cancel & Expiring ──────────────────────────────

router.post(
  "/daily-cleaning/subscriptions/:id/cancel",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const subscriptionId = Number(req.params.id);
      const { reason } = req.body ?? {};
      const updated = await cancelSubscription(subscriptionId, req.user!.id, reason);
      return res.json(updated);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.get(
  "/daily-cleaning/subscriptions/expiring",
  requireAuth,
  requirePermission("daily_cleaning", "view"),
  async (req, res) => {
    try {
      const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
      const societyId = req.query.societyId ? Number(req.query.societyId) : undefined;
      const status = req.query.status as string | undefined;
      const thresholdCleanings = req.query.thresholdCleanings ? Number(req.query.thresholdCleanings) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = await listExpiringOrInactiveSubscriptions({
        cityId,
        societyId,
        status,
        thresholdCleanings,
        limit,
        offset,
      });
      return res.json(result);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

// ─── Media Retention & Privacy ──────────────────────────────────────────────

router.get(
  "/daily-cleaning/media/retention/policy",
  requireAuth,
  async (req, res) => {
    try {
      return res.json(getMediaRetentionPolicy());
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/media/retention/run-purge",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const { days, dryRun } = req.body ?? {};
      const result = await purgeExpiredVisitMedia({
        days: days ? Number(days) : undefined,
        dryRun: Boolean(dryRun),
        performedBy: req.user!.id,
      });
      return res.json(result);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

router.post(
  "/daily-cleaning/media/retention/visits/:id/hold",
  requireAuth,
  requirePermission("daily_cleaning", "manage_subscriptions"),
  async (req, res) => {
    try {
      const visitId = Number(req.params.id);
      const { hold, reason } = req.body ?? {};
      if (hold == null) {
        return res.status(400).json({ error: "hold boolean is required" });
      }
      const updated = await setVisitRetentionHold(visitId, Boolean(hold), reason, req.user!.id);
      return res.json(updated);
    } catch (err) {
      return handleError(req, res, err);
    }
  },
);

export default router;
