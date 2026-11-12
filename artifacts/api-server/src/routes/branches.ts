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
import {
  assignBranchUser,
  replaceBranchManager,
  revokeBranchAssignment,
  listBranchAssignments,
  getUserActiveBranchIds,
} from "../lib/franchise/branchAssignmentService";
import {
  getBranchServiceCatalog,
  setBranchServiceOverride,
} from "../lib/branchConfigService";

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

/**
 * GET /api/branch-assignments/candidate-users
 * Returns eligible active users for branch assignment (Super Admin / Central Admin only).
 */
router.get("/branch-assignments/candidate-users", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const isCentral =
      user.role === "superadmin" ||
      user.role === "central_admin" ||
      (user.role === "admin" && !user.branchId);

    if (!isCentral) {
      return res.status(403).json({ error: "Access denied" });
    }

    const candidates = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        phone: usersTable.phone,
        role: usersTable.role,
        isActive: usersTable.isActive,
      })
      .from(usersTable)
      .where(eq(usersTable.isActive, true))
      .limit(200);

    return res.json(candidates);
  } catch (err) {
    req.log.error({ err }, "Get candidate users error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/branch-assignments/my-branches
 * Returns all active branches authorized for the logged-in user.
 * Multi-branch managers will receive all assigned branches.
 */
router.get("/branch-assignments/my-branches", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const isCentral =
      user.role === "superadmin" ||
      user.role === "central_admin" ||
      (user.role === "admin" && !user.branchId);

    if (isCentral) {
      const allActive = await db
        .select()
        .from(branchesTable)
        .where(and(eq(branchesTable.status, "active"), eq(branchesTable.isActive, true)));
      return res.json(allActive);
    }

    const branchIds = await getUserActiveBranchIds(user.id);
    if (branchIds.length === 0) {
      if (user.branchId) {
        const [single] = await db
          .select()
          .from(branchesTable)
          .where(eq(branchesTable.id, user.branchId))
          .limit(1);
        if (single && single.status === "active" && single.isActive) {
          return res.json([single]);
        }
      }
      return res.json([]);
    }

    const { inArray } = await import("drizzle-orm");
    const authorized = await db
      .select()
      .from(branchesTable)
      .where(
        and(
          inArray(branchesTable.id, branchIds),
          eq(branchesTable.status, "active"),
          eq(branchesTable.isActive, true),
        ),
      );
    return res.json(authorized);
  } catch (err) {
    req.log.error({ err }, "Get my branches error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/branches/:id/assignments
 * Returns user assignments and history for a branch.
 */
router.get("/branches/:id/assignments", async (req, res) => {
  try {
    const branchId = parseInt(req.params.id, 10);
    if (Number.isNaN(branchId)) return res.status(400).json({ error: "Invalid branch id" });

    if (!rowInScope(req, { branchId })) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const assignments = await listBranchAssignments({ branchId });
    return res.json(assignments);
  } catch (err) {
    req.log.error({ err }, "List branch assignments error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/branches/:id/assignments
 * Appoints a user to a branch. Strictly Central Super Admin / Central Admin.
 */
router.post("/branches/:id/assignments", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const isCentral =
      user.role === "superadmin" ||
      user.role === "central_admin" ||
      (user.role === "admin" && !user.branchId);

    if (!isCentral) {
      return res.status(403).json({ error: "Access denied. Only Super Admin can manage branch assignments." });
    }

    const branchId = parseInt(req.params.id, 10);
    const { userId, assignmentRole, effectiveFrom, effectiveUntil } = req.body;
    if (!userId) return res.status(400).json({ error: "userId is required" });

    const assignment = await assignBranchUser({
      userId: parseInt(userId, 10),
      branchId,
      assignmentRole: assignmentRole ?? "branch_manager",
      assignedBy: user.id,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
      effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : undefined,
    });

    return res.status(201).json(assignment);
  } catch (err: any) {
    req.log.error({ err }, "Assign branch user error");
    return res.status(400).json({ error: err.message || "Failed to assign branch user" });
  }
});

/**
 * POST /api/branches/:id/replace-manager
 * Atomically replaces the branch manager. Strictly Central Super Admin / Central Admin.
 */
router.post("/branches/:id/replace-manager", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const isCentral =
      user.role === "superadmin" ||
      user.role === "central_admin" ||
      (user.role === "admin" && !user.branchId);

    if (!isCentral) {
      return res.status(403).json({ error: "Access denied. Only Super Admin can replace branch managers." });
    }

    const branchId = parseInt(req.params.id, 10);
    const { newUserId, reason } = req.body;
    if (!newUserId) return res.status(400).json({ error: "newUserId is required" });

    const assignment = await replaceBranchManager({
      branchId,
      newUserId: parseInt(newUserId, 10),
      assignedBy: user.id,
      reason,
    });

    return res.json(assignment);
  } catch (err: any) {
    req.log.error({ err }, "Replace branch manager error");
    return res.status(400).json({ error: err.message || "Failed to replace branch manager" });
  }
});

/**
 * DELETE /api/branches/:id/assignments/:assignmentId
 * Revokes a branch assignment immediately. Strictly Central Super Admin / Central Admin.
 */
router.delete("/branches/:id/assignments/:assignmentId", async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "Authentication required" });

    const isCentral =
      user.role === "superadmin" ||
      user.role === "central_admin" ||
      (user.role === "admin" && !user.branchId);

    if (!isCentral) {
      return res.status(403).json({ error: "Access denied. Only Super Admin can revoke branch assignments." });
    }

    const assignmentId = parseInt(req.params.assignmentId, 10);
    const { reason = "Administrative revocation" } = req.body || {};

    const revoked = await revokeBranchAssignment(assignmentId, user.id, reason);
    return res.json(revoked);
  } catch (err: any) {
    req.log.error({ err }, "Revoke branch assignment error");
    return res.status(400).json({ error: err.message || "Failed to revoke branch assignment" });
  }
});

/**
 * GET /api/branches/:id/services
 * Returns effective services and pricing hierarchy for branch
 */
router.get("/branches/:id/services", async (req, res) => {
  try {
    const branchId = parseInt(req.params.id, 10);
    if (Number.isNaN(branchId)) return res.status(400).json({ error: "Invalid branch id" });

    if (!rowInScope(req, { branchId })) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const catalog = await getBranchServiceCatalog(branchId);
    return res.json(catalog);
  } catch (err: any) {
    req.log.error({ err }, "Get branch services error");
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * PUT /api/branches/:id/services/:serviceId
 * Sets branch-specific service price or availability override
 */
router.put("/branches/:id/services/:serviceId", async (req, res) => {
  try {
    const branchId = parseInt(req.params.id, 10);
    const serviceId = parseInt(req.params.serviceId, 10);
    if (!rowInScope(req, { branchId })) {
      return res.status(404).json({ error: "Branch not found" });
    }

    const { basePriceOverride, isActive, customSettings } = req.body;
    const override = await setBranchServiceOverride({
      branchId,
      serviceId,
      basePriceOverride: basePriceOverride != null ? parseFloat(basePriceOverride) : undefined,
      isActive: isActive !== undefined ? Boolean(isActive) : undefined,
      customSettings,
      performedBy: req.user?.id ?? 0,
    });

    return res.json(override);
  } catch (err: any) {
    req.log.error({ err }, "Set branch service override error");
    return res.status(400).json({ error: err.message || "Failed to set branch service override" });
  }
});

export default router;
