import { Router, type Request } from "express";
import { db } from "@workspace/db";
import { franchiseesTable, branchesTable, usersTable, staffTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
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
  companyCol: franchiseesTable.companyId,
  branchCol: franchiseesTable.branchId,
  franchiseeCol: franchiseesTable.id,
};

router.get("/franchisees", async (req, res) => {
  try {
    const { status, branchId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (status) conditions.push(eq(franchiseesTable.status, status as (typeof franchiseesTable.status)["_"]["data"]));
    if (branchId) conditions.push(eq(franchiseesTable.branchId, parseInt(branchId)));

    const data = await db.select({
      id: franchiseesTable.id, userId: franchiseesTable.userId,
      branchId: franchiseesTable.branchId, branchName: branchesTable.name,
      name: franchiseesTable.name, phone: franchiseesTable.phone, email: franchiseesTable.email,
      secondaryPhone: franchiseesTable.secondaryPhone,
      currentAddress: franchiseesTable.currentAddress, permanentAddress: franchiseesTable.permanentAddress,
      aadhaar: franchiseesTable.aadhaar, pan: franchiseesTable.pan,
      rentAgreementUrl: franchiseesTable.rentAgreementUrl,
      franchiseeAgreementUrl: franchiseesTable.franchiseeAgreementUrl,
      tenureStartDate: franchiseesTable.tenureStartDate, tenureEndDate: franchiseesTable.tenureEndDate,
      finalAmountAgreed: franchiseesTable.finalAmountAgreed,
      amountDeposited: franchiseesTable.amountDeposited, dueAmount: franchiseesTable.dueAmount,
      bankAccountName: franchiseesTable.bankAccountName,
      bankAccountNumber: franchiseesTable.bankAccountNumber,
      bankIfsc: franchiseesTable.bankIfsc, bankName: franchiseesTable.bankName,
      status: franchiseesTable.status, notes: franchiseesTable.notes,
      createdAt: franchiseesTable.createdAt,
      staffCount: sql<number>`(SELECT COUNT(*) FROM staff s WHERE s.franchisee_id = ${franchiseesTable.id})`,
    }).from(franchiseesTable)
      .leftJoin(branchesTable, eq(franchiseesTable.branchId, branchesTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(franchiseesTable.createdAt));

    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List franchisees error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/franchisees", async (req, res) => {
  try {
    const {
      name, phone, email, secondaryPhone, branchId,
      currentAddress, permanentAddress, aadhaar, pan,
      rentAgreementUrl, franchiseeAgreementUrl,
      tenureStartDate, tenureEndDate,
      finalAmountAgreed, amountDeposited,
      bankAccountName, bankAccountNumber, bankIfsc, bankName,
      notes,
    } = req.body;

    if (!name) return res.status(400).json({ error: "name is required" });

    const phoneResult = parseRequiredMobile(phone);
    if (!phoneResult.ok) return res.status(400).json({ error: phoneResult.error });

    const emailResult = parseOptionalEmail(email);
    if (!emailResult.ok) return res.status(400).json({ error: emailResult.error });

    const secondaryResult = parseOptionalMobile(secondaryPhone);
    if (!secondaryResult.ok) return res.status(400).json({ error: secondaryResult.error });

    const due = finalAmountAgreed && amountDeposited
      ? (parseFloat(finalAmountAgreed) - parseFloat(amountDeposited)).toString()
      : "0";

    // Strip franchiseeId from stamp (creating a franchisee shouldn't pin itself)
    const stamped = tenantStamp(req, {
      name, phone: phoneResult.value, email: emailResult.value, secondaryPhone: secondaryResult.value,
      branchId: branchId ? parseInt(branchId) : undefined,
      currentAddress, permanentAddress, aadhaar, pan,
      rentAgreementUrl, franchiseeAgreementUrl,
      tenureStartDate, tenureEndDate,
      finalAmountAgreed: finalAmountAgreed?.toString(),
      amountDeposited: amountDeposited?.toString() ?? "0",
      dueAmount: due,
      bankAccountName, bankAccountNumber, bankIfsc, bankName,
      notes, status: "active" as const,
    });
    delete (stamped as { franchiseeId?: number }).franchiseeId;

    const [franchisee] = await db.insert(franchiseesTable).values(stamped as typeof franchiseesTable.$inferInsert).returning();
    return res.status(201).json(franchisee);
  } catch (err) {
    req.log.error({ err }, "Create franchisee error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function loadFranchiseeInScope(req: Request, id: number) {
  const [f] = await db.select().from(franchiseesTable).where(eq(franchiseesTable.id, id)).limit(1);
  if (!f) return null;
  if (!rowInScope(req, { ...f, franchiseeId: f.id })) return null;
  return f;
}

router.get("/franchisees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadFranchiseeInScope(req, id))) return res.status(404).json({ error: "Franchisee not found" });

    const [franchisee] = await db.select({
      id: franchiseesTable.id, userId: franchiseesTable.userId,
      branchId: franchiseesTable.branchId, branchName: branchesTable.name,
      name: franchiseesTable.name, phone: franchiseesTable.phone, email: franchiseesTable.email,
      secondaryPhone: franchiseesTable.secondaryPhone,
      currentAddress: franchiseesTable.currentAddress, permanentAddress: franchiseesTable.permanentAddress,
      aadhaar: franchiseesTable.aadhaar, pan: franchiseesTable.pan,
      rentAgreementUrl: franchiseesTable.rentAgreementUrl,
      franchiseeAgreementUrl: franchiseesTable.franchiseeAgreementUrl,
      tenureStartDate: franchiseesTable.tenureStartDate, tenureEndDate: franchiseesTable.tenureEndDate,
      finalAmountAgreed: franchiseesTable.finalAmountAgreed,
      amountDeposited: franchiseesTable.amountDeposited, dueAmount: franchiseesTable.dueAmount,
      bankAccountName: franchiseesTable.bankAccountName,
      bankAccountNumber: franchiseesTable.bankAccountNumber,
      bankIfsc: franchiseesTable.bankIfsc, bankName: franchiseesTable.bankName,
      status: franchiseesTable.status, notes: franchiseesTable.notes,
      createdAt: franchiseesTable.createdAt,
    }).from(franchiseesTable)
      .leftJoin(branchesTable, eq(franchiseesTable.branchId, branchesTable.id))
      .where(eq(franchiseesTable.id, id));

    const staff = await db.select({
      id: staffTable.id, name: staffTable.name, phone: staffTable.phone,
      role: staffTable.role, verificationStatus: staffTable.verificationStatus,
    }).from(staffTable).where(eq(staffTable.franchiseeId, id));

    return res.json({ ...franchisee, staff });
  } catch (err) {
    req.log.error({ err }, "Get franchisee error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/franchisees/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!(await loadFranchiseeInScope(req, id))) return res.status(404).json({ error: "Franchisee not found" });
    const allowed = [
      "name", "phone", "email", "secondaryPhone", "branchId", "currentAddress",
      "permanentAddress", "aadhaar", "pan", "rentAgreementUrl", "franchiseeAgreementUrl",
      "tenureStartDate", "tenureEndDate", "finalAmountAgreed", "amountDeposited",
      "dueAmount", "bankAccountName", "bankAccountNumber", "bankIfsc", "bankName",
      "status", "notes",
    ];
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of allowed) {
      if (req.body[key] !== undefined && !["phone", "email", "secondaryPhone"].includes(key)) {
        updateData[key] = req.body[key];
      }
    }

    const phoneField = applyMobileField(req.body, "phone", updateData);
    if (!phoneField.ok) return res.status(400).json({ error: phoneField.error });
    const emailField = applyOptionalEmailField(req.body, "email", updateData);
    if (!emailField.ok) return res.status(400).json({ error: emailField.error });
    const secondaryField = applyOptionalMobileField(req.body, "secondaryPhone", updateData);
    if (!secondaryField.ok) return res.status(400).json({ error: secondaryField.error });
    const [franchisee] = await db.update(franchiseesTable).set(updateData).where(eq(franchiseesTable.id, id)).returning();
    return res.json(franchisee);
  } catch (err) {
    req.log.error({ err }, "Update franchisee error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/franchisees/:id/create-account", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const franchisee = await loadFranchiseeInScope(req, id);
    if (!franchisee) return res.status(404).json({ error: "Franchisee not found" });

    const { password } = req.body;
    if (!password) return res.status(400).json({ error: "password is required" });
    if (franchisee.userId) return res.status(400).json({ error: "Account already exists" });

    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      name: franchisee.name,
      phone: franchisee.phone,
      email: franchisee.email ?? undefined,
      passwordHash,
      role: "franchisee",
      branchId: franchisee.branchId ?? undefined,
      companyId: franchisee.companyId ?? undefined,
      franchiseeId: franchisee.id,
    }).returning();

    await db.update(franchiseesTable).set({ userId: user.id, updatedAt: new Date() }).where(eq(franchiseesTable.id, id));
    return res.json({ message: "Account created", userId: user.id, phone: user.phone });
  } catch (err) {
    req.log.error({ err }, "Create franchisee account error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
