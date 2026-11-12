import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middlewares/auth";
import {
  submitVisitFeedback,
  getCustomerPendingFeedback,
} from "../lib/quality/visitFeedbackService";
import { getServiceQualityAnalytics } from "../lib/quality/qualityAnalyticsService";
import {
  resolveSlaPolicy,
  evaluateTicketSla,
} from "../lib/quality/slaService";
import {
  processCustomerCancellation,
  getWinbackCandidates,
  triggerRenewalReminders,
  CANCELLATION_REASONS,
  type CancellationReasonType,
} from "../lib/retention/retentionService";
import {
  db,
  dcmsVisitFeedbackTable,
  dcmsVisitsTable,
  complaintsTable,
  slaPoliciesTable,
  slaEscalationLogsTable,
  staffTable,
  customersTable,
} from "@workspace/db";
import { eq, and, desc, gte, inArray, sql } from "drizzle-orm";

const router = Router();

// ─── 1. Submit Visit Feedback ────────────────────────────────────────────────
router.post("/visits/:id/feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    const visitId = Number(req.params.id);
    const customerId = req.user?.customerId ?? Number(req.body.customerId);
    if (!customerId) {
      return res.status(400).json({ error: "Customer ID required to submit feedback" });
    }

    const { ratingScore, comment, tags, issueReported } = req.body;
    if (ratingScore == null || isNaN(Number(ratingScore))) {
      return res.status(400).json({ error: "Numeric ratingScore (1-5) is required" });
    }

    const result = await submitVisitFeedback({
      visitId,
      customerId,
      ratingScore: Number(ratingScore),
      comment: typeof comment === "string" ? comment.trim() : undefined,
      tags: Array.isArray(tags) ? tags : undefined,
      issueReported: Boolean(issueReported),
    });

    return res.status(201).json(result);
  } catch (err: any) {
    req.log.error({ err }, "Submit visit feedback error");
    return res.status(err.message?.includes("Access denied") ? 403 : 400).json({
      error: err.message || "Failed to submit feedback",
    });
  }
});

// ─── 2. Get Pending Feedback for Customer ────────────────────────────────────
router.get("/customer/pending-feedback", requireAuth, async (req: Request, res: Response) => {
  try {
    const customerId = req.user?.customerId ?? Number(req.query.customerId);
    if (!customerId) {
      return res.status(400).json({ error: "Customer ID required" });
    }

    const pending = await getCustomerPendingFeedback(customerId);
    return res.json({ data: pending });
  } catch (err: any) {
    req.log.error({ err }, "Get pending feedback error");
    return res.status(500).json({ error: "Failed to get pending feedback" });
  }
});

// ─── 3. Service Quality Analytics ────────────────────────────────────────────
router.get("/quality/analytics", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");
    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    const branchId = req.query.branchId ? Number(req.query.branchId) : (req.scope?.branchIds?.[0] ?? undefined);
    const startDate = typeof req.query.startDate === "string" ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === "string" ? req.query.endDate : undefined;

    const analytics = await getServiceQualityAnalytics({
      cityId,
      branchId,
      startDate,
      endDate,
    });

    return res.json(analytics);
  } catch (err: any) {
    req.log.error({ err }, "Quality analytics error");
    return res.status(500).json({ error: "Failed to load quality analytics" });
  }
});

// ─── 4. Supervisor Quality Command Hub ───────────────────────────────────────
router.get("/quality/supervisor-hub", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");
    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Low Rating Visits (last 7 days, <= 2 stars)
    const lowRatingConditions = [
      sql`${dcmsVisitFeedbackTable.ratingScore} <= 2`,
      gte(dcmsVisitFeedbackTable.createdAt, new Date(Date.now() - 7 * 24 * 3600 * 1000)),
    ];
    if (cityId) lowRatingConditions.push(eq(dcmsVisitFeedbackTable.cityId, cityId));
    if (branchId) lowRatingConditions.push(eq(dcmsVisitFeedbackTable.branchId, branchId));

    const lowRatingVisits = await db
      .select({
        id: dcmsVisitFeedbackTable.id,
        visitId: dcmsVisitFeedbackTable.visitId,
        ratingScore: dcmsVisitFeedbackTable.ratingScore,
        comment: dcmsVisitFeedbackTable.comment,
        tags: dcmsVisitFeedbackTable.tags,
        complaintId: dcmsVisitFeedbackTable.complaintId,
        createdAt: dcmsVisitFeedbackTable.createdAt,
      })
      .from(dcmsVisitFeedbackTable)
      .where(and(...lowRatingConditions))
      .orderBy(desc(dcmsVisitFeedbackTable.createdAt))
      .limit(10);

    // 2. Active reclean requests or urgent tickets
    const ticketConditions = [
      inArray(complaintsTable.status, ["open", "assigned", "in_progress", "awaiting_customer"]),
    ];
    if (cityId) ticketConditions.push(eq(complaintsTable.cityId, cityId));
    if (branchId) ticketConditions.push(eq(complaintsTable.branchId, branchId));

    const attentionTickets = await db
      .select({
        id: complaintsTable.id,
        ticketNumber: complaintsTable.ticketNumber,
        title: complaintsTable.title,
        type: complaintsTable.type,
        priority: complaintsTable.priority,
        status: complaintsTable.status,
        slaStatus: complaintsTable.slaStatus,
        escalationLevel: complaintsTable.escalationLevel,
        resolutionDueAt: complaintsTable.resolutionDueAt,
        assignedSupervisorId: complaintsTable.assignedSupervisorId,
        createdAt: complaintsTable.createdAt,
      })
      .from(complaintsTable)
      .where(and(...ticketConditions))
      .orderBy(desc(complaintsTable.priority), desc(complaintsTable.createdAt))
      .limit(15);

    // 3. Recent SLA Escalations
    const escalationLogs = await db
      .select({
        id: slaEscalationLogsTable.id,
        complaintId: slaEscalationLogsTable.complaintId,
        escalationLevel: slaEscalationLogsTable.escalationLevel,
        reason: slaEscalationLogsTable.reason,
        escalatedToRole: slaEscalationLogsTable.escalatedToRole,
        metadata: slaEscalationLogsTable.metadata,
        createdAt: slaEscalationLogsTable.createdAt,
      })
      .from(slaEscalationLogsTable)
      .orderBy(desc(slaEscalationLogsTable.createdAt))
      .limit(10);

    return res.json({
      lowRatingVisits,
      attentionTickets,
      escalationLogs,
    });
  } catch (err: any) {
    req.log.error({ err }, "Supervisor quality hub error");
    return res.status(500).json({ error: "Failed to load supervisor quality hub" });
  }
});

// ─── 5. SLA Policies CRUD ───────────────────────────────────────────────────
router.get("/quality/sla-policies", requireAuth, async (req: Request, res: Response) => {
  try {
    const policies = await db
      .select()
      .from(slaPoliciesTable)
      .orderBy(desc(slaPoliciesTable.isActive), desc(slaPoliciesTable.id));
    return res.json({ data: policies });
  } catch (err: any) {
    req.log.error({ err }, "List SLA policies error");
    return res.status(500).json({ error: "Failed to list SLA policies" });
  }
});

router.post("/quality/sla-policies", requireAuth, async (req: Request, res: Response) => {
  try {
    const isAdmin =
      req.scope?.isSuperAdmin || ["admin", "superadmin"].includes(req.user?.role ?? "");
    if (!isAdmin) {
      return res.status(403).json({ error: "Admin authorization required to create SLA policies" });
    }

    const {
      name,
      cityId,
      serviceType,
      category,
      priority,
      responseTargetMinutes,
      resolutionTargetMinutes,
      pauseOnCustomerResponse,
      escalationLevel1Minutes,
      escalationLevel2Minutes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Policy name is required" });
    }

    const [policy] = await db
      .insert(slaPoliciesTable)
      .values({
        name: name.trim(),
        cityId: cityId ? Number(cityId) : null,
        serviceType: serviceType || null,
        category: category || "all",
        priority: priority || "all",
        responseTargetMinutes: Number(responseTargetMinutes) || 720,
        resolutionTargetMinutes: Number(resolutionTargetMinutes) || 1440,
        pauseOnCustomerResponse: pauseOnCustomerResponse !== false,
        escalationLevel1Minutes: escalationLevel1Minutes ? Number(escalationLevel1Minutes) : null,
        escalationLevel2Minutes: escalationLevel2Minutes ? Number(escalationLevel2Minutes) : null,
        isActive: true,
      })
      .returning();

    return res.status(201).json(policy);
  } catch (err: any) {
    req.log.error({ err }, "Create SLA policy error");
    return res.status(500).json({ error: "Failed to create SLA policy" });
  }
});

// ─── 6. Customer Subscription Cancellation with Structured Reason ────────────
router.post(
  "/customer/subscriptions/:id/cancel-with-reason",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const subscriptionId = Number(req.params.id);
      const isCustomer = req.user!.role === "customer" || Boolean(req.user!.customerId);
      const customerId = isCustomer ? req.user!.customerId : Number(req.body.customerId);

      if (!customerId) {
        return res.status(400).json({ error: "Customer ID required" });
      }

      const { reason, feedback } = req.body;
      if (!reason || !CANCELLATION_REASONS.includes(reason)) {
        return res.status(400).json({
          error: `Valid reason required. Must be one of: ${CANCELLATION_REASONS.join(", ")}`,
        });
      }

      const updated = await processCustomerCancellation({
        subscriptionId,
        customerId,
        reason: reason as CancellationReasonType,
        feedback: typeof feedback === "string" ? feedback.trim() : undefined,
        performedBy: req.user!.id,
      });

      return res.json({
        success: true,
        message: "Subscription cancelled successfully",
        subscription: updated,
      });
    } catch (err: any) {
      req.log.error({ err }, "Cancel subscription with reason error");
      return res.status(err.message?.includes("Access denied") ? 403 : 400).json({
        error: err.message || "Failed to cancel subscription",
      });
    }
  }
);

// ─── 7. Retention & Win-Back Candidates ──────────────────────────────────────
router.get("/retention/winback-candidates", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager"].includes(req.user?.role ?? "");
    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const reasonFilter = typeof req.query.reason === "string" ? req.query.reason : undefined;

    const candidates = await getWinbackCandidates({
      cityId,
      branchId,
      reasonFilter,
    });

    return res.json({ data: candidates });
  } catch (err: any) {
    req.log.error({ err }, "Winback candidates error");
    return res.status(500).json({ error: "Failed to load winback candidates" });
  }
});

// ─── 8. Trigger Renewal Reminders ────────────────────────────────────────────
router.post("/retention/trigger-reminders", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager"].includes(req.user?.role ?? "");
    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const cityId = req.body.cityId ? Number(req.body.cityId) : undefined;
    const result = await triggerRenewalReminders(cityId);

    return res.json({
      success: true,
      message: `Triggered ${result.sent} renewal reminders.`,
      result,
    });
  } catch (err: any) {
    req.log.error({ err }, "Trigger renewal reminders error");
    return res.status(500).json({ error: "Failed to trigger reminders" });
  }
});

export default router;
