import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { solarSitesTable, customersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: solarSitesTable.companyId,
  branchCol: solarSitesTable.branchId,
  franchiseeCol: solarSitesTable.franchiseeId,
  customerCol: solarSitesTable.customerId,
};

async function callerCustomerIds(req: Request): Promise<number[] | null> {
  const s = req.scope;
  if (!s) return [];
  if (s.isSuperAdmin && !s.companyId) return null;
  const ids = await db.select({ id: customersTable.id }).from(customersTable)
    .where(and(...tenantFilters(req, {
      companyCol: customersTable.companyId,
      branchCol: customersTable.branchId,
      franchiseeCol: customersTable.franchiseeId,
      customerCol: customersTable.id,
    })));
  return ids.map(r => r.id);
}

router.get("/solar-sites", async (req, res) => {
  try {
    const { customerId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(solarSitesTable.customerId, parseInt(customerId)));
    const data = await db.select().from(solarSitesTable).where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List solar sites error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const SOLAR_SITE_FIELDS = [
  "address", "city", "panelCount", "panelCapacityKw",
  "installationDate", "lastCleanedDate", "nextServiceDate",
  "serviceLat", "serviceLng", "placeId", "locationLabel",
] as const;

router.post("/solar-sites", async (req, res) => {
  try {
    const { customerId, address, panelCount, serviceLat, serviceLng } = req.body;
    if (!customerId || !address || panelCount == null) {
      return res.status(400).json({ error: "customerId, address, panelCount are required" });
    }
    if (serviceLat == null || serviceLng == null) {
      return res.status(400).json({ error: "serviceLat and serviceLng are required for solar site location" });
    }
    const allowed = await callerCustomerIds(req);
    if (allowed !== null && !allowed.includes(customerId)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const base: Record<string, unknown> = {
      customerId,
      locationComplete: true,
    };
    for (const k of SOLAR_SITE_FIELDS) {
      if (req.body[k] !== undefined) base[k] = req.body[k];
    }
    const values = tenantStamp(req, base) as typeof solarSitesTable.$inferInsert;
    const [site] = await db.insert(solarSitesTable).values(values).returning();
    return res.status(201).json(site);
  } catch (err) {
    req.log.error({ err }, "Create solar site error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/solar-sites/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(solarSitesTable).where(eq(solarSitesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Solar site not found" });
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of SOLAR_SITE_FIELDS) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }
    if (req.body.serviceLat !== undefined || req.body.serviceLng !== undefined || req.body.address !== undefined) {
      const lat = req.body.serviceLat ?? existing.serviceLat;
      const lng = req.body.serviceLng ?? existing.serviceLng;
      const addr = req.body.address ?? existing.address;
      updateData.locationComplete = !!(addr && lat != null && lng != null);
    }
    const [site] = await db.update(solarSitesTable).set(updateData).where(eq(solarSitesTable.id, id)).returning();
    return res.json(site);
  } catch (err) {
    req.log.error({ err }, "Update solar site error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/solar-sites/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(solarSitesTable).where(eq(solarSitesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Solar site not found" });
    }
    await db.delete(solarSitesTable).where(eq(solarSitesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete solar site error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
