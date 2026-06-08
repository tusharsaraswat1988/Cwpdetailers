import { Router } from "express";
import { db } from "@workspace/db";
import { expensesTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope } from "../middlewares/tenantScope";

const router = Router();

const SCOPE_COLS = {
  companyCol: expensesTable.companyId,
  branchCol: expensesTable.branchId,
  franchiseeCol: expensesTable.franchiseeId,
};

router.get("/expenses", async (req, res) => {
  try {
    const { category, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (category) conditions.push(eq(expensesTable.category, category as (typeof expensesTable.category)["_"]["data"]));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select().from(expensesTable).where(where).orderBy(desc(expensesTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(expensesTable).where(where),
    ]);
    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List expenses error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/expenses", async (req, res) => {
  try {
    const { category, amount, description, vendor, receiptUrl, paidBy, expenseDate } = req.body;
    if (!category || !amount || !expenseDate) {
      return res.status(400).json({ error: "category, amount, expenseDate are required" });
    }
    const values = tenantStamp(req, { category, amount: amount.toString(), description, vendor, receiptUrl, paidBy, expenseDate });
    const [exp] = await db.insert(expensesTable).values(values as typeof expensesTable.$inferInsert).returning();
    return res.status(201).json(exp);
  } catch (err) {
    req.log.error({ err }, "Create expense error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/expenses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [exp] = await db.select().from(expensesTable).where(eq(expensesTable.id, id)).limit(1);
    if (!exp || !rowInScope(req, exp)) return res.status(404).json({ error: "Expense not found" });
    return res.json(exp);
  } catch (err) {
    req.log.error({ err }, "Get expense error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/expenses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(expensesTable).where(eq(expensesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Expense not found" });
    const { category, amount, description, vendor, receiptUrl, paidBy, expenseDate } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = amount.toString();
    if (description !== undefined) updateData.description = description;
    if (vendor !== undefined) updateData.vendor = vendor;
    if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;
    if (paidBy !== undefined) updateData.paidBy = paidBy;
    if (expenseDate !== undefined) updateData.expenseDate = expenseDate;
    const [exp] = await db.update(expensesTable).set(updateData).where(eq(expensesTable.id, id)).returning();
    return res.json(exp);
  } catch (err) {
    req.log.error({ err }, "Update expense error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
