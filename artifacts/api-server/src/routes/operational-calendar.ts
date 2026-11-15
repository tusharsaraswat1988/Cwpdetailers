import { Router, type IRouter } from "express";
import { operationalCalendarService } from "../lib/booking/scheduling/operationalCalendarService";
import { insertOperationalClosureSchema } from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

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

    const closure = await operationalCalendarService.updateClosure(id, req.body);
    if (!closure) return res.status(404).json({ error: "Closure not found" });

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
