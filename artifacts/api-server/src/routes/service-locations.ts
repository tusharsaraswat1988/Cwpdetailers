import { Router } from "express";
import { db } from "@workspace/db";
import {
  serviceLocationsTable,
  customerLocationLinksTable,
  customersTable,
  residentialSocietiesTable,
  societyTowersTable,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc, inArray } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { isServiceLocationsEnabled } from "../lib/serviceLocations/featureFlag";

const router = Router();

const LOCATION_SCOPE_COLS = {
  companyCol: serviceLocationsTable.companyId,
  branchCol: serviceLocationsTable.branchId,
  franchiseeCol: serviceLocationsTable.franchiseeId,
};

const LOCATION_TYPES = ["office", "factory", "residence", "parking", "other"] as const;
const LOCATION_STATUSES = ["active", "inactive"] as const;

function featureDisabled(_req: import("express").Request, res: import("express").Response) {
  return res.status(503).json({ error: "Service Locations module is disabled" });
}

function parseDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const s = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

router.use((req, res, next) => {
  if (!isServiceLocationsEnabled()) return featureDisabled(req, res);
  next();
});

router.get("/service-locations", async (req, res) => {
  try {
    const { search, customerId, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const off = parseInt(offset, 10) || 0;

    if (customerId) {
      const cid = parseInt(customerId, 10);
      const customer = await loadIfInScope(req, async () => {
        const [row] = await db.select().from(customersTable).where(eq(customersTable.id, cid)).limit(1);
        return row;
      }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const conditions = [
        eq(customerLocationLinksTable.customerId, cid),
        ...tenantFilters(req, LOCATION_SCOPE_COLS),
      ];
      if (status && LOCATION_STATUSES.includes(status as typeof LOCATION_STATUSES[number])) {
        conditions.push(eq(serviceLocationsTable.status, status as typeof LOCATION_STATUSES[number]));
      }
      if (search) {
        conditions.push(or(
          ilike(serviceLocationsTable.label, `%${search}%`),
          ilike(serviceLocationsTable.address, `%${search}%`),
          ilike(serviceLocationsTable.city, `%${search}%`),
        )!);
      }

      const rows = await db
        .select({
          id: serviceLocationsTable.id,
          label: serviceLocationsTable.label,
          address: serviceLocationsTable.address,
          city: serviceLocationsTable.city,
          cityId: serviceLocationsTable.cityId,
          societyId: serviceLocationsTable.societyId,
          societyName: residentialSocietiesTable.name,
          towerId: serviceLocationsTable.towerId,
          towerName: societyTowersTable.name,
          flatNumber: serviceLocationsTable.flatNumber,
          parkingLevel: serviceLocationsTable.parkingLevel,
          parkingBay: serviceLocationsTable.parkingBay,
          parkingNotes: serviceLocationsTable.parkingNotes,
          latitude: serviceLocationsTable.latitude,
          longitude: serviceLocationsTable.longitude,
          placeId: serviceLocationsTable.placeId,
          locationType: serviceLocationsTable.locationType,
          status: serviceLocationsTable.status,
          isAutoCreated: serviceLocationsTable.isAutoCreated,
          companyId: serviceLocationsTable.companyId,
          franchiseeId: serviceLocationsTable.franchiseeId,
          branchId: serviceLocationsTable.branchId,
          createdAt: serviceLocationsTable.createdAt,
          updatedAt: serviceLocationsTable.updatedAt,
          linkId: customerLocationLinksTable.id,
          isDefault: customerLocationLinksTable.isDefault,
          effectiveFrom: customerLocationLinksTable.effectiveFrom,
          effectiveUntil: customerLocationLinksTable.effectiveUntil,
        })
        .from(customerLocationLinksTable)
        .innerJoin(serviceLocationsTable, eq(customerLocationLinksTable.serviceLocationId, serviceLocationsTable.id))
        .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
        .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
        .where(and(...conditions))
        .orderBy(desc(customerLocationLinksTable.isDefault), desc(serviceLocationsTable.updatedAt))
        .limit(lim)
        .offset(off);

      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(customerLocationLinksTable)
        .innerJoin(serviceLocationsTable, eq(customerLocationLinksTable.serviceLocationId, serviceLocationsTable.id))
        .where(and(...conditions));

      return res.json({
        data: rows.map(row => ({
          ...row,
          primaryCustomerName: customer.name,
          linkedCustomerCount: 1,
        })),
        total: Number(countRow?.count ?? 0),
        limit: lim,
        offset: off,
        customerId: cid,
      });
    }

    const conditions = [...tenantFilters(req, LOCATION_SCOPE_COLS)];
    if (status && LOCATION_STATUSES.includes(status as typeof LOCATION_STATUSES[number])) {
      conditions.push(eq(serviceLocationsTable.status, status as typeof LOCATION_STATUSES[number]));
    }
    if (search) {
      conditions.push(or(
        ilike(serviceLocationsTable.label, `%${search}%`),
        ilike(serviceLocationsTable.address, `%${search}%`),
        ilike(serviceLocationsTable.city, `%${search}%`),
      )!);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(serviceLocationsTable).where(where).orderBy(desc(serviceLocationsTable.updatedAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(serviceLocationsTable).where(where),
    ]);

    const ids = data.map(r => r.id);
    const linkCounts = ids.length
      ? await db
        .select({
          serviceLocationId: customerLocationLinksTable.serviceLocationId,
          count: sql<number>`count(*)`,
        })
        .from(customerLocationLinksTable)
        .where(inArray(customerLocationLinksTable.serviceLocationId, ids))
        .groupBy(customerLocationLinksTable.serviceLocationId)
      : [];
    const countMap = new Map(linkCounts.map(r => [r.serviceLocationId, Number(r.count)]));

    const primaryCustomers = ids.length
      ? await db
        .select({
          serviceLocationId: customerLocationLinksTable.serviceLocationId,
          customerName: customersTable.name,
        })
        .from(customerLocationLinksTable)
        .innerJoin(customersTable, eq(customerLocationLinksTable.customerId, customersTable.id))
        .where(inArray(customerLocationLinksTable.serviceLocationId, ids))
        .orderBy(desc(customerLocationLinksTable.isDefault), desc(customerLocationLinksTable.id))
      : [];
    const primaryNameMap = new Map<number, string>();
    for (const row of primaryCustomers) {
      if (!primaryNameMap.has(row.serviceLocationId)) {
        primaryNameMap.set(row.serviceLocationId, row.customerName);
      }
    }

    return res.json({
      data: data.map(row => ({
        ...row,
        linkedCustomerCount: countMap.get(row.id) ?? 0,
        primaryCustomerName: primaryNameMap.get(row.id) ?? null,
      })),
      total: Number(countResult[0]?.count ?? 0),
      limit: lim,
      offset: off,
    });
  } catch (err) {
    req.log.error({ err }, "List service locations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-locations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [location] = await db
      .select({
        id: serviceLocationsTable.id,
        label: serviceLocationsTable.label,
        address: serviceLocationsTable.address,
        city: serviceLocationsTable.city,
        cityId: serviceLocationsTable.cityId,
        societyId: serviceLocationsTable.societyId,
        societyName: residentialSocietiesTable.name,
        towerId: serviceLocationsTable.towerId,
        towerName: societyTowersTable.name,
        flatNumber: serviceLocationsTable.flatNumber,
        parkingLevel: serviceLocationsTable.parkingLevel,
        parkingBay: serviceLocationsTable.parkingBay,
        parkingNotes: serviceLocationsTable.parkingNotes,
        latitude: serviceLocationsTable.latitude,
        longitude: serviceLocationsTable.longitude,
        placeId: serviceLocationsTable.placeId,
        locationType: serviceLocationsTable.locationType,
        status: serviceLocationsTable.status,
        isAutoCreated: serviceLocationsTable.isAutoCreated,
        companyId: serviceLocationsTable.companyId,
        franchiseeId: serviceLocationsTable.franchiseeId,
        branchId: serviceLocationsTable.branchId,
        createdAt: serviceLocationsTable.createdAt,
        updatedAt: serviceLocationsTable.updatedAt,
      })
      .from(serviceLocationsTable)
      .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
      .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
      .where(eq(serviceLocationsTable.id, id))
      .limit(1);
    if (!location || !rowInScope(req, location)) {
      return res.status(404).json({ error: "Service location not found" });
    }

    const links = await db
      .select({
        id: customerLocationLinksTable.id,
        customerId: customerLocationLinksTable.customerId,
        isDefault: customerLocationLinksTable.isDefault,
        effectiveFrom: customerLocationLinksTable.effectiveFrom,
        effectiveUntil: customerLocationLinksTable.effectiveUntil,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
      })
      .from(customerLocationLinksTable)
      .innerJoin(customersTable, eq(customerLocationLinksTable.customerId, customersTable.id))
      .where(eq(customerLocationLinksTable.serviceLocationId, id));

    const scopedLinks = [];
    for (const link of links) {
      const [customer] = await db.select({
        companyId: customersTable.companyId,
        branchId: customersTable.branchId,
        franchiseeId: customersTable.franchiseeId,
        id: customersTable.id,
      }).from(customersTable).where(eq(customersTable.id, link.customerId)).limit(1);
      if (customer && rowInScope(req, { ...customer, customerId: customer.id })) {
        scopedLinks.push(link);
      }
    }

    return res.json({ ...location, customerLinks: scopedLinks });
  } catch (err) {
    req.log.error({ err }, "Get service location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const LOCATION_WRITABLE_FIELDS = [
  "label", "address", "city", "cityId", "latitude", "longitude", "placeId", "locationType", "status",
  "societyId", "towerId", "flatNumber", "parkingLevel", "parkingBay", "parkingNotes",
] as const;

router.post("/service-locations", async (req, res) => {
  try {
    const {
      label, address, city, cityId, latitude, longitude, placeId, locationType, status,
      customerId, isDefault, effectiveFrom, effectiveUntil,
      societyId, towerId, flatNumber, parkingLevel, parkingBay, parkingNotes,
    } = req.body;
    if (!label || !String(label).trim()) {
      return res.status(400).json({ error: "label is required" });
    }
    if (locationType && !LOCATION_TYPES.includes(locationType)) {
      return res.status(400).json({ error: "Invalid locationType" });
    }
    if (status && !LOCATION_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    if (societyId) {
      const [soc] = await db
        .select({ id: residentialSocietiesTable.id, name: residentialSocietiesTable.name, isActive: residentialSocietiesTable.isActive })
        .from(residentialSocietiesTable)
        .where(eq(residentialSocietiesTable.id, Number(societyId)))
        .limit(1);
      if (!soc || !soc.isActive) {
        return res.status(422).json({
          error: "SOCIETY_NOT_SERVICEABLE",
          message: `We do not currently service ${soc?.name ?? "this society"}. Join the waitlist for your society.`,
        });
      }
      if (towerId) {
        const [tower] = await db
          .select({ id: societyTowersTable.id, societyId: societyTowersTable.societyId, isActive: societyTowersTable.isActive })
          .from(societyTowersTable)
          .where(eq(societyTowersTable.id, Number(towerId)))
          .limit(1);
        if (!tower || tower.societyId !== Number(societyId) || !tower.isActive) {
          return res.status(400).json({ error: "Invalid tower for the selected society" });
        }
      }
    }

    const base = tenantStamp(req, {
      label: String(label).trim(),
      address: address ?? null,
      city: city ?? null,
      cityId: cityId ? Number(cityId) : null,
      societyId: societyId ? Number(societyId) : null,
      towerId: towerId ? Number(towerId) : null,
      flatNumber: flatNumber ? String(flatNumber).trim() : null,
      parkingLevel: parkingLevel ? String(parkingLevel).trim() : null,
      parkingBay: parkingBay ? String(parkingBay).trim() : null,
      parkingNotes: parkingNotes ? String(parkingNotes).trim() : null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      placeId: placeId ?? null,
      locationType: locationType ?? "other",
      status: status ?? "active",
      isAutoCreated: false,
      updatedAt: new Date(),
    }) as typeof serviceLocationsTable.$inferInsert;

    const [location] = await db.insert(serviceLocationsTable).values(base).returning();

    if (customerId) {
      const customer = await loadIfInScope(req, async () => {
        const [row] = await db.select().from(customersTable).where(eq(customersTable.id, parseInt(String(customerId), 10))).limit(1);
        return row;
      }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const makeDefault = Boolean(isDefault);
      if (makeDefault) {
        await db.update(customerLocationLinksTable)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(eq(customerLocationLinksTable.customerId, customer.id));
      }

      const effFrom = parseDate(effectiveFrom);
      if (effectiveFrom !== undefined && effFrom === null) {
        return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
      }
      const effUntil = parseDate(effectiveUntil);
      if (effectiveUntil !== undefined && effUntil === null) {
        return res.status(400).json({ error: "effectiveUntil must be YYYY-MM-DD" });
      }

      await db.insert(customerLocationLinksTable).values({
        customerId: customer.id,
        serviceLocationId: location.id,
        isDefault: makeDefault,
        effectiveFrom: effFrom ?? new Date().toISOString().split("T")[0],
        effectiveUntil: effUntil ?? null,
        updatedAt: new Date(),
      });
    }

    return res.status(201).json(location);
  } catch (err) {
    req.log.error({ err }, "Create service location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/service-locations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(serviceLocationsTable).where(eq(serviceLocationsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Service location not found" });
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of LOCATION_WRITABLE_FIELDS) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (req.body.locationType !== undefined && !LOCATION_TYPES.includes(req.body.locationType)) {
      return res.status(400).json({ error: "Invalid locationType" });
    }
    if (req.body.status !== undefined && !LOCATION_STATUSES.includes(req.body.status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const checkSocietyId = req.body.societyId !== undefined ? (req.body.societyId ? Number(req.body.societyId) : null) : existing.societyId;
    const checkTowerId = req.body.towerId !== undefined ? (req.body.towerId ? Number(req.body.towerId) : null) : existing.towerId;

    if (checkSocietyId && req.body.societyId !== undefined) {
      const [soc] = await db
        .select({ id: residentialSocietiesTable.id, name: residentialSocietiesTable.name, isActive: residentialSocietiesTable.isActive })
        .from(residentialSocietiesTable)
        .where(eq(residentialSocietiesTable.id, checkSocietyId))
        .limit(1);
      if (!soc || !soc.isActive) {
        return res.status(422).json({
          error: "SOCIETY_NOT_SERVICEABLE",
          message: `We do not currently service ${soc?.name ?? "this society"}. Join the waitlist for your society.`,
        });
      }
    }

    if (checkTowerId && (req.body.towerId !== undefined || req.body.societyId !== undefined)) {
      const [tower] = await db
        .select({ id: societyTowersTable.id, societyId: societyTowersTable.societyId, isActive: societyTowersTable.isActive })
        .from(societyTowersTable)
        .where(eq(societyTowersTable.id, checkTowerId))
        .limit(1);
      if (!tower || (checkSocietyId && tower.societyId !== checkSocietyId) || !tower.isActive) {
        return res.status(400).json({ error: "Invalid tower for the selected society" });
      }
    }

    const [location] = await db.update(serviceLocationsTable).set(updateData).where(eq(serviceLocationsTable.id, id)).returning();
    return res.json(location);
  } catch (err) {
    req.log.error({ err }, "Update service location error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-locations/:id/customer-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [location] = await db
      .select({
        id: serviceLocationsTable.id,
        label: serviceLocationsTable.label,
        address: serviceLocationsTable.address,
        city: serviceLocationsTable.city,
        cityId: serviceLocationsTable.cityId,
        societyId: serviceLocationsTable.societyId,
        societyName: residentialSocietiesTable.name,
        towerId: serviceLocationsTable.towerId,
        towerName: societyTowersTable.name,
        flatNumber: serviceLocationsTable.flatNumber,
        parkingLevel: serviceLocationsTable.parkingLevel,
        parkingBay: serviceLocationsTable.parkingBay,
        parkingNotes: serviceLocationsTable.parkingNotes,
        latitude: serviceLocationsTable.latitude,
        longitude: serviceLocationsTable.longitude,
        placeId: serviceLocationsTable.placeId,
        locationType: serviceLocationsTable.locationType,
        status: serviceLocationsTable.status,
        isAutoCreated: serviceLocationsTable.isAutoCreated,
        companyId: serviceLocationsTable.companyId,
        franchiseeId: serviceLocationsTable.franchiseeId,
        branchId: serviceLocationsTable.branchId,
        createdAt: serviceLocationsTable.createdAt,
        updatedAt: serviceLocationsTable.updatedAt,
      })
      .from(serviceLocationsTable)
      .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
      .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
      .where(eq(serviceLocationsTable.id, id))
      .limit(1);
    if (!location || !rowInScope(req, location)) {
      return res.status(404).json({ error: "Service location not found" });
    }

    const links = await db
      .select({
        id: customerLocationLinksTable.id,
        customerId: customerLocationLinksTable.customerId,
        isDefault: customerLocationLinksTable.isDefault,
        effectiveFrom: customerLocationLinksTable.effectiveFrom,
        effectiveUntil: customerLocationLinksTable.effectiveUntil,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
      })
      .from(customerLocationLinksTable)
      .innerJoin(customersTable, eq(customerLocationLinksTable.customerId, customersTable.id))
      .where(eq(customerLocationLinksTable.serviceLocationId, id));

    const scopedLinks = [];
    for (const link of links) {
      const [customer] = await db.select({
        companyId: customersTable.companyId,
        branchId: customersTable.branchId,
        franchiseeId: customersTable.franchiseeId,
        id: customersTable.id,
      }).from(customersTable).where(eq(customersTable.id, link.customerId)).limit(1);
      if (customer && rowInScope(req, { ...customer, customerId: customer.id })) {
        scopedLinks.push(link);
      }
    }

    return res.json({ data: scopedLinks });
  } catch (err) {
    req.log.error({ err }, "List customer links error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/service-locations/:id/customer-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { customerId, isDefault, effectiveFrom, effectiveUntil } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId is required" });

    const [location] = await db
      .select({
        id: serviceLocationsTable.id,
        label: serviceLocationsTable.label,
        address: serviceLocationsTable.address,
        city: serviceLocationsTable.city,
        cityId: serviceLocationsTable.cityId,
        societyId: serviceLocationsTable.societyId,
        societyName: residentialSocietiesTable.name,
        towerId: serviceLocationsTable.towerId,
        towerName: societyTowersTable.name,
        flatNumber: serviceLocationsTable.flatNumber,
        parkingLevel: serviceLocationsTable.parkingLevel,
        parkingBay: serviceLocationsTable.parkingBay,
        parkingNotes: serviceLocationsTable.parkingNotes,
        latitude: serviceLocationsTable.latitude,
        longitude: serviceLocationsTable.longitude,
        placeId: serviceLocationsTable.placeId,
        locationType: serviceLocationsTable.locationType,
        status: serviceLocationsTable.status,
        isAutoCreated: serviceLocationsTable.isAutoCreated,
        companyId: serviceLocationsTable.companyId,
        franchiseeId: serviceLocationsTable.franchiseeId,
        branchId: serviceLocationsTable.branchId,
        createdAt: serviceLocationsTable.createdAt,
        updatedAt: serviceLocationsTable.updatedAt,
      })
      .from(serviceLocationsTable)
      .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
      .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
      .where(eq(serviceLocationsTable.id, id))
      .limit(1);
    if (!location || !rowInScope(req, location)) {
      return res.status(404).json({ error: "Service location not found" });
    }

    const customer = await loadIfInScope(req, async () => {
      const [row] = await db.select().from(customersTable).where(eq(customersTable.id, parseInt(String(customerId), 10))).limit(1);
      return row;
    }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const [existingLink] = await db.select().from(customerLocationLinksTable)
      .where(and(
        eq(customerLocationLinksTable.customerId, customer.id),
        eq(customerLocationLinksTable.serviceLocationId, id),
      ))
      .limit(1);
    if (existingLink) return res.status(409).json({ error: "Customer is already linked to this location" });

    const makeDefault = Boolean(isDefault);
    if (makeDefault) {
      await db.update(customerLocationLinksTable)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(customerLocationLinksTable.customerId, customer.id));
    }

    const effFrom = parseDate(effectiveFrom);
    if (effectiveFrom !== undefined && effFrom === null) {
      return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
    }
    const effUntil = parseDate(effectiveUntil);
    if (effectiveUntil !== undefined && effUntil === null) {
      return res.status(400).json({ error: "effectiveUntil must be YYYY-MM-DD" });
    }

    const [link] = await db.insert(customerLocationLinksTable).values({
      customerId: customer.id,
      serviceLocationId: id,
      isDefault: makeDefault,
      effectiveFrom: effFrom ?? new Date().toISOString().split("T")[0],
      effectiveUntil: effUntil ?? null,
      updatedAt: new Date(),
    }).returning();

    return res.status(201).json(link);
  } catch (err) {
    req.log.error({ err }, "Create customer link error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/service-locations/:id/customer-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const customerId = parseInt(String(req.query.customerId ?? req.body?.customerId), 10);
    if (!customerId) return res.status(400).json({ error: "customerId is required" });

    const [location] = await db
      .select({
        id: serviceLocationsTable.id,
        label: serviceLocationsTable.label,
        address: serviceLocationsTable.address,
        city: serviceLocationsTable.city,
        cityId: serviceLocationsTable.cityId,
        societyId: serviceLocationsTable.societyId,
        societyName: residentialSocietiesTable.name,
        towerId: serviceLocationsTable.towerId,
        towerName: societyTowersTable.name,
        flatNumber: serviceLocationsTable.flatNumber,
        parkingLevel: serviceLocationsTable.parkingLevel,
        parkingBay: serviceLocationsTable.parkingBay,
        parkingNotes: serviceLocationsTable.parkingNotes,
        latitude: serviceLocationsTable.latitude,
        longitude: serviceLocationsTable.longitude,
        placeId: serviceLocationsTable.placeId,
        locationType: serviceLocationsTable.locationType,
        status: serviceLocationsTable.status,
        isAutoCreated: serviceLocationsTable.isAutoCreated,
        companyId: serviceLocationsTable.companyId,
        franchiseeId: serviceLocationsTable.franchiseeId,
        branchId: serviceLocationsTable.branchId,
        createdAt: serviceLocationsTable.createdAt,
        updatedAt: serviceLocationsTable.updatedAt,
      })
      .from(serviceLocationsTable)
      .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
      .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
      .where(eq(serviceLocationsTable.id, id))
      .limit(1);
    if (!location || !rowInScope(req, location)) {
      return res.status(404).json({ error: "Service location not found" });
    }

    const customer = await loadIfInScope(req, async () => {
      const [row] = await db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1);
      return row;
    }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const [link] = await db.select().from(customerLocationLinksTable)
      .where(and(
        eq(customerLocationLinksTable.serviceLocationId, id),
        eq(customerLocationLinksTable.customerId, customerId),
      ))
      .limit(1);
    if (!link) return res.status(404).json({ error: "Link not found" });

    await db.delete(customerLocationLinksTable).where(eq(customerLocationLinksTable.id, link.id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete customer link error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
