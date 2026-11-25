import { Router, type Request, type Response } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import {
  resolveConfigKey,
  resolveBranchOperationalSettings,
  resolveOperatingHours,
} from "../lib/config/configInheritanceResolver";
import { db, branchesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logAdminAudit } from "../lib/audit/adminAuditService";

const router = Router();

/**
 * GET /api/config/resolve
 * Resolves a single configuration key following the Branch -> City -> Global -> Default hierarchy.
 */
router.get("/config/resolve", requireAuth, async (req: Request, res: Response) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      return res.status(400).json({ error: "Missing required 'key' query parameter" });
    }

    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;
    const defaultValue = req.query.defaultValue as string | undefined;

    const resolved = await resolveConfigKey(key, { branchId, cityId, defaultValue });
    return res.json(resolved);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to resolve config key");
    return res.status(500).json({ error: err.message || "Failed to resolve configuration" });
  }
});

/**
 * GET /api/config/branch/:branchId/settings
 * Resolves full merged operational settings dictionary for a branch.
 */
router.get("/config/branch/:branchId/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const branchId = Number(req.params.branchId);
    if (!branchId || isNaN(branchId)) {
      return res.status(400).json({ error: "Invalid branchId" });
    }

    const resolved = await resolveBranchOperationalSettings(branchId);
    return res.json(resolved);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to resolve branch settings");
    return res.status(500).json({ error: err.message || "Failed to resolve branch settings" });
  }
});

/**
 * PUT /api/config/branch/:branchId/settings
 * Updates branch custom settings. Requires admin or branch_manager permissions.
 */
router.put(
  "/config/branch/:branchId/settings",
  requireAuth,
  requirePermission("branches", "edit"),
  async (req: Request, res: Response) => {
    try {
      const branchId = Number(req.params.branchId);
      if (!branchId || isNaN(branchId)) {
        return res.status(400).json({ error: "Invalid branchId" });
      }

      const { customSettings } = req.body;
      if (!customSettings || typeof customSettings !== "object") {
        return res.status(400).json({ error: "customSettings object is required" });
      }

      const [branch] = await db
        .select()
        .from(branchesTable)
        .where(eq(branchesTable.id, branchId))
        .limit(1);

      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }

      const updatedSettings = {
        ...((branch.customSettings as Record<string, unknown>) ?? {}),
        ...customSettings,
      };

      const [updated] = await db
        .update(branchesTable)
        .set({
          customSettings: updatedSettings,
          updatedAt: new Date(),
        })
        .where(eq(branchesTable.id, branchId))
        .returning();

      await logAdminAudit({
        action: "branch_custom_settings_updated",
        entityType: "branch",
        entityId: branchId,
        branchId,
        performedBy: req.user!.id,
        reason: "Updated branch operational configuration",
        details: { customSettings },
      });

      return res.json({ ok: true, branch: updated });
    } catch (err: any) {
      req.log?.error?.({ err }, "Failed to update branch settings");
      return res.status(500).json({ error: err.message || "Failed to update branch settings" });
    }
  },
);

/**
 * GET /api/config/operating-hours
 * Resolves operating hours for day of week across Branch -> City -> Global hierarchy.
 */
router.get("/config/operating-hours", requireAuth, async (req: Request, res: Response) => {
  try {
    const dayOfWeek = req.query.dayOfWeek != null ? Number(req.query.dayOfWeek) : new Date().getDay();
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const cityId = req.query.cityId ? Number(req.query.cityId) : undefined;

    const resolved = await resolveOperatingHours({ branchId, cityId, dayOfWeek });
    return res.json(resolved);
  } catch (err: any) {
    req.log?.error?.({ err }, "Failed to resolve operating hours");
    return res.status(500).json({ error: err.message || "Failed to resolve operating hours" });
  }
});

export default router;
