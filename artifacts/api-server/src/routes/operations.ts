import { Router, type Request, type Response } from "express";
import { getOperationsTimeline } from "../lib/operations/operationsTimeline";
import { getServiceUpdatesSummary } from "../lib/executions/executionService";
import { getTodayIST } from "../subscriptions/service";
import { requireAuth } from "../middlewares/auth";
import { getOperationsCommandCenter } from "../lib/operations/operationsCommandCenterService";
import {
  listServiceExceptions,
  createOrUpdateServiceException,
  acknowledgeServiceException,
  resolveServiceException,
  scanAndSyncOperationalExceptions,
  type ExceptionCategory,
  type ExceptionSeverity,
} from "../lib/operations/exceptionService";

const router = Router();

// ─── Operations Timeline (Preserved) ──────────────────────────────────────────

router.get("/operations/timeline", async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getTodayIST();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    const timeline = await getOperationsTimeline(req, date);
    const summary = await getServiceUpdatesSummary(req, date);
    return res.json({ ...timeline, summary });
  } catch (err) {
    req.log.error({ err }, "Operations timeline error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Unified Operations Command Center Summary ───────────────────────────────

router.get("/operations/command-center", requireAuth, async (req: Request, res: Response) => {
  try {
    const date = (req.query.date as string) || getTodayIST();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }

    // Resolve tenant scoping
    let cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

    // Scoped role check
    if (!req.scope?.isSuperAdmin && req.scope?.branchIds && req.scope.branchIds.length > 0) {
      if (branchId && !req.scope.branchIds.includes(branchId)) {
        return res.status(403).json({ error: "Access denied. Branch out of authorized scope." });
      }
      if (!branchId) {
        branchId = req.scope.branchIds[0];
      }
    }

    const autoScan = req.query.autoScan === "true" || req.query.autoScan === undefined;

    const summary = await getOperationsCommandCenter({
      date,
      cityId,
      branchId,
      autoScan,
    });

    return res.json(summary);
  } catch (err: any) {
    req.log.error({ err }, "Operations command center error");
    return res.status(500).json({ error: err.message || "Failed to load command center data" });
  }
});

// ─── Service Exceptions Management Hub ──────────────────────────────────────

router.get("/operations/exceptions", requireAuth, async (req: Request, res: Response) => {
  try {
    let cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    let branchId = req.query.branchId ? Number(req.query.branchId) : undefined;

    if (!req.scope?.isSuperAdmin && req.scope?.branchIds && req.scope.branchIds.length > 0) {
      if (branchId && !req.scope.branchIds.includes(branchId)) {
        return res.status(403).json({ error: "Access denied. Branch out of authorized scope." });
      }
      if (!branchId) {
        branchId = req.scope.branchIds[0];
      }
    }

    const result = await listServiceExceptions({
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      severity: typeof req.query.severity === "string" ? req.query.severity : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      cityId,
      branchId,
      customerId: req.query.customerId ? Number(req.query.customerId) : undefined,
      bookingId: req.query.bookingId ? Number(req.query.bookingId) : undefined,
      search: typeof req.query.search === "string" ? req.query.search : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });

    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "List service exceptions error");
    return res.status(500).json({ error: err.message || "Failed to list exceptions" });
  }
});

// ─── Scan and Sync Exceptions ────────────────────────────────────────────────

router.post("/operations/exceptions/scan", requireAuth, async (req: Request, res: Response) => {
  try {
    const isStaffOrAdmin =
      req.scope?.isSuperAdmin ||
      ["admin", "superadmin", "manager", "staff"].includes(req.user?.role ?? "");

    if (!isStaffOrAdmin) {
      return res.status(403).json({ error: "Staff or Admin authorization required" });
    }

    const cityId = req.body.cityId ? Number(req.body.cityId) : undefined;
    const branchId = req.body.branchId ? Number(req.body.branchId) : undefined;

    const result = await scanAndSyncOperationalExceptions({ cityId, branchId });
    return res.json(result);
  } catch (err: any) {
    req.log.error({ err }, "Scan operational exceptions error");
    return res.status(500).json({ error: err.message || "Failed to scan exceptions" });
  }
});

// ─── Create Service Exception (Manual) ──────────────────────────────────────

router.post("/operations/exceptions", requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      category,
      severity,
      title,
      reason,
      bookingId,
      customerId,
      staffId,
      cityId,
      branchId,
      details,
      evidenceUrl,
    } = req.body;

    if (!category || !title || !reason) {
      return res.status(400).json({ error: "category, title, and reason are required" });
    }

    const dedupeKey = `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const created = await createOrUpdateServiceException({
      category: category as ExceptionCategory,
      severity: (severity as ExceptionSeverity) || "medium",
      title: title.trim(),
      reason: reason.trim(),
      dedupeKey,
      bookingId: bookingId ? Number(bookingId) : null,
      customerId: customerId ? Number(customerId) : null,
      staffId: staffId ? Number(staffId) : null,
      cityId: cityId ? Number(cityId) : null,
      branchId: branchId ? Number(branchId) : null,
      details: details || {},
      evidenceUrl: evidenceUrl || null,
    });

    return res.status(201).json(created);
  } catch (err: any) {
    req.log.error({ err }, "Create service exception error");
    return res.status(500).json({ error: err.message || "Failed to create exception" });
  }
});

// ─── Acknowledge Service Exception ──────────────────────────────────────────

router.post("/operations/exceptions/:id/acknowledge", requireAuth, async (req: Request, res: Response) => {
  try {
    const exceptionId = Number(req.params.id);
    const { notes } = req.body;

    const updated = await acknowledgeServiceException({
      exceptionId,
      userId: req.user!.id,
      notes: notes || undefined,
      ipAddress: req.ip || undefined,
    });

    return res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "Acknowledge exception error");
    return res.status(500).json({ error: err.message || "Failed to acknowledge exception" });
  }
});

// ─── Resolve Service Exception ──────────────────────────────────────────────

router.post("/operations/exceptions/:id/resolve", requireAuth, async (req: Request, res: Response) => {
  try {
    const exceptionId = Number(req.params.id);
    const { action, resolutionNotes, assignedStaffId, rescheduleDate, rescheduleTime } = req.body;

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({ error: "resolutionNotes is required" });
    }

    const updated = await resolveServiceException({
      exceptionId,
      userId: req.user!.id,
      action: action || "manual_override",
      resolutionNotes: resolutionNotes.trim(),
      assignedStaffId: assignedStaffId ? Number(assignedStaffId) : undefined,
      rescheduleDate,
      rescheduleTime,
      ipAddress: req.ip || undefined,
    });

    return res.json(updated);
  } catch (err: any) {
    req.log.error({ err }, "Resolve exception error");
    return res.status(500).json({ error: err.message || "Failed to resolve exception" });
  }
});

export default router;
