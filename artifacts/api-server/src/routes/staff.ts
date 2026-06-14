import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { staffTable, attendanceTable, bookingsTable, branchesTable, usersTable, staffRoleMasterTable, staffLocationLogsTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";
import { hashPassword } from "../lib/passwords";
import { generateEmployeeCode } from "../lib/staffEcosystem/profileCompletion";
import { recalculateStaffProfile } from "../lib/staffEcosystem/recalculate";
import {
  attachOperationalRoles,
  assignOperationalRoles,
  getStaffIdsWithOperationalRole,
  getStaffOperationalRoles,
  operationalSlugToLegacyRole,
} from "../lib/staffEcosystem/operationalRoles";
import { isSupervisorStaff } from "../lib/staffEcosystem/staffCategory";
import {
  parseRequiredMobile,
  parseOptionalEmail,
  parseOptionalMobile,
  applyMobileField,
  applyOptionalEmailField,
  applyOptionalMobileField,
} from "../lib/contactFields";
import {
  handleLocationError,
  parseStaffLocation,
  recordStaffLocation,
} from "../lib/staffLocation/locationService";
import { assertContactIdentityAvailable } from "../lib/contactIdentity";

const router = Router();

const SCOPE_COLS = {
  companyCol: staffTable.companyId,
  branchCol: staffTable.branchId,
  franchiseeCol: staffTable.franchiseeId,
  staffCol: staffTable.id,
};

router.get("/staff", async (req, res) => {
  try {
    const { branchId, role, isActive, verificationStatus, franchiseeId, forAssignment, roleSlug, staffCategory } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (branchId) conditions.push(eq(staffTable.branchId, parseInt(branchId)));
    if (role) conditions.push(eq(staffTable.role, role as (typeof staffTable.role)["_"]["data"]));
    if (staffCategory) conditions.push(eq(staffTable.staffCategory, staffCategory as (typeof staffTable.staffCategory)["_"]["data"]));
    if (isActive !== undefined) conditions.push(eq(staffTable.isActive, isActive === "true"));
    else if (forAssignment === "true") conditions.push(eq(staffTable.isActive, true));
    if (verificationStatus) conditions.push(eq(staffTable.verificationStatus, verificationStatus as (typeof staffTable.verificationStatus)["_"]["data"]));
    if (franchiseeId) conditions.push(eq(staffTable.franchiseeId, parseInt(franchiseeId)));
    if (forAssignment === "true") {
      conditions.push(sql`${staffTable.verificationStatus} != 'suspended'`);
    }

    let roleFilteredIds: number[] | null = null;
    if (roleSlug) {
      roleFilteredIds = await getStaffIdsWithOperationalRole(roleSlug);
      if (roleFilteredIds.length === 0) {
        return res.json([]);
      }
      conditions.push(inArray(staffTable.id, roleFilteredIds));
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select({
      id: staffTable.id, userId: staffTable.userId, franchiseeId: staffTable.franchiseeId,
      employeeCode: staffTable.employeeCode, name: staffTable.name,
      profilePhotoUrl: staffTable.profilePhotoUrl,
      phone: staffTable.phone, email: staffTable.email, role: staffTable.role,
      staffCategory: staffTable.staffCategory,
      branchId: staffTable.branchId, branchName: branchesTable.name,
      monthlySalary: staffTable.monthlySalary, joiningDate: staffTable.joiningDate,
      verificationStatus: staffTable.verificationStatus, isActive: staffTable.isActive,
      profileCompletionPercent: staffTable.profileCompletionPercent,
      identityComplete: staffTable.identityComplete,
      documentsComplete: staffTable.documentsComplete,
      bankComplete: staffTable.bankComplete,
      addressComplete: staffTable.addressComplete,
      jobsCompletedThisMonth: sql<number>`(
        SELECT COUNT(*) FROM bookings b
        WHERE b.staff_id = ${staffTable.id}
        AND b.status = 'completed'
        AND DATE_TRUNC('month', b.scheduled_date::date) = DATE_TRUNC('month', NOW())
      )`,
      rating: sql<number>`(
        SELECT AVG(b.rating) FROM bookings b
        WHERE b.staff_id = ${staffTable.id}
        AND b.rating IS NOT NULL
      )`,
      createdAt: staffTable.createdAt,
    }).from(staffTable)
      .leftJoin(branchesTable, eq(staffTable.branchId, branchesTable.id))
      .where(where);

    const withRoles = await attachOperationalRoles(data);
    return res.json(withRoles);
  } catch (err) {
    req.log.error({ err }, "List staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function loadStaffInScope(req: Request, id: number) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!staff) return null;
  if (!rowInScope(req, { ...staff, staffId: staff.id })) return null;
  return staff;
}

async function validateReportingManager(
  req: Request,
  reportingManagerId: number,
): Promise<string | null> {
  const manager = await loadStaffInScope(req, reportingManagerId);
  if (!manager) return "Reporting manager not found";
  if (!manager.isActive) return "Reporting manager must be active";
  if (!isSupervisorStaff(manager)) return "Reporting manager must be a supervisor";
  return null;
}

router.post("/staff", async (req, res) => {
  try {
    const {
      name, phone, email, role, branchId, franchiseeId,
      monthlySalary, joiningDate, localAddress, permanentAddress,
      guardianName, guardianPhone, aadhaar, pan,
      bankAccountName, bankAccountNumber, bankIfsc, bankPassbookUrl, agreementUrl,
      operationalRoleIds,
      initialPassword,
      staffCategory: staffCategoryRaw,
      reportingManagerId,
    } = req.body;

    const staffCategory = staffCategoryRaw === "supervisor" ? "supervisor" : "cleaning_staff";

    if (!name || !branchId) {
      return res.status(400).json({ error: "name and branchId are required" });
    }

    let resolvedRole = role;
    const roleIds: number[] = Array.isArray(operationalRoleIds)
      ? operationalRoleIds.map(Number).filter(n => Number.isFinite(n) && n > 0)
      : [];

    if (staffCategory === "supervisor") {
      resolvedRole = "supervisor";
    } else {
      if (!resolvedRole && roleIds.length > 0) {
        const roles = await db.select({ slug: staffRoleMasterTable.slug })
          .from(staffRoleMasterTable)
          .where(inArray(staffRoleMasterTable.id, roleIds))
          .limit(1);
        if (roles[0]) resolvedRole = operationalSlugToLegacyRole(roles[0].slug);
      }
      if (!resolvedRole) {
        return res.status(400).json({ error: "operationalRoleIds is required for cleaning staff" });
      }
    }

    let parsedReportingManagerId: number | undefined;
    if (reportingManagerId !== undefined && reportingManagerId !== null && reportingManagerId !== "") {
      parsedReportingManagerId = parseInt(String(reportingManagerId), 10);
      if (!Number.isFinite(parsedReportingManagerId) || parsedReportingManagerId <= 0) {
        return res.status(400).json({ error: "Invalid reportingManagerId" });
      }
      if (staffCategory !== "cleaning_staff") {
        return res.status(400).json({ error: "Only cleaning staff can have a reporting manager" });
      }
      const managerErr = await validateReportingManager(req, parsedReportingManagerId);
      if (managerErr) return res.status(400).json({ error: managerErr });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const identityCheck = await assertContactIdentityAvailable(
      phoneResult.value,
      emailResult.value,
    );
    if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);

    const guardianPhoneResult = parseOptionalMobile(guardianPhone);
    if (!guardianPhoneResult.ok) return res.status(400).json({ error: guardianPhoneResult.error });

    const values = tenantStamp(req, {
      name, phone: identityCheck.identity.phone, email: identityCheck.identity.email, role: resolvedRole,
      staffCategory,
      branchId: parseInt(branchId),
      franchiseeId: franchiseeId ? parseInt(franchiseeId) : undefined,
      reportingManagerId: parsedReportingManagerId,
      monthlySalary: monthlySalary?.toString(),
      joiningDate, localAddress, permanentAddress,
      guardianName, guardianPhone: guardianPhoneResult.value, aadhaar, pan,
      bankAccountName, bankAccountNumber, bankIfsc,
      bankPassbookUrl, agreementUrl,
      verificationStatus: "pending" as const,
    });
    const [staff] = await db.insert(staffTable).values(values as typeof staffTable.$inferInsert).returning();
    const employeeCode = generateEmployeeCode(staff.id);
    const [updated] = await db.update(staffTable).set({ employeeCode, updatedAt: new Date() })
      .where(eq(staffTable.id, staff.id)).returning();
    await recalculateStaffProfile(staff.id);
    if (roleIds.length > 0) {
      await assignOperationalRoles(staff.id, roleIds);
    }
    const operationalRoles = await getStaffOperationalRoles(staff.id);

    let loginAccount: { userId: number; phone: string } | null = null;
    if (initialPassword) {
      try {
        const staffRow = updated ?? staff;
        loginAccount = await createStaffLoginAccount(staffRow, String(initialPassword));
      } catch (accountErr) {
        req.log.warn({ err: accountErr, staffId: staff.id }, "Staff created but login account failed");
        return res.status(201).json({
          ...(updated ?? staff),
          operationalRoles,
          loginWarning: accountErr instanceof Error ? accountErr.message : "Failed to create login account",
        });
      }
    }

    return res.status(201).json({
      ...(updated ?? staff),
      operationalRoles,
      userId: loginAccount?.userId ?? null,
      loginCreated: Boolean(loginAccount),
      phone: loginAccount?.phone ?? (updated ?? staff).phone,
    });
  } catch (err) {
    req.log.error({ err }, "Create staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function createStaffLoginAccount(
  staffMember: typeof staffTable.$inferSelect,
  password: string,
) {
  if (!password || String(password).length < 6) {
    throw new Error("Password must be at least 6 characters");
  }
  if (staffMember.userId) {
    throw new Error("Account already exists");
  }

  const identityCheck = await assertContactIdentityAvailable(
    staffMember.phone,
    staffMember.email,
    { entity: "staff", id: staffMember.id },
  );
  if (!identityCheck.ok) {
    throw new Error(identityCheck.body.error as string);
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.phone, staffMember.phone)).limit(1);
  if (existing[0]) {
    throw new Error("A login account with this phone number already exists");
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    name: staffMember.name,
    phone: staffMember.phone,
    email: staffMember.email ?? undefined,
    passwordHash,
    role: "staff",
    branchId: staffMember.branchId,
    companyId: staffMember.companyId ?? undefined,
    franchiseeId: staffMember.franchiseeId ?? undefined,
    staffId: staffMember.id,
  }).returning();

  await db.update(staffTable).set({
    userId: user.id,
    verificationStatus: "verified",
    verifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(staffTable.id, staffMember.id));

  return { userId: user.id, phone: user.phone };
}

router.get("/staff/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const inScope = await loadStaffInScope(req, id);
    if (!inScope) return res.status(404).json({ error: "Staff not found" });

    const [staff] = await db.select({
      id: staffTable.id, userId: staffTable.userId, franchiseeId: staffTable.franchiseeId,
      name: staffTable.name, phone: staffTable.phone, email: staffTable.email, role: staffTable.role,
      branchId: staffTable.branchId, branchName: branchesTable.name,
      monthlySalary: staffTable.monthlySalary, joiningDate: staffTable.joiningDate,
      localAddress: staffTable.localAddress, permanentAddress: staffTable.permanentAddress,
      guardianName: staffTable.guardianName, guardianPhone: staffTable.guardianPhone,
      aadhaar: staffTable.aadhaar, pan: staffTable.pan,
      bankAccountName: staffTable.bankAccountName, bankAccountNumber: staffTable.bankAccountNumber,
      bankIfsc: staffTable.bankIfsc, bankPassbookUrl: staffTable.bankPassbookUrl,
      agreementUrl: staffTable.agreementUrl,
      verificationStatus: staffTable.verificationStatus, verificationNotes: staffTable.verificationNotes,
      verifiedAt: staffTable.verifiedAt, isActive: staffTable.isActive,
      createdAt: staffTable.createdAt,
    }).from(staffTable)
      .leftJoin(branchesTable, eq(staffTable.branchId, branchesTable.id))
      .where(eq(staffTable.id, id));

    const recentBookings = await db.select().from(bookingsTable)
      .where(eq(bookingsTable.staffId, id))
      .orderBy(desc(bookingsTable.createdAt)).limit(5);

    const attendanceSummary = await db.select({
      status: attendanceTable.status,
      cnt: sql<number>`count(*)`,
    }).from(attendanceTable).where(eq(attendanceTable.staffId, id)).groupBy(attendanceTable.status);

    const summary = {
      presentDays: Number(attendanceSummary.find(a => a.status === "present")?.cnt ?? 0),
      absentDays: Number(attendanceSummary.find(a => a.status === "absent")?.cnt ?? 0),
      lateDays: Number(attendanceSummary.find(a => a.status === "late")?.cnt ?? 0),
    };

    return res.json({ ...staff, recentBookings, attendanceSummary: summary });
  } catch (err) {
    req.log.error({ err }, "Get staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/staff/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existingStaff = await loadStaffInScope(req, id);
    if (!existingStaff) return res.status(404).json({ error: "Staff not found" });
    const allowed = [
      "name", "phone", "email", "role", "branchId", "franchiseeId", "monthlySalary",
      "joiningDate", "localAddress", "permanentAddress", "guardianName", "guardianPhone",
      "aadhaar", "pan", "bankAccountName", "bankAccountNumber", "bankIfsc",
      "bankPassbookUrl", "agreementUrl", "isActive",
    ];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined && !["phone", "email", "guardianPhone"].includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    const emailField = applyOptionalEmailField(req.body, "email", updateData);
    if (!emailField.ok) return res.status(400).json({ error: emailField.error });
    const guardianField = applyOptionalMobileField(req.body, "guardianPhone", updateData);
    if (!guardianField.ok) return res.status(400).json({ error: guardianField.error });

    if (updateData.phone !== undefined || updateData.email !== undefined) {
      const identityCheck = await assertContactIdentityAvailable(
        typeof updateData.phone === "string" ? updateData.phone : existingStaff.phone,
        updateData.email !== undefined ? updateData.email : existingStaff.email,
        { entity: "staff", id },
      );
      if (!identityCheck.ok) return res.status(identityCheck.status).json(identityCheck.body);
      if (typeof updateData.phone === "string") updateData.phone = identityCheck.identity.phone;
      if (updateData.email !== undefined) updateData.email = identityCheck.identity.email;
    }

    const [staff] = await db.update(staffTable).set(updateData).where(eq(staffTable.id, id)).returning();
    return res.json(staff);
  } catch (err) {
    req.log.error({ err }, "Update staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/verify", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { action, notes } = req.body as { action: "verified" | "rejected"; notes?: string };
    if (!["verified", "rejected"].includes(action)) {
      return res.status(400).json({ error: "action must be 'verified' or 'rejected'" });
    }
    const [staff] = await db.update(staffTable).set({
      verificationStatus: action,
      verificationNotes: notes,
      verifiedAt: action === "verified" ? new Date() : null,
      updatedAt: new Date(),
    }).where(eq(staffTable.id, id)).returning();
    return res.json(staff);
  } catch (err) {
    req.log.error({ err }, "Verify staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/create-account", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    let staffMember = await loadStaffInScope(req, id);
    if (!staffMember) return res.status(404).json({ error: "Staff not found" });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    if (staffMember.userId) return res.status(400).json({ error: "Account already exists" });
    if (staffMember.verificationStatus === "rejected" || staffMember.verificationStatus === "suspended") {
      return res.status(400).json({ error: "Staff must be verified before creating an account" });
    }

    if (staffMember.verificationStatus !== "verified") {
      const [verified] = await db.update(staffTable).set({
        verificationStatus: "verified",
        verifiedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(staffTable.id, id)).returning();
      if (verified) staffMember = verified;
    }

    const result = await createStaffLoginAccount(staffMember, password);
    return res.json({ message: "Account created", ...result });
  } catch (err) {
    if (err instanceof Error && err.message.includes("already exists")) {
      return res.status(400).json({ error: err.message });
    }
    req.log.error({ err }, "Create staff account error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/performance", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const staff = await loadStaffInScope(req, id);
    if (!staff) return res.status(404).json({ error: "Staff not found" });
    const { month } = req.query as Record<string, string>;
    const monthFilter = month || new Date().toISOString().slice(0, 7);

    const [jobsResult, ratingResult, attendanceResult, revenueResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(bookingsTable)
        .where(and(
          eq(bookingsTable.staffId, id),
          eq(bookingsTable.status, "completed"),
          sql`TO_CHAR(${bookingsTable.scheduledDate}::date, 'YYYY-MM') = ${monthFilter}`,
        )),
      db.select({ avg: sql<number>`avg(rating)` }).from(bookingsTable)
        .where(and(eq(bookingsTable.staffId, id), sql`rating IS NOT NULL`)),
      db.select({ count: sql<number>`count(*)` }).from(attendanceTable)
        .where(and(
          eq(attendanceTable.staffId, id),
          eq(attendanceTable.status, "present"),
          sql`TO_CHAR(${attendanceTable.date}::date, 'YYYY-MM') = ${monthFilter}`,
        )),
      db.select({ total: sql<number>`sum(amount)` }).from(bookingsTable)
        .where(and(
          eq(bookingsTable.staffId, id),
          eq(bookingsTable.status, "completed"),
          sql`TO_CHAR(${bookingsTable.scheduledDate}::date, 'YYYY-MM') = ${monthFilter}`,
        )),
    ]);

    const jobsCompleted = Number(jobsResult[0]?.count ?? 0);
    const averageRating = Number(ratingResult[0]?.avg ?? 0);
    const attendanceDays = Number(attendanceResult[0]?.count ?? 0);
    const revenueGenerated = Number(revenueResult[0]?.total ?? 0);
    const efficiencyScore = Math.round((jobsCompleted * 0.4 + averageRating * 10 * 0.4 + attendanceDays * 0.2) * 10) / 10;

    return res.json({ staffId: id, staffName: staff.name, jobsCompleted, revenueGenerated, averageRating, attendanceDays, efficiencyScore, month: monthFilter });
  } catch (err) {
    req.log.error({ err }, "Staff performance error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/attendance", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { month } = req.query as Record<string, string>;
    const monthFilter = month || new Date().toISOString().slice(0, 7);
    const data = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.staffId, id), sql`TO_CHAR(${attendanceTable.date}::date, 'YYYY-MM') = ${monthFilter}`))
      .orderBy(desc(attendanceTable.date));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Staff attendance error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff/:id/attendance", async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, staffId))) return res.status(404).json({ error: "Staff not found" });
    const { date, status, checkInTime, checkOutTime, notes } = req.body;
    if (!date || !status) return res.status(400).json({ error: "date and status are required" });

    const isSelfCheckIn =
      req.user?.role === "staff"
      && req.user.staffId === staffId
      && ["present", "late"].includes(status);

    if (isSelfCheckIn) {
      try {
        const location = parseStaffLocation(req.body as Record<string, unknown>, { required: true });
        await recordStaffLocation({
          staffId,
          action: "attendance",
          latitude: location!.latitude,
          longitude: location!.longitude,
          accuracy: location!.accuracy,
          metadata: { status, date },
        });
      } catch (locErr) {
        const handled = handleLocationError(locErr);
        if (handled) return res.status(handled.status).json(handled.body);
        throw locErr;
      }
    }

    const [attendance] = await db.insert(attendanceTable).values({ staffId, date, status, checkInTime, checkOutTime, notes }).returning();
    return res.status(201).json(attendance);
  } catch (err) {
    req.log.error({ err }, "Mark attendance error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/staff/:id/location-logs", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
    const { month, limit: limitStr } = req.query as Record<string, string>;
    const monthFilter = month || new Date().toISOString().slice(0, 7);
    const rowLimit = Math.min(parseInt(limitStr ?? "100", 10) || 100, 500);

    const data = await db.select({
      id: staffLocationLogsTable.id,
      staffId: staffLocationLogsTable.staffId,
      bookingId: staffLocationLogsTable.bookingId,
      action: staffLocationLogsTable.action,
      latitude: staffLocationLogsTable.latitude,
      longitude: staffLocationLogsTable.longitude,
      accuracyMeters: staffLocationLogsTable.accuracyMeters,
      geoFenceVerified: staffLocationLogsTable.geoFenceVerified,
      geoFenceRadiusMeters: staffLocationLogsTable.geoFenceRadiusMeters,
      distanceMeters: staffLocationLogsTable.distanceMeters,
      targetLatitude: staffLocationLogsTable.targetLatitude,
      targetLongitude: staffLocationLogsTable.targetLongitude,
      recordedAt: staffLocationLogsTable.recordedAt,
      metadata: staffLocationLogsTable.metadata,
    }).from(staffLocationLogsTable)
      .where(and(
        eq(staffLocationLogsTable.staffId, id),
        sql`TO_CHAR(${staffLocationLogsTable.recordedAt}::date, 'YYYY-MM') = ${monthFilter}`,
      ))
      .orderBy(desc(staffLocationLogsTable.recordedAt))
      .limit(rowLimit);

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "Staff location logs error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
