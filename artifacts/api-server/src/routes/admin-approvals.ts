/**
 * Admin / Supervisor Approval Queue & GPS Retention Routes (ADMIN-022, PRIVACY-003 / Phase 18)
 */

import { Router } from "express";
import {
  listMakeupApprovals,
  approveMakeupRequest,
  rejectMakeupRequest,
} from "../lib/booking/services/approvalService";
import {
  getGpsRetentionStats,
  purgeOldGpsLocationLogs,
} from "../lib/tracking/gpsRetentionWorker";
import { BookingValidationError } from "../lib/booking/types";

const router = Router();

// 1. List makeup approval requests
router.get("/admin/makeup-approvals", async (req, res) => {
  try {
    const { status, cityId, branchId, limit, offset } = req.query;
    const result = await listMakeupApprovals(req, {
      status: status ? String(status) : undefined,
      cityId: cityId ? parseInt(String(cityId), 10) : undefined,
      branchId: branchId ? parseInt(String(branchId), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      offset: offset ? parseInt(String(offset), 10) : undefined,
    });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "List makeup approvals error");
    return res.status(500).json({ error: "Failed to list makeup approvals" });
  }
});

// 2. Approve a makeup request
router.post("/admin/makeup-approvals/:id/approve", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid approval ID", code: "INVALID_ID" });
    }
    const { notes } = req.body ?? {};
    const result = await approveMakeupRequest(req, id, { notes });
    return res.json(result);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Approve makeup request error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// 3. Reject a makeup request
router.post("/admin/makeup-approvals/:id/reject", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid approval ID", code: "INVALID_ID" });
    }
    const { reason } = req.body ?? {};
    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        error: "A valid rejection reason is required",
        code: "MISSING_REJECTION_REASON",
      });
    }
    const result = await rejectMakeupRequest(req, id, String(reason).trim());
    return res.json(result);
  } catch (err) {
    if (err instanceof BookingValidationError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    req.log.error({ err }, "Reject makeup request error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

// 4. GPS telemetry retention status
router.get("/admin/tracking/retention-status", async (req, res) => {
  try {
    const stats = getGpsRetentionStats();
    return res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Get GPS retention stats error");
    return res.status(500).json({ error: "Failed to retrieve GPS retention stats" });
  }
});

// 5. Trigger manual / on-demand GPS retention purge
router.post("/admin/tracking/run-purge", async (req, res) => {
  try {
    const dryRun = req.body?.dryRun === true;
    const result = await purgeOldGpsLocationLogs({ dryRun });
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Run GPS purge error");
    return res.status(500).json({ error: "Failed to run GPS retention purge" });
  }
});

export default router;
