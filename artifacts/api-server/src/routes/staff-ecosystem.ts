import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  staffTable, staffRoleMasterTable, staffRoleAssignmentsTable,
  staffDocumentsTable, staffNotesTable, branchesTable, franchiseesTable,
  complaintsTable,
} from "@workspace/db";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import { rowInScope } from "../middlewares/tenantScope";
import {
  computeProfileCompletion, generateEmployeeCode, isStaffAssignable,
} from "../lib/staffEcosystem/profileCompletion";
import { buildStaffPerformanceProfile, buildStaffDashboardStats } from "../lib/staffEcosystem/performanceProfile";

const router = Router();

const SCOPE_COLS = {
  companyCol: staffTable.companyId,
  branchCol: staffTable.branchId,
  franchiseeCol: staffTable.franchiseeId,
  staffCol: staffTable.id,
};

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

async function loadStaffInScope(req: Request, id: number) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!staff) return null;
  if (!rowInScope(req, { ...staff, staffId: staff.id })) return null;
  return staff;
}

import { recalculateStaffProfile } from "../lib/staffEcosystem/recalculate";
import { getStaffOperationalRoles } from "../lib/staffEcosystem/operationalRoles";
import {
  resolveSupervisorForStaff,
  listDirectReports,
} from "../lib/supervisor/supervisorContact";
import {
  applyStaffCategoryFields,
  isSupervisorStaff,
  normalizeStaffCategory,
  resolveStaffCategory,
} from "../lib/staffEcosystem/staffCategory";
import {
  parseRequiredMobile,
  parseOptionalEmail,
  applyMobileField,
  applyOptionalEmailField,
} from "../lib/contactFields";
import { assertContactIdentityAvailable } from "../lib/contactIdentity";

function applyPermanentAddress(body: Record<string, unknown>) {
  if (!body.permanentSameAsCurrent) return body;
  return {
    ...body,
    permanentHouseNumber: body.currentHouseNumber,
    permanentStreet: body.currentStreet,
    permanentArea: body.currentArea,
    permanentLandmark: body.currentLandmark,
    permanentCity: body.currentCity,
    permanentState: body.currentState,
    permanentPincode: body.currentPincode,
  };
}

router.get("/staff/dashboard-stats", async (req, res) => {
  try {
    const stats = await buildStaffDashboardStats(req.scope?.companyId ?? undefined);
    return res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Staff dashboard stats error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff-role-master", async (_req, res) => {
  try {
    const roles = await db.select().from(staffRoleMasterTable)
      .where(eq(staffRoleMasterTable.isActive, true))
      .orderBy(asc(staffRoleMasterTable.sortOrder));
    return res.json(roles);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/me/operational-roles", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });
    const roles = await getStaffOperationalRoles(staffId);
    return res.json({
      slugs: roles.map(r => r.roleSlug),
      roles,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/me/context", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!staff) return res.status(404).json({ error: "Staff profile not found" });

    const reportingManager = staff.staffCategory === "cleaning_staff"
      ? await resolveSupervisorForStaff(staffId)
      : null;

    const directReports = staff.staffCategory === "supervisor"
      ? await listDirectReports(staffId)
      : [];

    let openTeamComplaints = 0;
    if (staff.staffCategory === "supervisor") {
      const [countRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(complaintsTable)
        .where(and(
          eq(complaintsTable.assignedSupervisorId, staffId),
          or(
            eq(complaintsTable.status, "open"),
            eq(complaintsTable.status, "in_progress"),
          ),
        ));
      openTeamComplaints = Number(countRow?.count ?? 0);
    }

    return res.json({
      staffId: staff.id,
      name: staff.name,
      staffCategory: staff.staffCategory,
      branchId: staff.branchId,
      reportingManager,
      directReports,
      openTeamComplaints,
    });
  } catch (err) {
    req.log.error({ err }, "Staff me context error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/me/team-complaints", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!staff || staff.staffCategory !== "supervisor") {
      return res.status(403).json({ error: "Supervisor account required" });
    }

    const rows = await db.select({
      id: complaintsTable.id,
      customerId: complaintsTable.customerId,
      title: complaintsTable.title,
      description: complaintsTable.description,
      status: complaintsTable.status,
      priority: complaintsTable.priority,
      type: complaintsTable.type,
      relatedStaffId: complaintsTable.relatedStaffId,
      resolution: complaintsTable.resolution,
      resolvedAt: complaintsTable.resolvedAt,
      createdAt: complaintsTable.createdAt,
    }).from(complaintsTable)
      .where(eq(complaintsTable.assignedSupervisorId, staffId))
      .orderBy(desc(complaintsTable.createdAt))
      .limit(50);

    return res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Staff team complaints error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const STAFF_SELF_PATCH_FIELDS = [
  "profilePhotoUrl", "alternatePhone", "dateOfBirth", "gender",
  "emergencyContactName", "emergencyContactPhone",
  "currentHouseNumber", "currentStreet", "currentArea", "currentLandmark",
  "currentCity", "currentState", "currentPincode",
  "permanentHouseNumber", "permanentStreet", "permanentArea", "permanentLandmark",
  "permanentCity", "permanentState", "permanentPincode", "permanentSameAsCurrent",
] as const;

function maskBankAccount(account?: string | null) {
  if (!account) return null;
  if (account.length <= 4) return account;
  return `••••${account.slice(-4)}`;
}

async function buildEcosystemBundle(id: number, opts: { includeNotes?: boolean; maskBank?: boolean } = {}) {
  const [staffRow] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!staffRow) return null;

  const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, staffRow.branchId)).limit(1);
  const partner = staffRow.franchiseeId
    ? (await db.select().from(franchiseesTable).where(eq(franchiseesTable.id, staffRow.franchiseeId)).limit(1))[0]
    : null;
  const manager = staffRow.reportingManagerId
    ? (await db.select({
      id: staffTable.id,
      name: staffTable.name,
      phone: staffTable.phone,
      email: staffTable.email,
      employeeCode: staffTable.employeeCode,
    }).from(staffTable).where(eq(staffTable.id, staffRow.reportingManagerId)).limit(1))[0]
    : null;

  const roleRows = await db.select({
    roleId: staffRoleAssignmentsTable.roleId,
    roleName: staffRoleMasterTable.name,
    roleSlug: staffRoleMasterTable.slug,
    skillLevel: staffRoleAssignmentsTable.skillLevel,
  }).from(staffRoleAssignmentsTable)
    .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
    .where(eq(staffRoleAssignmentsTable.staffId, id));

  const documents = await db.select().from(staffDocumentsTable)
    .where(and(eq(staffDocumentsTable.staffId, id), eq(staffDocumentsTable.isCurrent, true)))
    .orderBy(desc(staffDocumentsTable.uploadedAt));

  const today = new Date().toISOString().slice(0, 10);
  const docsWithExpiry = documents.map(d => ({
    ...d,
    isExpired: d.expiryDate ? d.expiryDate < today : false,
  }));

  const notes = opts.includeNotes
    ? await db.select().from(staffNotesTable)
      .where(eq(staffNotesTable.staffId, id))
      .orderBy(desc(staffNotesTable.createdAt))
    : [];

  const performance = await buildStaffPerformanceProfile(id);
  const breakdown = computeProfileCompletion(staffRow, documents);
  const assignable = isStaffAssignable(staffRow);

  const bankAccountNumber = opts.maskBank
    ? maskBankAccount(staffRow.bankAccountNumber)
    : staffRow.bankAccountNumber;

  return {
    ...staffRow,
    bankAccountNumber,
    branchName: branch?.name,
    partnerName: partner?.name ?? null,
    reportingManagerName: manager?.name ?? null,
    reportingManagerPhone: manager?.phone ?? null,
    reportingManagerEmail: manager?.email ?? null,
    roles: roleRows,
    documents: docsWithExpiry,
    notes,
    performance,
    profileCompletion: breakdown,
    assignable,
  };
}

router.get("/staff/me/ecosystem", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!staff) return res.status(404).json({ error: "Staff profile not found" });

    const bundle = await buildEcosystemBundle(staffId, { includeNotes: false, maskBank: true });
    if (!bundle) return res.status(404).json({ error: "Staff profile not found" });
    return res.json(bundle);
  } catch (err) {
    req.log.error({ err }, "Staff me ecosystem error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/me/ecosystem", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Staff profile not found" });

    const body = applyPermanentAddress(req.body as Record<string, unknown>);
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    for (const key of STAFF_SELF_PATCH_FIELDS) {
      if (body[key] !== undefined) updateData[key] = body[key];
    }

    if (Object.keys(updateData).length <= 1) {
      return res.status(400).json({ error: "No editable fields provided" });
    }

    await db.update(staffTable).set(updateData).where(eq(staffTable.id, staffId));
    await recalculateStaffProfile(staffId);

    const bundle = await buildEcosystemBundle(staffId, { includeNotes: false, maskBank: true });
    return res.json(bundle);
  } catch (err) {
    req.log.error({ err }, "Staff me ecosystem patch error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/me/documents", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const { documentType, documentNumber, fileUrl, contentType, fileSizeBytes, expiryDate, title, description } = req.body;
    if (!documentType || !fileUrl) return res.status(400).json({ error: "documentType and fileUrl required" });
    if (contentType && !ALLOWED_MIME.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    if (documentType !== "other") {
      await db.update(staffDocumentsTable).set({ isCurrent: false, updatedAt: new Date() })
        .where(and(
          eq(staffDocumentsTable.staffId, staffId),
          eq(staffDocumentsTable.documentType, documentType),
          eq(staffDocumentsTable.isCurrent, true),
        ));
    }

    const [doc] = await db.insert(staffDocumentsTable).values({
      staffId,
      documentType,
      documentNumber,
      fileUrl,
      contentType,
      fileSizeBytes,
      expiryDate: expiryDate || null,
      title,
      description,
      uploadedByUserId: req.user?.id ?? null,
      isCurrent: true,
    }).returning();

    await recalculateStaffProfile(staffId);
    return res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Staff me document upload error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/me/documents/:docId/replace", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const docId = parseInt(req.params.docId);
    const [existing] = await db.select().from(staffDocumentsTable)
      .where(and(eq(staffDocumentsTable.id, docId), eq(staffDocumentsTable.staffId, staffId))).limit(1);
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const { fileUrl, contentType, fileSizeBytes, documentNumber, expiryDate } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl required" });

    await db.update(staffDocumentsTable).set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(staffDocumentsTable.id, docId));

    const [doc] = await db.insert(staffDocumentsTable).values({
      staffId,
      documentType: existing.documentType,
      documentNumber: documentNumber ?? existing.documentNumber,
      title: existing.title,
      description: existing.description,
      fileUrl,
      contentType,
      fileSizeBytes,
      expiryDate: expiryDate ?? existing.expiryDate,
      uploadedByUserId: req.user?.id ?? null,
      isCurrent: true,
      replacedByDocumentId: docId,
    }).returning();

    await recalculateStaffProfile(staffId);
    return res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Staff me document replace error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/me/team-complaints/:id", async (req, res) => {
  try {
    const staffId = req.user?.staffId;
    if (!staffId) return res.status(403).json({ error: "Staff account required" });

    const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
    if (!staff || staff.staffCategory !== "supervisor") {
      return res.status(403).json({ error: "Supervisor account required" });
    }

    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(complaintsTable).where(eq(complaintsTable.id, id)).limit(1);
    if (!existing || existing.assignedSupervisorId !== staffId) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    const { status, resolution } = req.body as { status?: string; resolution?: string };
    const allowedStatuses = ["open", "in_progress", "resolved"];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (status !== undefined) {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      updateData.status = status;
      if (status === "resolved") updateData.resolvedAt = new Date();
    }
    if (resolution !== undefined) updateData.resolution = resolution;

    if (Object.keys(updateData).length <= 1) {
      return res.status(400).json({ error: "status or resolution required" });
    }

    const [complaint] = await db.update(complaintsTable).set(updateData).where(eq(complaintsTable.id, id)).returning();
    return res.json(complaint);
  } catch (err) {
    req.log.error({ err }, "Staff team complaint update error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/ecosystem", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const staff = await loadStaffInScope(req, id);
    if (!staff) return res.status(404).json({ error: "Staff not found" });

    const [branch] = await db.select().from(branchesTable).where(eq(branchesTable.id, staff.branchId)).limit(1);
    const partner = staff.franchiseeId
      ? (await db.select().from(franchiseesTable).where(eq(franchiseesTable.id, staff.franchiseeId)).limit(1))[0]
      : null;
    const manager = staff.reportingManagerId
      ? (await db.select({
        id: staffTable.id,
        name: staffTable.name,
        phone: staffTable.phone,
        email: staffTable.email,
        employeeCode: staffTable.employeeCode,
      }).from(staffTable).where(eq(staffTable.id, staff.reportingManagerId)).limit(1))[0]
      : null;

    const roleRows = await db.select({
      roleId: staffRoleAssignmentsTable.roleId,
      roleName: staffRoleMasterTable.name,
      roleSlug: staffRoleMasterTable.slug,
      skillLevel: staffRoleAssignmentsTable.skillLevel,
    }).from(staffRoleAssignmentsTable)
      .innerJoin(staffRoleMasterTable, eq(staffRoleAssignmentsTable.roleId, staffRoleMasterTable.id))
      .where(eq(staffRoleAssignmentsTable.staffId, id));

    const documents = await db.select().from(staffDocumentsTable)
      .where(and(eq(staffDocumentsTable.staffId, id), eq(staffDocumentsTable.isCurrent, true)))
      .orderBy(desc(staffDocumentsTable.uploadedAt));

    const notes = await db.select().from(staffNotesTable)
      .where(eq(staffNotesTable.staffId, id))
      .orderBy(desc(staffNotesTable.createdAt));

    const performance = await buildStaffPerformanceProfile(id);
    const breakdown = computeProfileCompletion(staff, documents);
    const assignable = isStaffAssignable(staff);

    return res.json({
      ...staff,
      branchName: branch?.name,
      partnerName: partner?.name ?? null,
      reportingManagerName: manager?.name ?? null,
      reportingManagerPhone: manager?.phone ?? null,
      reportingManagerEmail: manager?.email ?? null,
      roles: roleRows,
      documents,
      notes,
      performance,
      profileCompletion: breakdown,
      assignable,
    });
  } catch (err) {
    req.log.error({ err }, "Get staff ecosystem error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PATCH_FIELDS = [
  "name", "profilePhotoUrl", "alternatePhone", "dateOfBirth", "gender", "joiningDate",
  "branchId", "franchiseeId", "cityId", "city", "reportingManagerId", "staffCategory",
  "employmentType", "monthlySalary", "perWashRate", "perDailyCleaningRate",
  "perSolarPanelRate", "perSolarAmcVisitRate", "ownsVehicle", "vehicleType",
  "vehicleRegistrationNumber", "petrolModel", "ratePerKm", "availability",
  "weeklyOff", "workingHoursStart", "workingHoursEnd",
  "currentHouseNumber", "currentStreet", "currentArea", "currentLandmark",
  "currentCity", "currentState", "currentPincode",
  "permanentHouseNumber", "permanentStreet", "permanentArea", "permanentLandmark",
  "permanentCity", "permanentState", "permanentPincode", "permanentSameAsCurrent",
  "emergencyContactName", "emergencyContactPhone", "aadhaar", "pan",
  "bankAccountName", "bankName", "bankAccountNumber", "bankIfsc", "bankBranch", "upiId",
  "isActive", "verificationStatus",
] as const;

router.patch("/staff/:id/ecosystem", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await loadStaffInScope(req, id);
    if (!existing) return res.status(404).json({ error: "Staff not found" });

    const body = applyPermanentAddress(req.body as Record<string, unknown>);
    const existingCategory = resolveStaffCategory(existing);
    const nextCategory = body.staffCategory !== undefined
      ? normalizeStaffCategory(body.staffCategory)
      : existingCategory;
    const categoryChanging = nextCategory !== existingCategory;

    if (body.reportingManagerId !== undefined && body.reportingManagerId !== null && body.reportingManagerId !== "") {
      if (nextCategory !== "cleaning_staff") {
        return res.status(400).json({ error: "Only cleaning staff can have a reporting manager" });
      }
      const managerId = parseInt(String(body.reportingManagerId), 10);
      if (!Number.isFinite(managerId) || managerId <= 0) {
        return res.status(400).json({ error: "Invalid reportingManagerId" });
      }
      if (managerId === id) {
        return res.status(400).json({ error: "Staff cannot be their own reporting manager" });
      }
      const [manager] = await db.select().from(staffTable).where(eq(staffTable.id, managerId)).limit(1);
      if (!manager || !rowInScope(req, { ...manager, staffId: manager.id })) {
        return res.status(400).json({ error: "Reporting manager not found" });
      }
      if (!isSupervisorStaff(manager)) {
        return res.status(400).json({ error: "Reporting manager must be a supervisor" });
      }
      if (!manager.isActive) {
        return res.status(400).json({ error: "Reporting manager must be active" });
      }
    }

    if (nextCategory === "supervisor") {
      body.reportingManagerId = null;
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) {
        const numericFields = ["monthlySalary", "perWashRate", "perDailyCleaningRate", "perSolarPanelRate", "perSolarAmcVisitRate", "ratePerKm"];
        updateData[key] = numericFields.includes(key) && body[key] !== null && body[key] !== ""
          ? String(body[key])
          : body[key];
      }
    }

    if (body.staffCategory !== undefined || categoryChanging) {
      const categoryFields = applyStaffCategoryFields(nextCategory);
      updateData.staffCategory = categoryFields.staffCategory;
      updateData.role = categoryFields.role;
      if (categoryFields.reportingManagerId === null) {
        updateData.reportingManagerId = null;
      }
    }
    if (body.phone !== undefined) {
      const phoneField = applyMobileField(body, "phone", updateData);
      if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    }
    if (body.email !== undefined) {
      const emailField = applyOptionalEmailField(body, "email", updateData);
      if (!emailField.ok) return res.status(400).json({ error: emailField.error });
    }

    if (updateData.phone !== undefined || updateData.email !== undefined) {
      const identityCheck = await assertContactIdentityAvailable(
        typeof updateData.phone === "string" ? updateData.phone : existing.phone,
        updateData.email !== undefined ? updateData.email : existing.email,
        { entity: "staff", id },
      );
      if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);
      if (typeof updateData.phone === "string") updateData.phone = identityCheck.identity.phone;
      if (updateData.email !== undefined) updateData.email = identityCheck.identity.email;
    }

    const [staff] = await db.update(staffTable).set(updateData).where(eq(staffTable.id, id)).returning();
    await recalculateStaffProfile(id);
    const [updated] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
    return res.json(updated ?? staff);
  } catch (err) {
    req.log.error({ err }, "Patch staff ecosystem error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/staff/:id/roles", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = await loadStaffInScope(req, id);
    if (!existing) return res.status(404).json({ error: "Staff not found" });
    const { roles } = req.body as { roles: { roleId: number; skillLevel?: string }[] };
    if (!Array.isArray(roles)) return res.status(400).json({ error: "roles array required" });
    if (isSupervisorStaff(existing)) {
      return res.status(400).json({ error: "Operational roles are not assigned to supervisors yet" });
    }

    await db.delete(staffRoleAssignmentsTable).where(eq(staffRoleAssignmentsTable.staffId, id));
    if (roles.length > 0) {
      await db.insert(staffRoleAssignmentsTable).values(
        roles.map((r) => ({
          staffId: id,
          roleId: r.roleId,
          skillLevel: (r.skillLevel ?? "basic") as "trainee" | "basic" | "intermediate" | "expert",
        })),
      );
    }
    await recalculateStaffProfile(id);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Update staff roles error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/verification-status", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { status, notes } = req.body as { status: "pending" | "verified" | "rejected" | "suspended"; notes?: string };
    if (!["pending", "verified", "rejected", "suspended"].includes(status)) {
      return res.status(400).json({ error: "Invalid verification status" });
    }
    const [staff] = await db.update(staffTable).set({
      verificationStatus: status,
      verificationNotes: notes,
      verifiedAt: status === "verified" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(staffTable.id, id)).returning();
    return res.json(staff);
  } catch (err) {
    req.log.error({ err }, "Update verification status error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/documents", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const docs = await db.select().from(staffDocumentsTable)
      .where(and(eq(staffDocumentsTable.staffId, id), eq(staffDocumentsTable.isCurrent, true)))
      .orderBy(desc(staffDocumentsTable.uploadedAt));
    const today = new Date().toISOString().slice(0, 10);
    return res.json(docs.map((d) => ({
      ...d,
      isExpired: d.expiryDate ? d.expiryDate < today : false,
    })));
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/documents", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { documentType, documentNumber, fileUrl, contentType, fileSizeBytes, expiryDate, title, description } = req.body;
    if (!documentType || !fileUrl) return res.status(400).json({ error: "documentType and fileUrl required" });
    if (contentType && !ALLOWED_MIME.includes(contentType)) {
      return res.status(400).json({ error: "Invalid file type" });
    }

    if (documentType !== "other") {
      await db.update(staffDocumentsTable).set({ isCurrent: false, updatedAt: new Date() })
        .where(and(
          eq(staffDocumentsTable.staffId, id),
          eq(staffDocumentsTable.documentType, documentType),
          eq(staffDocumentsTable.isCurrent, true),
        ));
    }

    const [doc] = await db.insert(staffDocumentsTable).values({
      staffId: id,
      documentType,
      documentNumber,
      fileUrl,
      contentType,
      fileSizeBytes,
      expiryDate: expiryDate || null,
      title,
      description,
      uploadedByUserId: req.user?.id ?? null,
      isCurrent: true,
    }).returning();

    await recalculateStaffProfile(id);
    return res.status(201).json(doc);
  } catch (err) {
    req.log.error({ err }, "Create staff document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/documents/:docId/replace", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });

    const [existing] = await db.select().from(staffDocumentsTable)
      .where(and(eq(staffDocumentsTable.id, docId), eq(staffDocumentsTable.staffId, id))).limit(1);
    if (!existing) return res.status(404).json({ error: "Document not found" });

    const { fileUrl, contentType, fileSizeBytes, documentNumber, expiryDate } = req.body;
    if (!fileUrl) return res.status(400).json({ error: "fileUrl required" });

    await db.update(staffDocumentsTable).set({ isCurrent: false, updatedAt: new Date() })
      .where(eq(staffDocumentsTable.id, docId));

    const [doc] = await db.insert(staffDocumentsTable).values({
      staffId: id,
      documentType: existing.documentType,
      documentNumber: documentNumber ?? existing.documentNumber,
      title: existing.title,
      description: existing.description,
      fileUrl,
      contentType,
      fileSizeBytes,
      expiryDate: expiryDate ?? existing.expiryDate,
      uploadedByUserId: req.user?.id ?? null,
      isCurrent: true,
      replacedByDocumentId: docId,
    }).returning();

    await recalculateStaffProfile(id);
    return res.json(doc);
  } catch (err) {
    req.log.error({ err }, "Replace staff document error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/staff/:id/documents/:docId", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const docId = parseInt(req.params.docId);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const [doc] = await db.select().from(staffDocumentsTable)
      .where(and(eq(staffDocumentsTable.id, docId), eq(staffDocumentsTable.staffId, id))).limit(1);
    if (!doc) return res.status(404).json({ error: "Document not found" });
    if (doc.documentType !== "other") return res.status(400).json({ error: "Only other documents can be deleted" });
    await db.delete(staffDocumentsTable).where(eq(staffDocumentsTable.id, docId));
    await recalculateStaffProfile(id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/notes", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const notes = await db.select().from(staffNotesTable)
      .where(eq(staffNotesTable.staffId, id))
      .orderBy(desc(staffNotesTable.createdAt));
    return res.json(notes);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/notes", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { note } = req.body as { note: string };
    if (!note?.trim()) return res.status(400).json({ error: "note is required" });

    const [row] = await db.insert(staffNotesTable).values({
      staffId: id,
      note: note.trim(),
      authorUserId: req.user?.id ?? null,
      authorName: req.user?.name ?? "Admin",
    }).returning();
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/performance-profile", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    return res.json(await buildStaffPerformanceProfile(id));
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export { loadStaffInScope, isStaffAssignable };
export default router;
