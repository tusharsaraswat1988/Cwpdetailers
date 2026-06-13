import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { vehiclesTable, customersTable, staffTable } from "@workspace/db";
import { eq, and, inArray, sql, ne } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { normalizeRegistration } from "../lib/dcms/registration";

const router = Router();

// Vehicles inherit tenant from their owning customer. We filter via a subquery
// of customer IDs the caller is allowed to see.
async function callerCustomerIds(req: Request): Promise<number[] | null> {
  const s = req.scope;
  if (!s) return [];
  if (s.isSuperAdmin && !s.companyId) return null; // unfiltered
  const ids = await db.select({ id: customersTable.id }).from(customersTable)
    .where(and(...tenantFilters(req, {
      companyCol: customersTable.companyId,
      branchCol: customersTable.branchId,
      franchiseeCol: customersTable.franchiseeId,
      customerCol: customersTable.id,
    })));
  return ids.map(r => r.id);
}

router.get("/vehicles", async (req, res) => {
  try {
    const { customerId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, {
      companyCol: vehiclesTable.companyId,
      branchCol: vehiclesTable.branchId,
      franchiseeCol: vehiclesTable.franchiseeId,
      customerCol: vehiclesTable.customerId,
    })];
    if (customerId) conditions.push(eq(vehiclesTable.customerId, parseInt(customerId)));
    const data = await db.select().from(vehiclesTable).where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List vehicles error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/vehicles", async (req, res) => {
  try {
    const {
      customerId, vehicleModelId, make, model, year, color, registrationNumber, vehicleType,
      serviceAddress, serviceLat, serviceLng, placeId, locationLabel,
    } = req.body;
    if (!customerId || !registrationNumber) {
      return res.status(400).json({ error: "customerId and registrationNumber are required" });
    }
    if (!vehicleModelId && (!make || !model)) {
      return res.status(400).json({ error: "vehicleModelId or make+model are required" });
    }

    let resolvedMake = make;
    let resolvedModel = model;
    let resolvedType = vehicleType;
    let resolvedModelId = vehicleModelId;

    if (vehicleModelId) {
      const { vehicleModelsTable, vehicleBrandsTable, vehicleCategoriesTable } = await import("@workspace/db");
      const [vm] = await db
        .select({
          modelName: vehicleModelsTable.name,
          brandName: vehicleBrandsTable.name,
          categorySlug: vehicleCategoriesTable.slug,
        })
        .from(vehicleModelsTable)
        .innerJoin(vehicleBrandsTable, eq(vehicleModelsTable.brandId, vehicleBrandsTable.id))
        .innerJoin(vehicleCategoriesTable, eq(vehicleModelsTable.vehicleCategoryId, vehicleCategoriesTable.id))
        .where(eq(vehicleModelsTable.id, vehicleModelId))
        .limit(1);
      if (!vm) return res.status(400).json({ error: "Invalid vehicleModelId" });
      resolvedMake = vm.brandName;
      resolvedModel = vm.modelName;
      const typeMap: Record<string, string> = {
        hatchback: "hatchback", sedan: "sedan", suv: "suv", muv: "van", mpv: "van",
        luxury: "luxury", van: "van", pickup: "truck",
      };
      resolvedType = typeMap[vm.categorySlug] ?? "sedan";
    }

    const locationComplete = !!(serviceAddress && serviceLat != null && serviceLng != null);

    const regNorm = normalizeRegistration(registrationNumber);
    const [dup] = await db.select({ id: vehiclesTable.id }).from(vehiclesTable)
      .where(eq(vehiclesTable.registrationNormalized, regNorm)).limit(1);
    if (dup) {
      return res.status(409).json({ error: "Vehicle registration number already exists", registrationNumber: regNorm });
    }

    const allowed = await callerCustomerIds(req);
    if (allowed !== null && !allowed.includes(customerId)) {
      return res.status(404).json({ error: "Customer not found" });
    }
    const values = tenantStamp(req, {
      customerId,
      vehicleModelId: resolvedModelId,
      make: resolvedMake,
      model: resolvedModel,
      year,
      color,
      registrationNumber,
      registrationNormalized: regNorm,
      vehicleType: resolvedType,
      serviceAddress,
      serviceLat,
      serviceLng,
      placeId,
      locationLabel,
      locationComplete,
    });
    const [vehicle] = await db.insert(vehiclesTable).values(values as typeof vehiclesTable.$inferInsert).returning();
    return res.status(201).json(vehicle);
  } catch (err) {
    req.log.error({ err }, "Create vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vehicles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    const { make, model, year, color, registrationNumber, vehicleType, customerId, assignedStaffId,
      vehicleModelId, serviceAddress, serviceLat, serviceLng, placeId, locationLabel } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (make !== undefined) updateData.make = make;
    if (model !== undefined) updateData.model = model;
    if (year !== undefined) updateData.year = year;
    if (color !== undefined) updateData.color = color;
    if (registrationNumber !== undefined) {
      const regNorm = normalizeRegistration(registrationNumber);
      const [dup] = await db.select({ id: vehiclesTable.id }).from(vehiclesTable)
        .where(and(eq(vehiclesTable.registrationNormalized, regNorm), ne(vehiclesTable.id, id))).limit(1);
      if (dup) {
        return res.status(409).json({ error: "Vehicle registration number already exists", registrationNumber: regNorm });
      }
      updateData.registrationNumber = registrationNumber;
      updateData.registrationNormalized = regNorm;
    }
    if (vehicleType !== undefined) updateData.vehicleType = vehicleType;
    if (customerId !== undefined) updateData.customerId = customerId;
    if (vehicleModelId !== undefined) updateData.vehicleModelId = vehicleModelId;
    if (serviceAddress !== undefined) updateData.serviceAddress = serviceAddress;
    if (serviceLat !== undefined) updateData.serviceLat = serviceLat;
    if (serviceLng !== undefined) updateData.serviceLng = serviceLng;
    if (placeId !== undefined) updateData.placeId = placeId;
    if (locationLabel !== undefined) updateData.locationLabel = locationLabel;
    if (serviceAddress !== undefined || serviceLat !== undefined || serviceLng !== undefined) {
      const addr = serviceAddress ?? existing.serviceAddress;
      const lat = serviceLat ?? existing.serviceLat;
      const lng = serviceLng ?? existing.serviceLng;
      updateData.locationComplete = !!(addr && lat != null && lng != null);
    }

    if (assignedStaffId !== undefined) {
      if (assignedStaffId === null) {
        updateData.assignedStaffId = null;
      } else {
        const staff = await loadIfInScope(req,
          () => db.select().from(staffTable).where(eq(staffTable.id, assignedStaffId)).limit(1).then(r => r[0]),
          r => ({ ...r, staffId: r.id }),
        );
        if (!staff) return res.status(404).json({ error: "Staff not found" });
        if (staff.verificationStatus !== "verified") {
          return res.status(400).json({ error: "Staff must be verified before assignment" });
        }
        if (existing.branchId && staff.branchId !== existing.branchId) {
          return res.status(400).json({ error: "Staff must belong to the same branch as the vehicle" });
        }
        updateData.assignedStaffId = assignedStaffId;
      }
    }

    const [vehicle] = await db.update(vehiclesTable).set(updateData).where(eq(vehiclesTable.id, id)).returning();
    return res.json(vehicle);
  } catch (err) {
    req.log.error({ err }, "Update vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/vehicles/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Delete vehicle error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/vehicles/:id/reference-photos", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    const { getVehicleReferencePhotos } = await import("../lib/vehicles/referencePhotos");
    const data = await getVehicleReferencePhotos(id);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Get vehicle reference photos error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/vehicles/:id/reference-photos", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    const { front, rear, left, right } = req.body as Record<string, string | null | undefined>;
    const { updateVehicleReferencePhotos } = await import("../lib/vehicles/referencePhotos");
    const data = await updateVehicleReferencePhotos(id, { front, rear, left, right });
    if (!data) return res.status(404).json({ error: "Vehicle not found" });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Update vehicle reference photos error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
