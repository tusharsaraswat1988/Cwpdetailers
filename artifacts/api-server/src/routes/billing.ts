import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, paymentsTable, expensesTable, customersTable } from "@workspace/db";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { tenantFilters } from "../middlewares/tenantScope";

const router = Router();

const INVOICE_SCOPE = {
  companyCol: invoicesTable.companyId,
  branchCol: invoicesTable.branchId,
  franchiseeCol: invoicesTable.franchiseeId,
  customerCol: invoicesTable.customerId,
};

const PAYMENT_SCOPE = {
  companyCol: paymentsTable.companyId,
  branchCol: paymentsTable.branchId,
  customerCol: paymentsTable.customerId,
};

const EXPENSE_SCOPE = {
  companyCol: expensesTable.companyId,
  branchCol: expensesTable.branchId,
  franchiseeCol: expensesTable.franchiseeId,
};

router.get("/billing/health", async (req, res) => {
  try {
    const invWhere = and(...tenantFilters(req, INVOICE_SCOPE));
    const payWhere = and(...tenantFilters(req, PAYMENT_SCOPE));
    const expWhere = and(...tenantFilters(req, EXPENSE_SCOPE));
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);

    const [collected, dues, expenses] = await Promise.all([
      db.select({ total: sql<string>`coalesce(sum(${paymentsTable.amount}),0)` })
        .from(paymentsTable).where(and(payWhere, gte(paymentsTable.createdAt, firstOfMonth))),
      db.select({ total: sql<string>`coalesce(sum(${invoicesTable.balanceDue}),0)` })
        .from(invoicesTable).where(and(invWhere, sql`${invoicesTable.balanceDue} > 0`)),
      db.select({ total: sql<string>`coalesce(sum(${expensesTable.amount}),0)` })
        .from(expensesTable).where(and(expWhere, gte(expensesTable.createdAt, firstOfMonth))),
    ]);

    const collectedAmt = parseFloat(collected[0]?.total ?? "0");
    const duesAmt = parseFloat(dues[0]?.total ?? "0");
    const expensesAmt = parseFloat(expenses[0]?.total ?? "0");
    const net = collectedAmt - expensesAmt;

    return res.json({
      collectedThisMonth: collectedAmt,
      duesOutstanding: duesAmt,
      expensesThisMonth: expensesAmt,
      net,
    });
  } catch (err) {
    req.log.error({ err }, "Billing health error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/billing/dues", async (req, res) => {
  try {
    const { limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const invWhere = and(
      ...tenantFilters(req, INVOICE_SCOPE),
      sql`${invoicesTable.balanceDue} > 0`,
    );

    const rows = await db.select({
      customerId: invoicesTable.customerId,
      customerName: customersTable.name,
      totalDue: sql<string>`sum(${invoicesTable.balanceDue})`,
      invoiceCount: sql<number>`count(${invoicesTable.id})`,
    }).from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .where(invWhere)
      .groupBy(invoicesTable.customerId, customersTable.name)
      .orderBy(sql`sum(${invoicesTable.balanceDue}) desc`)
      .limit(lim).offset(off);

    return res.json({
      data: rows.map(r => ({
        customerId: r.customerId,
        customerName: r.customerName,
        totalDue: parseFloat(r.totalDue),
        invoiceCount: Number(r.invoiceCount),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Billing dues error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
