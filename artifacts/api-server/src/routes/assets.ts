import { Router } from "express";
import { db } from "@workspace/db";
import { assetsTable, vehiclesTable, solarSitesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { isAssetsModuleEnabled } from "../lib/assets/featureFlag";
import {
  createVehicleAsset,
  createSolarAsset,
  getAssetDetail,
  listAssetsForQuery,
  transferAssetLocation,
  transferCustomerOwnership,
  parseDateField,
} from "../lib/assets/assetService";

const router = Router();

function featureDisabled(_req: import("express").Request, res: import("express").Response) {
  return res.status(503).json({ error: "Assets module is disabled" });
}

router.use((req, res, next) => {
  if (!isAssetsModuleEnabled()) return featureDisabled(req, res);
  next();
});

router.get("/assets", async (req, res) => {
  try {
    const { customerId, assetType, serviceLocationId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit, 10) || 50, 100);
    const off = parseInt(offset, 10) || 0;

    const result = await listAssetsForQuery({
      customerId: customerId ? parseInt(customerId, 10) : undefined,
      assetType,
      serviceLocationId: serviceLocationId ? parseInt(serviceLocationId, 10) : undefined,
      limit: lim,
      offset: off,
    });

    const scoped = result.data.filter((row: { companyId?: number | null; branchId?: number | null; franchiseeId?: number | null }) =>
      rowInScope(req, row),
    );

    return res.json({ data: scoped, total: result.total, limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List assets error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/assets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const detail = await getAssetDetail(id);
    if (!detail || !rowInScope(req, detail)) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json(detail);
  } catch (err) {
    req.log.error({ err }, "Get asset error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assets", async (req, res) => {
  try {
    const { assetType } = req.body;
    if (assetType === "vehicle") {
      const {
        customerId, serviceLocationId, registrationNumber, vehicleType, vehicleModelId,
        make, model, year, color, notes, effectiveFrom,
      } = req.body;
      if (!customerId || !serviceLocationId || !registrationNumber) {
        return res.status(400).json({ error: "customerId, serviceLocationId, registrationNumber are required" });
      }
      const customer = await loadIfInScope(req, async () => {
        const { customersTable } = await import("@workspace/db");
        const [row] = await db.select().from(customersTable).where(eq(customersTable.id, parseInt(String(customerId), 10))).limit(1);
        return row;
      }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const effFrom = parseDateField(effectiveFrom);
      if (effectiveFrom !== undefined && effFrom === null) {
        return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
      }

      try {
        const result = await createVehicleAsset(req, {
          customerId: parseInt(String(customerId), 10),
          serviceLocationId: parseInt(String(serviceLocationId), 10),
          registrationNumber: String(registrationNumber),
          vehicleType,
          vehicleModelId,
          make,
          model,
          year,
          color,
          notes,
          effectiveFrom: effFrom ?? undefined,
        });
        return res.status(201).json(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Create failed";
        if (msg.includes("already exists")) return res.status(409).json({ error: msg });
        if (msg.includes("location") || msg.includes("vehicleModelId") || msg.includes("make")) {
          return res.status(400).json({ error: msg });
        }
        throw e;
      }
    }

    if (assetType === "solar_site") {
      const {
        customerId, serviceLocationId, siteName, panelCapacityKw, panelCount,
        address, city, notes, effectiveFrom,
      } = req.body;
      if (!customerId || !serviceLocationId || !siteName || panelCapacityKw == null) {
        return res.status(400).json({ error: "customerId, serviceLocationId, siteName, panelCapacityKw are required" });
      }
      const customer = await loadIfInScope(req, async () => {
        const { customersTable } = await import("@workspace/db");
        const [row] = await db.select().from(customersTable).where(eq(customersTable.id, parseInt(String(customerId), 10))).limit(1);
        return row;
      }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
      if (!customer) return res.status(404).json({ error: "Customer not found" });

      const effFrom = parseDateField(effectiveFrom);
      if (effectiveFrom !== undefined && effFrom === null) {
        return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
      }

      try {
        const result = await createSolarAsset(req, {
          customerId: parseInt(String(customerId), 10),
          serviceLocationId: parseInt(String(serviceLocationId), 10),
          siteName: String(siteName),
          panelCapacityKw,
          panelCount,
          address,
          city,
          notes,
          effectiveFrom: effFrom ?? undefined,
        });
        return res.status(201).json(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Create failed";
        if (msg.includes("location")) return res.status(400).json({ error: msg });
        throw e;
      }
    }

    return res.status(400).json({ error: "assetType must be vehicle or solar_site" });
  } catch (err) {
    req.log.error({ err }, "Create asset error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/assets/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const { label, notes, status } = req.body;
    const assetUpdate: Record<string, unknown> = { updatedAt: new Date() };
    if (label !== undefined) assetUpdate.label = String(label).trim();
    if (notes !== undefined) assetUpdate.notes = notes;
    if (status !== undefined) assetUpdate.status = status;

    const [asset] = await db.update(assetsTable).set(assetUpdate).where(eq(assetsTable.id, id)).returning();

    if (existing.vehicleId) {
      const vUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.registrationNumber !== undefined) {
        const { normalizeRegistration } = await import("../lib/dcms/registration");
        vUpdate.registrationNumber = req.body.registrationNumber;
        vUpdate.registrationNormalized = normalizeRegistration(req.body.registrationNumber);
      }
      if (req.body.vehicleType !== undefined) vUpdate.vehicleType = req.body.vehicleType;
      if (req.body.make !== undefined) vUpdate.make = req.body.make;
      if (req.body.model !== undefined) vUpdate.model = req.body.model;
      if (req.body.year !== undefined) vUpdate.year = req.body.year;
      if (req.body.color !== undefined) vUpdate.color = req.body.color;
      if (req.body.assignedStaffId !== undefined) vUpdate.assignedStaffId = req.body.assignedStaffId;
      if (Object.keys(vUpdate).length > 1) {
        await db.update(vehiclesTable).set(vUpdate).where(eq(vehiclesTable.id, existing.vehicleId));
      }
    }

    if (existing.solarSiteId) {
      const sUpdate: Record<string, unknown> = { updatedAt: new Date() };
      if (req.body.siteName !== undefined) sUpdate.siteName = req.body.siteName;
      if (req.body.panelCount !== undefined) sUpdate.panelCount = req.body.panelCount;
      if (req.body.panelCapacityKw !== undefined) sUpdate.panelCapacityKw = String(req.body.panelCapacityKw);
      if (req.body.address !== undefined) sUpdate.address = req.body.address;
      if (req.body.city !== undefined) sUpdate.city = req.body.city;
      if (Object.keys(sUpdate).length > 1) {
        await db.update(solarSitesTable).set(sUpdate).where(eq(solarSitesTable.id, existing.solarSiteId));
      }
    }

    const detail = await getAssetDetail(id);
    return res.json(detail ?? asset);
  } catch (err) {
    req.log.error({ err }, "Update asset error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/assets/:id/location-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const detail = await getAssetDetail(id);
    if (!detail || !rowInScope(req, detail)) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json({ data: detail.locationLinks });
  } catch (err) {
    req.log.error({ err }, "List location links error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assets/:id/location-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { serviceLocationId, customerId, effectiveFrom } = req.body;
    if (!serviceLocationId || !customerId) {
      return res.status(400).json({ error: "serviceLocationId and customerId are required" });
    }
    const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Asset not found" });
    }
    const effFrom = parseDateField(effectiveFrom);
    if (effectiveFrom !== undefined && effFrom === null) {
      return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
    }
    await transferAssetLocation(req, id, parseInt(String(serviceLocationId), 10), parseInt(String(customerId), 10), {
      effectiveFrom: effFrom ?? undefined,
    });
    const detail = await getAssetDetail(id);
    return res.status(201).json({ data: detail?.locationLinks ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Transfer failed";
    if (msg.includes("location")) return res.status(400).json({ error: msg });
    req.log.error({ err }, "Create location link error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/assets/:id/customer-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const detail = await getAssetDetail(id);
    if (!detail || !rowInScope(req, detail)) {
      return res.status(404).json({ error: "Asset not found" });
    }
    return res.json({ data: detail.customerLinks });
  } catch (err) {
    req.log.error({ err }, "List customer links error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/assets/:id/customer-links", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { customerId, linkType, effectiveFrom } = req.body;
    if (!customerId) return res.status(400).json({ error: "customerId is required" });

    const [existing] = await db.select().from(assetsTable).where(eq(assetsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Asset not found" });
    }

    const customer = await loadIfInScope(req, async () => {
      const { customersTable } = await import("@workspace/db");
      const [row] = await db.select().from(customersTable).where(eq(customersTable.id, parseInt(String(customerId), 10))).limit(1);
      return row;
    }, r => ({ companyId: r.companyId, branchId: r.branchId, franchiseeId: r.franchiseeId, customerId: r.id }));
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const effFrom = parseDateField(effectiveFrom);
    if (effectiveFrom !== undefined && effFrom === null) {
      return res.status(400).json({ error: "effectiveFrom must be YYYY-MM-DD" });
    }

    const allowedTypes = ["operational", "commercial", "historical"];
    const lt = linkType && allowedTypes.includes(linkType) ? linkType : "commercial";

    if (lt === "historical") {
      const { customerAssetLinksTable } = await import("@workspace/db");
      await db.insert(customerAssetLinksTable).values({
        assetId: id,
        customerId: customer.id,
        linkType: "historical",
        effectiveFrom: effFrom ?? new Date().toISOString().split("T")[0],
        updatedAt: new Date(),
      });
    } else {
      await transferCustomerOwnership(req, id, customer.id, {
        effectiveFrom: effFrom ?? undefined,
        linkType: lt,
      });
    }

    const detail = await getAssetDetail(id);
    return res.status(201).json({ data: detail?.customerLinks ?? [] });
  } catch (err) {
    req.log.error({ err }, "Create customer link error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
