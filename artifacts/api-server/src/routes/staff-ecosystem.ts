import { Router, type Request } from "express";
import { db } from "@workspace/db";
import {
  staffTable, staffRoleMasterTable, staffRoleAssignmentsTable,
  staffDocumentsTable, staffNotesTable, branchesTable, franchiseesTable,
} from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
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
      ? (await db.select({ id: staffTable.id, name: staffTable.name }).from(staffTable).where(eq(staffTable.id, staff.reportingManagerId)).limit(1))[0]
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
  "branchId", "franchiseeId", "cityId", "city", "reportingManagerId",
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
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });

    const body = applyPermanentAddress(req.body as Record<string, unknown>);
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of PATCH_FIELDS) {
      if (body[key] !== undefined) {
        const numericFields = ["monthlySalary", "perWashRate", "perDailyCleaningRate", "perSolarPanelRate", "perSolarAmcVisitRate", "ratePerKm"];
        updateData[key] = numericFields.includes(key) && body[key] !== null && body[key] !== ""
          ? String(body[key])
          : body[key];
      }
    }
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.email !== undefined) updateData.email = body.email;

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
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { roles } = req.body as { roles: { roleId: number; skillLevel?: string }[] };
    if (!Array.isArray(roles)) return res.status(400).json({ error: "roles array required" });

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
