import { Router } from "express";
import { db } from "@workspace/db";
import { branchesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";
import { parseOptionalContactPhone, applyOptionalContactPhoneField } from "../lib/contactFields";
import {
  listBranchesDetailed,
  createBranch,
  suspendBranch,
  activateBranch,
  validateBranchReadiness,
} from "../lib/franchise/branchManagementService";
import { getBranchOperationsDashboard } from "../lib/franchise/branchOperationsService";

const router = Router();

const BRANCH_SCOPE = {
  companyCol: branchesTable.companyId,
  branchCol: branchesTable.id,
};

router.get("/branches", async (req, res) => {
  try {
    const cityId = req.query.cityId ? parseInt(req.query.cityId as string) : undefined;
    const franchiseeId = req.query.franchiseeId ? parseInt(req.query.franchiseeId as string) : undefined;
    const isCompanyOperated = req.query.isCompanyOperated !== undefined ? req.query.isCompanyOperated === "true" : undefined;
    const status = req.query.status as string | undefined;

    const companyId = req.scope?.companyId ?? undefined;

    const data = await listBranchesDetailed({
      cityId,
      franchiseeId,
      isCompanyOperated,
      status,
      companyId,
    });
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List branches error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/branches", async (req, res) => {
  try {
    const {
      name, city, cityId, address, phone, managerName,
      code, franchiseeId, legalEntityId, isCompanyOperated,
      serviceAvailability, operationalNotes,
    } = req.body;
    if (!name || !city) return res.status(400).json({ error: "name and city are required" });

    const phoneResult = parseOptionalContactPhone(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const branch = await createBranch({
      name,
      code,
      city,
      cityId: cityId ? parseInt(cityId) : undefined,
      address,
      phone: phoneResult.value,
      managerName,
      companyId: req.scope?.companyId ?? undefined,
      franchiseeId: franchiseeId ? parseInt(franchiseeId) : undefined,
      legalEntityId: legalEntityId ? parseInt(legalEntityId) : undefined,
      isCompanyOperated: isCompanyOperated !== undefined ? Boolean(isCompanyOperated) : undefined,
      serviceAvailability,
      operationalNotes,
    }, req.user?.id ?? 0);

    return res.status(201).json({ ...branch, customerCount: 0, staffCount: 0, activeSubscriptionsCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Create branch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/branches/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(branchesTable).where(eq(branchesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { ...existing, branchId: existing.id })) {
      return res.status(404).json({ error: "Branch not found" });
    }
    const {
      name, city, cityId, address, phone, managerName, isActive,
      code, franchiseeId, legalEntityId, isCompanyOperated,
      status, serviceAvailability, operationalNotes,
    } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code;
    if (city !== undefined) updateData.city = city;
    if (cityId !== undefined) updateData.cityId = cityId ? parseInt(cityId) : null;
    if (address !== undefined) updateData.address = address;
    const phoneField = applyOptionalContactPhoneField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    if (managerName !== undefined) updateData.managerName = managerName;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (status !== undefined) updateData.status = status;
    if (franchiseeId !== undefined) updateData.franchiseeId = franchiseeId ? parseInt(franchiseeId) : null;
    if (legalEntityId !== undefined) updateData.legalEntityId = legalEntityId ? parseInt(legalEntityId) : null;
    if (isCompanyOperated !== undefined) updateData.isCompanyOperated = Boolean(isCompanyOperated);
    if (serviceAvailability !== undefined) updateData.serviceAvailability = serviceAvailability;
    if (operationalNotes !== undefined) updateData.operationalNotes = operationalNotes;

    const [branch] = await db.update(branchesTable).set(updateData).where(eq(branchesTable.id, id)).returning();
    return res.json(branch);
  } catch (err) {
    req.log.error({ err }, "Update branch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/branches/:id/suspend", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: "Suspension reason is required" });

    const suspended = await suspendBranch(id, reason.trim(), req.user?.id ?? 0);
    return res.json(suspended);
  } catch (err) {
    req.log.error({ err }, "Suspend branch error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/branches/:id/readiness", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const report = await validateBranchReadiness(id);
    return res.json(report);
  } catch (err) {
    req.log.error({ err }, "Validate branch readiness error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/branches/:id/operations-hub", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const dashboard = await getBranchOperationsDashboard(id);
    return res.json(dashboard);
  } catch (err) {
    req.log.error({ err }, "Get branch operations hub error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.post("/branches/:id/activate", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const force = req.body?.force === true;
    const activated = await activateBranch(id, req.user?.id ?? 0, force);
    return res.json(activated);
  } catch (err) {
    req.log.error({ err }, "Activate branch error");
    return res.status(400).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.delete("/branches/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid branch id" });

    const [existing] = await db.select().from(branchesTable).where(eq(branchesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, { ...existing, branchId: existing.id })) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const [counts] = await db.select({
      customerCount: sql<number>`(SELECT COUNT(*)::int FROM customers c WHERE c.branch_id = ${id})`,
      staffCount: sql<number>`(SELECT COUNT(*)::int FROM staff s WHERE s.branch_id = ${id})`,
    }).from(branchesTable).where(eq(branchesTable.id, id)).limit(1);

    const customerCount = counts?.customerCount ?? 0;
    const staffCount = counts?.staffCount ?? 0;
    if (customerCount > 0 || staffCount > 0) {
      return res.status(409).json({
        error: "Cannot delete a branch that has customers or staff assigned. Deactivate it instead.",
        customerCount,
        staffCount,
      });
    }

    await db.delete(branchesTable).where(eq(branchesTable.id, id));
    return res.json({ success: true, id });
  } catch (err) {
    req.log.error({ err }, "Delete branch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
