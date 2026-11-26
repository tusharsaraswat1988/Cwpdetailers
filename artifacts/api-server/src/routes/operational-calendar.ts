import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { operationalCalendarService } from "../lib/booking/scheduling/operationalCalendarService";
import { db, operationalClosuresTable, insertOperationalClosureSchema } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

const CALENDAR_ADMIN_ROLES = new Set([
  "superadmin",
  "super_admin",
  "central_admin",
  "admin",
  "city_admin",
  "branch_manager",
  "manager",
]);

function requireCalendarRole(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (!role || !CALENDAR_ADMIN_ROLES.has(role)) {
    return res.status(403).json({
      error: "Forbidden: Operational calendar management requires administrative privileges",
    });
  }
  return next();
}

function assertCalendarScope(
  req: Request,
  scopeType: string,
  cityId?: number | null,
  branchId?: number | null,
): boolean {
  const user = req.user;
  if (!user) return false;

  const isCentral =
    user.role === "superadmin" ||
    user.role === "super_admin" ||
    user.role === "central_admin" ||
    (user.role === "admin" && (user.branchId == null || user.branchId === 0));

  if (isCentral) return true;

  if (scopeType === "global") {
    // Only central administrators can declare or edit global operating hours or closures
    return false;
  }

  if (user.role === "city_admin") {
    if (scopeType === "city") {
      return user.cityId != null && cityId === user.cityId;
    }
    if (cityId != null && user.cityId != null && cityId !== user.cityId) {
      return false;
    }
    return true;
  }

  if (
    user.role === "branch_manager" ||
    user.role === "manager" ||
    (user.role === "admin" && user.branchId != null)
  ) {
    if (scopeType !== "branch") return false;
    const branchIds = req.scope?.branchIds ?? (user.branchId ? [user.branchId] : []);
    if (branchId == null || !branchIds.includes(branchId)) {
      return false;
    }
    return true;
  }

  return false;
}

// Enforce authentication & calendar admin role on all /admin/calendar endpoints
router.use("/admin/calendar", requireAuth, requireCalendarRole);

// ─── Operating Hours & Weekly Offs ───────────────────────────────────────────

router.get("/admin/calendar/hours", async (req, res) => {
  try {
    const { scopeType, cityId, branchId } = req.query as Record<string, string>;
    const hours = await operationalCalendarService.listOperatingHours({
      scopeType: scopeType || undefined,
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
    });
    return res.json({ hours });
  } catch (err) {
    req.log.error({ err }, "List operating hours error");
    return res.status(500).json({ error: "Failed to list operating hours" });
  }
});

const upsertHoursBodySchema = z.object({
  scopeType: z.enum(["global", "city", "branch"]).default("global"),
  cityId: z.number().nullable().optional(),
  branchId: z.number().nullable().optional(),
  dayOfWeek: z.number().min(0).max(6),
  isWorkingDay: z.boolean(),
  openTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:mm"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Format must be HH:mm"),
  slotStepMinutes: z.number().int().positive().optional().default(15),
  maxConcurrentSlots: z.number().int().positive().optional().default(8),
});

router.put("/admin/calendar/hours", async (req, res) => {
  try {
    const parsed = upsertHoursBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.issues });
    }

    if (!assertCalendarScope(req, parsed.data.scopeType, parsed.data.cityId, parsed.data.branchId)) {
      return res.status(403).json({ error: "Forbidden: Cannot modify operating hours outside assigned scope" });
    }

    const row = await operationalCalendarService.upsertOperatingHours(parsed.data);
    return res.json({ success: true, operatingHours: row });
  } catch (err) {
    req.log.error({ err }, "Upsert operating hours error");
    return res.status(500).json({ error: "Failed to update operating hours" });
  }
});

// ─── Operational Closures & Holiday Declarations ─────────────────────────────

router.get("/admin/calendar/closures", async (req, res) => {
  try {
    const { cityId, branchId, category, includePast } = req.query as Record<string, string>;
    const closures = await operationalCalendarService.listClosures({
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      category: category || undefined,
      includePast: includePast === "true",
    });
    return res.json({ closures });
  } catch (err) {
    req.log.error({ err }, "List closures error");
    return res.status(500).json({ error: "Failed to list closures" });
  }
});

router.post("/admin/calendar/closures", async (req, res) => {
  try {
    const parsed = insertOperationalClosureSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid closure payload", details: parsed.error.issues });
    }

    if (!assertCalendarScope(req, parsed.data.scopeType, parsed.data.cityId, parsed.data.branchId)) {
      return res.status(403).json({ error: "Forbidden: Cannot declare closure outside assigned scope" });
    }

    const closure = await operationalCalendarService.createClosure({
      ...parsed.data,
      createdBy: req.user?.id ?? null,
    });
    return res.status(201).json({ success: true, closure });
  } catch (err) {
    req.log.error({ err }, "Create closure error");
    return res.status(500).json({ error: "Failed to declare operational closure" });
  }
});

router.patch("/admin/calendar/closures/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid closure ID" });

    const [existing] = await db
      .select()
      .from(operationalClosuresTable)
      .where(eq(operationalClosuresTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Closure not found" });

    if (!assertCalendarScope(req, existing.scopeType, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Forbidden: Cannot update closure outside assigned scope" });
    }

    const body = req.body as Record<string, any>;
    if (body.scopeType || body.cityId !== undefined || body.branchId !== undefined) {
      const targetScope = body.scopeType ?? existing.scopeType;
      const targetCity = body.cityId !== undefined ? body.cityId : existing.cityId;
      const targetBranch = body.branchId !== undefined ? body.branchId : existing.branchId;
      if (!assertCalendarScope(req, targetScope, targetCity, targetBranch)) {
        return res.status(403).json({ error: "Forbidden: Cannot reassign closure outside assigned scope" });
      }
    }

    const closure = await operationalCalendarService.updateClosure(id, req.body);
    return res.json({ success: true, closure });
  } catch (err) {
    req.log.error({ err }, "Update closure error");
    return res.status(500).json({ error: "Failed to update operational closure" });
  }
});

router.delete("/admin/calendar/closures/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid closure ID" });

    const [existing] = await db
      .select()
      .from(operationalClosuresTable)
      .where(eq(operationalClosuresTable.id, id))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Closure not found" });

    if (!assertCalendarScope(req, existing.scopeType, existing.cityId, existing.branchId)) {
      return res.status(403).json({ error: "Forbidden: Cannot delete closure outside assigned scope" });
    }

    const deleted = await operationalCalendarService.deleteClosure(id);
    if (!deleted) return res.status(404).json({ error: "Closure not found" });

    return res.json({ success: true, message: "Operational closure removed" });
  } catch (err) {
    req.log.error({ err }, "Delete closure error");
    return res.status(500).json({ error: "Failed to remove operational closure" });
  }
});

// ─── Live Simulator / Preview Endpoint ──────────────────────────────────────

router.get("/admin/calendar/preview", async (req, res) => {
  try {
    const { date, cityId, branchId, segment } = req.query as Record<string, string>;
    if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

    const evaluation = await operationalCalendarService.evaluateDate({
      date,
      cityId: cityId ? parseInt(cityId, 10) : undefined,
      branchId: branchId ? parseInt(branchId, 10) : undefined,
      segment: segment || "catalog_services",
    });

    return res.json({ date, evaluation });
  } catch (err) {
    req.log.error({ err }, "Calendar preview error");
    return res.status(500).json({ error: "Failed to evaluate calendar preview" });
  }
});

export default router;
