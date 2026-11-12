import { Router, type Request, type Response } from "express";
import { db, citiesTable, statesTable } from "@workspace/db";
import { eq, and, asc, ilike } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import {
  createCity,
  updateCity,
  validateCityReadiness,
  activateCity,
  suspendCity,
  archiveCity,
  getCityOperationsDashboard,
  getCityContent,
  type CityStatus,
} from "../lib/cityManagementService";
import { logger } from "../lib/logger";

const router = Router();

function isCentralAdmin(req: Request): boolean {
  const role = req.user?.role;
  return (
    role === "superadmin" ||
    role === "central_admin" ||
    (role === "admin" && (req.user?.branchId == null || req.user?.branchId === 0))
  );
}

// 1. Dynamic City Content (Public) - CITY-005
router.get("/cities/:idOrSlug/content", async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const content = await getCityContent(idOrSlug);
    return res.json(content);
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      return res.status(404).json({ error: err.message });
    }
    logger.error({ err }, "Error getting city content");
    return res.status(500).json({ error: "Failed to load city content" });
  }
});

// 2. List Cities (Public active list, or comprehensive list for Admins) - CITY-001
router.get("/cities", async (req: Request, res: Response) => {
  try {
    const { status, q, includeAll } = req.query as Record<string, string>;
    const user = req.user;
    const central = user ? isCentralAdmin(req) : false;
    const cityAdmin = user?.role === "city_admin";

    const conditions = [];

    // Non-admins or unauthenticated callers can only see active cities
    if (!central && !cityAdmin) {
      conditions.push(eq(citiesTable.status, "active"));
      conditions.push(eq(citiesTable.isActive, true));
    } else if (cityAdmin) {
      // City Admin can see their assigned city or active cities
      if (includeAll === "true" && user?.cityId) {
        conditions.push(eq(citiesTable.id, user.cityId));
      } else if (status) {
        conditions.push(eq(citiesTable.status, status as any));
      }
    } else {
      // Central admin can filter by status or view all
      if (status && status !== "all") {
        conditions.push(eq(citiesTable.status, status as any));
      }
      if (includeAll !== "true" && !status) {
        conditions.push(eq(citiesTable.isActive, true));
      }
    }

    if (q) {
      conditions.push(ilike(citiesTable.name, `%${q}%`));
    }

    const cities = await db
      .select({
        id: citiesTable.id,
        stateId: citiesTable.stateId,
        name: citiesTable.name,
        slug: citiesTable.slug,
        code: citiesTable.code,
        status: citiesTable.status,
        timezone: citiesTable.timezone,
        currency: citiesTable.currency,
        locale: citiesTable.locale,
        contactPhone: citiesTable.contactPhone,
        contactEmail: citiesTable.contactEmail,
        operationalSettings: citiesTable.operationalSettings,
        contentSettings: citiesTable.contentSettings,
        launchedAt: citiesTable.launchedAt,
        suspendedAt: citiesTable.suspendedAt,
        suspensionReason: citiesTable.suspensionReason,
        archivedAt: citiesTable.archivedAt,
        isActive: citiesTable.isActive,
        createdAt: citiesTable.createdAt,
        updatedAt: citiesTable.updatedAt,
        stateName: statesTable.name,
        stateCode: statesTable.code,
      })
      .from(citiesTable)
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(citiesTable.name));

    return res.json(cities);
  } catch (err: any) {
    logger.error({ err }, "Error listing cities");
    return res.status(500).json({ error: "Failed to list cities" });
  }
});

// 3. Get City Detail
router.get("/cities/:id", async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    // IDOR protection for city_admin
    if (req.user?.role === "city_admin" && req.user.cityId !== cityId) {
      return res.status(403).json({ error: "Access denied to unauthorized city scope" });
    }

    const [city] = await db
      .select({
        id: citiesTable.id,
        stateId: citiesTable.stateId,
        name: citiesTable.name,
        slug: citiesTable.slug,
        code: citiesTable.code,
        status: citiesTable.status,
        timezone: citiesTable.timezone,
        currency: citiesTable.currency,
        locale: citiesTable.locale,
        contactPhone: citiesTable.contactPhone,
        contactEmail: citiesTable.contactEmail,
        operationalSettings: citiesTable.operationalSettings,
        contentSettings: citiesTable.contentSettings,
        launchedAt: citiesTable.launchedAt,
        suspendedAt: citiesTable.suspendedAt,
        suspensionReason: citiesTable.suspensionReason,
        archivedAt: citiesTable.archivedAt,
        isActive: citiesTable.isActive,
        createdAt: citiesTable.createdAt,
        updatedAt: citiesTable.updatedAt,
        stateName: statesTable.name,
        stateCode: statesTable.code,
      })
      .from(citiesTable)
      .innerJoin(statesTable, eq(citiesTable.stateId, statesTable.id))
      .where(eq(citiesTable.id, cityId))
      .limit(1);

    if (!city) return res.status(404).json({ error: "City not found" });

    // Non-admins cannot see non-active cities
    if (!req.user || (!isCentralAdmin(req) && req.user.role !== "city_admin")) {
      if (city.status !== "active" || !city.isActive) {
        return res.status(404).json({ error: "City not found" });
      }
    }

    return res.json(city);
  } catch (err: any) {
    logger.error({ err }, "Error getting city");
    return res.status(500).json({ error: "Failed to get city" });
  }
});

// 4. Create City (Super Admin only) - CITY-001
router.post("/cities", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isCentralAdmin(req)) {
      return res.status(403).json({ error: "Only central super admin can establish new cities" });
    }

    const {
      stateId,
      name,
      slug,
      code,
      timezone,
      currency,
      locale,
      contactPhone,
      contactEmail,
      operationalSettings,
      contentSettings,
    } = req.body;
    if (!name || !stateId) {
      return res.status(400).json({ error: "name and stateId are required" });
    }

    const city = await createCity(
      {
        stateId: Number(stateId),
        name,
        slug,
        code,
        timezone,
        currency,
        locale,
        contactPhone,
        contactEmail,
        operationalSettings,
        contentSettings,
      },
      req.user!.id,
    );

    return res.status(201).json(city);
  } catch (err: any) {
    logger.error({ err }, "Error creating city");
    return res.status(400).json({ error: err.message || "Failed to create city" });
  }
});

// 5. Update City (Super Admin or assigned City Admin) - CITY-001
router.patch("/cities/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    const central = isCentralAdmin(req);
    const cityAdmin = req.user?.role === "city_admin" && req.user.cityId === cityId;

    if (!central && !cityAdmin) {
      return res.status(403).json({ error: "Unauthorized to modify this city configuration" });
    }

    // City Admin cannot alter city status directly
    if (cityAdmin && (req.body.status !== undefined || req.body.isActive !== undefined)) {
      delete req.body.status;
      delete req.body.isActive;
    }

    const updated = await updateCity(cityId, req.body, req.user!.id);
    return res.json(updated);
  } catch (err: any) {
    logger.error({ err }, "Error updating city");
    return res.status(400).json({ error: err.message || "Failed to update city" });
  }
});

// 6. City Readiness Checklist (Admin only) - CITY-003
router.get("/cities/:id/readiness", requireAuth, async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    if (!isCentralAdmin(req) && !(req.user?.role === "city_admin" && req.user.cityId === cityId)) {
      return res.status(403).json({ error: "Access denied to city readiness evaluation" });
    }

    const report = await validateCityReadiness(cityId);
    return res.json(report);
  } catch (err: any) {
    logger.error({ err }, "Error validating city readiness");
    return res.status(400).json({ error: err.message || "Failed to validate city readiness" });
  }
});

// 7. Activate City (Super Admin only) - CITY-001, CITY-003
router.post("/cities/:id/activate", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isCentralAdmin(req)) {
      return res.status(403).json({ error: "Only central super admin can activate an operating city" });
    }

    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    const force = Boolean(req.body.force);
    const activated = await activateCity(cityId, req.user!.id, force);
    return res.json({ success: true, city: activated });
  } catch (err: any) {
    logger.error({ err }, "Error activating city");
    return res.status(400).json({ error: err.message || "Failed to activate city" });
  }
});

// 8. Suspend City (Super Admin only) - CITY-001
router.post("/cities/:id/suspend", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isCentralAdmin(req)) {
      return res.status(403).json({ error: "Only central super admin can suspend a city" });
    }

    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    const { reason } = req.body;
    if (!reason || typeof reason !== "string" || !reason.trim()) {
      return res.status(400).json({ error: "A valid suspension reason is required" });
    }

    const suspended = await suspendCity(cityId, reason, req.user!.id);
    return res.json({ success: true, city: suspended });
  } catch (err: any) {
    logger.error({ err }, "Error suspending city");
    return res.status(400).json({ error: err.message || "Failed to suspend city" });
  }
});

// 9. Archive City (Super Admin only) - CITY-001
router.post("/cities/:id/archive", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!isCentralAdmin(req)) {
      return res.status(403).json({ error: "Only central super admin can archive a city" });
    }

    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    const archived = await archiveCity(cityId, req.user!.id);
    return res.json({ success: true, city: archived });
  } catch (err: any) {
    logger.error({ err }, "Error archiving city");
    return res.status(400).json({ error: err.message || "Failed to archive city" });
  }
});

// 10. City Operations Dashboard (Super Admin or assigned City Admin) - CITY-004
router.get("/cities/:id/operations-dashboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const cityId = parseInt(req.params.id, 10);
    if (isNaN(cityId)) return res.status(400).json({ error: "Invalid city ID" });

    if (!isCentralAdmin(req) && !(req.user?.role === "city_admin" && req.user.cityId === cityId)) {
      return res.status(403).json({ error: "Access denied to city operational dashboard" });
    }

    const dashboard = await getCityOperationsDashboard(cityId);
    return res.json(dashboard);
  } catch (err: any) {
    logger.error({ err }, "Error getting city operations dashboard");
    return res.status(400).json({ error: err.message || "Failed to get city operations dashboard" });
  }
});

export default router;
