import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { staffTable, attendanceTable, bookingsTable, branchesTable, usersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";
import { hashPassword } from "../lib/passwords";
import {
  parseRequiredMobile,
  parseOptionalEmail,
  parseOptionalMobile,
  applyMobileField,
  applyOptionalEmailField,
  applyOptionalMobileField,
} from "../lib/contactFields";

const router = Router();

const SCOPE_COLS = {
  companyCol: staffTable.companyId,
  branchCol: staffTable.branchId,
  franchiseeCol: staffTable.franchiseeId,
  staffCol: staffTable.id,
};

router.get("/staff", async (req, res) => {
  try {
    const { branchId, role, isActive, verificationStatus, franchiseeId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (branchId) conditions.push(eq(staffTable.branchId, parseInt(branchId)));
    if (role) conditions.push(eq(staffTable.role, role as (typeof staffTable.role)["_"]["data"]));
    if (isActive !== undefined) conditions.push(eq(staffTable.isActive, isActive === "true"));
    if (verificationStatus) conditions.push(eq(staffTable.verificationStatus, verificationStatus as (typeof staffTable.verificationStatus)["_"]["data"]));
    if (franchiseeId) conditions.push(eq(staffTable.franchiseeId, parseInt(franchiseeId)));

    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select({
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

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/staff", async (req, res) => {
  try {
    const {
      name, phone, email, role, branchId, franchiseeId,
      monthlySalary, joiningDate, localAddress, permanentAddress,
      guardianName, guardianPhone, aadhaar, pan,
      bankAccountName, bankAccountNumber, bankIfsc, bankPassbookUrl, agreementUrl,
    } = req.body;
    if (!name || !role || !branchId) {
      return res.status(400).json({ error: "name, role, and branchId are required" });
    }

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const guardianPhoneResult = parseOptionalMobile(guardianPhone);
    if (!guardianPhoneResult.ok) return res.status(400).json({ error: guardianPhoneResult.error });

    const values = tenantStamp(req, {
      name, phone: phoneResult.value, email: emailResult.value, role,
      branchId: parseInt(branchId),
      franchiseeId: franchiseeId ? parseInt(franchiseeId) : undefined,
      monthlySalary: monthlySalary?.toString(),
      joiningDate, localAddress, permanentAddress,
      guardianName, guardianPhone: guardianPhoneResult.value, aadhaar, pan,
      bankAccountName, bankAccountNumber, bankIfsc,
      bankPassbookUrl, agreementUrl,
      verificationStatus: "pending" as const,
    });
    const [staff] = await db.insert(staffTable).values(values as typeof staffTable.$inferInsert).returning();
    return res.status(201).json(staff);
  } catch (err) {
    req.log.error({ err }, "Create staff error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function loadStaffInScope(req: Request, id: number) {
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, id)).limit(1);
  if (!staff) return null;
  if (!rowInScope(req, { ...staff, staffId: staff.id })) return null;
  return staff;
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
    if (!(await loadStaffInScope(req, id))) return res.status(404).json({ error: "Staff not found" });
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
    const staffMember = await loadStaffInScope(req, id);
    if (!staffMember) return res.status(404).json({ error: "Staff not found" });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    if (staffMember.userId) return res.status(400).json({ error: "Account already exists" });
    if (staffMember.verificationStatus !== "verified") {
      return res.status(400).json({ error: "Staff must be verified before creating an account" });
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

    await db.update(staffTable).set({ userId: user.id, updatedAt: new Date() }).where(eq(staffTable.id, id));

    return res.json({ message: "Account created", userId: user.id, phone: user.phone });
  } catch (err) {
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
    const [attendance] = await db.insert(attendanceTable).values({ staffId, date, status, checkInTime, checkOutTime, notes }).returning();
    return res.status(201).json(attendance);
  } catch (err) {
    req.log.error({ err }, "Mark attendance error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
