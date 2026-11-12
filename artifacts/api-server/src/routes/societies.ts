import { Router } from "express";
import { db } from "@workspace/db";
import {
  residentialSocietiesTable,
  societyTowersTable,
  citiesTable,
  serviceAreasTable,
  type ResidentialSociety,
  type SocietyTower,
} from "@workspace/db";
import { eq, and, ilike, or, sql, asc, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

function slugifyCode(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. List Societies
// ─────────────────────────────────────────────────────────────────────────────
router.get("/societies", async (req, res) => {
  try {
    const {
      cityId,
      citySlug,
      serviceAreaId,
      search,
      q,
      isActive,
      limit,
      offset,
    } = req.query as Record<string, string>;

    const conditions = [];

    // Filter by cityId or resolve citySlug
    let resolvedCityId = cityId ? parseInt(cityId, 10) : undefined;
    if (!resolvedCityId && citySlug) {
      const [cityRow] = await db
        .select({ id: citiesTable.id })
        .from(citiesTable)
        .where(eq(citiesTable.slug, citySlug.toLowerCase().trim()))
        .limit(1);
      if (cityRow) {
        resolvedCityId = cityRow.id;
      }
    }

    if (resolvedCityId && !Number.isNaN(resolvedCityId)) {
      conditions.push(eq(residentialSocietiesTable.cityId, resolvedCityId));
    }

    if (serviceAreaId && !Number.isNaN(parseInt(serviceAreaId, 10))) {
      conditions.push(eq(residentialSocietiesTable.serviceAreaId, parseInt(serviceAreaId, 10)));
    }

    if (isActive !== undefined) {
      conditions.push(eq(residentialSocietiesTable.isActive, isActive === "true"));
    } else {
      conditions.push(eq(residentialSocietiesTable.isActive, true));
    }

    const searchTerm = (search || q || "").trim();
    if (searchTerm) {
      const pattern = `%${searchTerm}%`;
      conditions.push(
        or(
          ilike(residentialSocietiesTable.name, pattern),
          ilike(residentialSocietiesTable.code, pattern),
          ilike(residentialSocietiesTable.address, pattern),
          ilike(residentialSocietiesTable.pincode, pattern),
        ),
      );
    }

    const lim = Math.min(Math.max(parseInt(limit || "50", 10), 1), 100);
    const off = Math.max(parseInt(offset || "0", 10), 0);
    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: residentialSocietiesTable.id,
          name: residentialSocietiesTable.name,
          code: residentialSocietiesTable.code,
          address: residentialSocietiesTable.address,
          pincode: residentialSocietiesTable.pincode,
          latitude: residentialSocietiesTable.latitude,
          longitude: residentialSocietiesTable.longitude,
          gateSecurityNotes: residentialSocietiesTable.gateSecurityNotes,
          totalTowers: residentialSocietiesTable.totalTowers,
          totalFlats: residentialSocietiesTable.totalFlats,
          isActive: residentialSocietiesTable.isActive,
          cityId: residentialSocietiesTable.cityId,
          cityName: citiesTable.name,
          serviceAreaId: residentialSocietiesTable.serviceAreaId,
          serviceAreaName: serviceAreasTable.name,
          createdAt: residentialSocietiesTable.createdAt,
          updatedAt: residentialSocietiesTable.updatedAt,
        })
        .from(residentialSocietiesTable)
        .leftJoin(citiesTable, eq(residentialSocietiesTable.cityId, citiesTable.id))
        .leftJoin(serviceAreasTable, eq(residentialSocietiesTable.serviceAreaId, serviceAreasTable.id))
        .where(whereClause)
        .orderBy(asc(residentialSocietiesTable.name))
        .limit(lim)
        .offset(off),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(residentialSocietiesTable)
        .where(whereClause),
    ]);

    return res.json({
      data: rows,
      total: countResult[0]?.count ?? 0,
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "Error listing residential societies");
    return res.status(500).json({ error: "Failed to list societies" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Get Society Details & Towers
// ─────────────────────────────────────────────────────────────────────────────
router.get("/societies/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid society id" });

    const [society] = await db
      .select({
        id: residentialSocietiesTable.id,
        name: residentialSocietiesTable.name,
        code: residentialSocietiesTable.code,
        address: residentialSocietiesTable.address,
        pincode: residentialSocietiesTable.pincode,
        latitude: residentialSocietiesTable.latitude,
        longitude: residentialSocietiesTable.longitude,
        gateSecurityNotes: residentialSocietiesTable.gateSecurityNotes,
        totalTowers: residentialSocietiesTable.totalTowers,
        totalFlats: residentialSocietiesTable.totalFlats,
        isActive: residentialSocietiesTable.isActive,
        cityId: residentialSocietiesTable.cityId,
        cityName: citiesTable.name,
        serviceAreaId: residentialSocietiesTable.serviceAreaId,
        serviceAreaName: serviceAreasTable.name,
        createdAt: residentialSocietiesTable.createdAt,
        updatedAt: residentialSocietiesTable.updatedAt,
      })
      .from(residentialSocietiesTable)
      .leftJoin(citiesTable, eq(residentialSocietiesTable.cityId, citiesTable.id))
      .leftJoin(serviceAreasTable, eq(residentialSocietiesTable.serviceAreaId, serviceAreasTable.id))
      .where(eq(residentialSocietiesTable.id, id))
      .limit(1);

    if (!society) {
      return res.status(404).json({ error: "Residential society not found" });
    }

    const towers = await db
      .select()
      .from(societyTowersTable)
      .where(and(eq(societyTowersTable.societyId, id), eq(societyTowersTable.isActive, true)))
      .orderBy(asc(societyTowersTable.name));

    return res.json({
      ...society,
      towers,
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching residential society");
    return res.status(500).json({ error: "Failed to fetch society" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Create Society (Admin / Manager)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/societies", requireAuth, async (req, res) => {
  try {
    const {
      name,
      code,
      cityId,
      serviceAreaId,
      address,
      pincode,
      latitude,
      longitude,
      gateSecurityNotes,
      totalTowers,
      totalFlats,
      towers,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Society name is required" });
    }
    if (!cityId || Number.isNaN(Number(cityId))) {
      return res.status(400).json({ error: "Valid cityId is required" });
    }
    if (!address || typeof address !== "string" || !address.trim()) {
      return res.status(400).json({ error: "Address is required" });
    }

    const societyCode = (code && typeof code === "string" && code.trim())
      ? slugifyCode(code)
      : slugifyCode(name);

    const initialTowers = Array.isArray(towers) ? towers : [];
    const calculatedTotalTowers = Number(totalTowers) || initialTowers.length || 0;

    const [society] = await db
      .insert(residentialSocietiesTable)
      .values({
        name: name.trim(),
        code: societyCode,
        cityId: Number(cityId),
        serviceAreaId: serviceAreaId ? Number(serviceAreaId) : null,
        address: address.trim(),
        pincode: pincode ? String(pincode).trim() : null,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        gateSecurityNotes: gateSecurityNotes ? String(gateSecurityNotes).trim() : null,
        totalTowers: calculatedTotalTowers,
        totalFlats: totalFlats ? Number(totalFlats) : 0,
        companyId: req.user?.companyId ?? null,
        branchId: req.user?.branchId ?? null,
      })
      .returning();

    const createdTowers: SocietyTower[] = [];
    if (initialTowers.length > 0) {
      for (const t of initialTowers) {
        if (t && typeof t.name === "string" && t.name.trim()) {
          const [towerRow] = await db
            .insert(societyTowersTable)
            .values({
              societyId: society.id,
              name: t.name.trim(),
              code: t.code ? slugifyCode(t.code) : slugifyCode(t.name),
              totalFloors: t.totalFloors ? Number(t.totalFloors) : null,
              totalFlats: t.totalFlats ? Number(t.totalFlats) : null,
              parkingLevels: t.parkingLevels ? String(t.parkingLevels).trim() : null,
            })
            .returning();
          if (towerRow) createdTowers.push(towerRow);
        }
      }
    }

    return res.status(201).json({
      ...society,
      towers: createdTowers,
    });
  } catch (err) {
    req.log.error({ err }, "Error creating residential society");
    return res.status(500).json({ error: "Failed to create society" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update Society
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/societies/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid society id" });

    const allowedFields = [
      "name",
      "code",
      "address",
      "pincode",
      "latitude",
      "longitude",
      "gateSecurityNotes",
      "totalTowers",
      "totalFlats",
      "isActive",
      "serviceAreaId",
    ];

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        if (key === "code" && typeof req.body[key] === "string") {
          patch[key] = slugifyCode(req.body[key]);
        } else {
          patch[key] = req.body[key];
        }
      }
    }

    const [updated] = await db
      .update(residentialSocietiesTable)
      .set(patch)
      .where(eq(residentialSocietiesTable.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Society not found" });

    return res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating residential society");
    return res.status(500).json({ error: "Failed to update society" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. List Towers for Society
// ─────────────────────────────────────────────────────────────────────────────
router.get("/societies/:id/towers", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid society id" });

    const towers = await db
      .select()
      .from(societyTowersTable)
      .where(and(eq(societyTowersTable.societyId, id), eq(societyTowersTable.isActive, true)))
      .orderBy(asc(societyTowersTable.name));

    return res.json(towers);
  } catch (err) {
    req.log.error({ err }, "Error fetching society towers");
    return res.status(500).json({ error: "Failed to fetch towers" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Add Tower to Society
// ─────────────────────────────────────────────────────────────────────────────
router.post("/societies/:id/towers", requireAuth, async (req, res) => {
  try {
    const societyId = parseInt(req.params.id, 10);
    if (Number.isNaN(societyId)) return res.status(400).json({ error: "Invalid society id" });

    const [society] = await db
      .select()
      .from(residentialSocietiesTable)
      .where(eq(residentialSocietiesTable.id, societyId))
      .limit(1);

    if (!society) return res.status(404).json({ error: "Society not found" });

    const { name, code, totalFloors, totalFlats, parkingLevels } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Tower name is required" });
    }

    const towerCode = (code && typeof code === "string" && code.trim())
      ? slugifyCode(code)
      : slugifyCode(name);

    const [tower] = await db
      .insert(societyTowersTable)
      .values({
        societyId,
        name: name.trim(),
        code: towerCode,
        totalFloors: totalFloors ? Number(totalFloors) : null,
        totalFlats: totalFlats ? Number(totalFlats) : null,
        parkingLevels: parkingLevels ? String(parkingLevels).trim() : null,
      })
      .returning();

    // Increment totalTowers counter
    await db
      .update(residentialSocietiesTable)
      .set({
        totalTowers: sql`${residentialSocietiesTable.totalTowers} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(residentialSocietiesTable.id, societyId));

    return res.status(201).json(tower);
  } catch (err) {
    req.log.error({ err }, "Error creating society tower");
    return res.status(500).json({ error: "Failed to create tower" });
  }
});

export default router;
