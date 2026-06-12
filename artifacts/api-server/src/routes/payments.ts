import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, paymentsTable, customersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { computeGst } from "../lib/gst";

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
  // payments inherits franchisee scope transitively via the customer/invoice
  // rather than its own column (intentional — payments are settled centrally).
  customerCol: paymentsTable.customerId,
};

let invoiceCounter = 1000;
function generateInvoiceNumber(): string {
  return `CWP-${new Date().getFullYear()}-${String(++invoiceCounter).padStart(4, '0')}`;
}

router.get("/invoices", async (req, res) => {
  try {
    const { customerId, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, INVOICE_SCOPE)];
    if (customerId) conditions.push(eq(invoicesTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(invoicesTable.status, status as (typeof invoicesTable.status)["_"]["data"]));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
        customerId: invoicesTable.customerId, customerName: customersTable.name,
        subscriptionId: invoicesTable.subscriptionId, bookingId: invoicesTable.bookingId,
        items: invoicesTable.items, subtotal: invoicesTable.subtotal,
        tax: invoicesTable.tax, gstAmount: invoicesTable.gstAmount, discount: invoicesTable.discount,
        totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount,
        dueAmount: invoicesTable.dueAmount, balanceDue: invoicesTable.balanceDue,
        status: invoicesTable.status, gstin: invoicesTable.gstin, currency: invoicesTable.currency,
        dueDate: invoicesTable.dueDate, issuedAt: invoicesTable.issuedAt,
        paidAt: invoicesTable.paidAt, createdAt: invoicesTable.createdAt,
      }).from(invoicesTable)
        .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
        .where(where).orderBy(desc(invoicesTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(invoicesTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List invoices error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { customerId, subscriptionId, bookingId, items, discount, dueDate } = req.body;
    if (!customerId || !items?.length) return res.status(400).json({ error: "customerId and items required" });

    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const subtotal = items.reduce((s: number, item: { total: number }) => s + item.total, 0);
    const disc = discount || 0;
    const { gst, total } = computeGst(subtotal - disc);

    const values = tenantStamp(req, {
      invoiceNumber: generateInvoiceNumber(),
      customerId, subscriptionId, bookingId, items,
      subtotal: subtotal.toString(), tax: "0", gstAmount: gst.toString(),
      discount: disc.toString(), totalAmount: total.toString(),
      paidAmount: "0", dueAmount: total.toString(), balanceDue: total.toString(),
      status: "draft" as const, dueDate,
      currency: "INR",
      issuedAt: new Date(),
    });

    const [invoice] = await db.insert(invoicesTable).values(values as typeof invoicesTable.$inferInsert).returning();
    return res.status(201).json(invoice);
  } catch (err) {
    req.log.error({ err }, "Create invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.select({
      id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId, customerName: customersTable.name,
      subscriptionId: invoicesTable.subscriptionId, bookingId: invoicesTable.bookingId,
      items: invoicesTable.items, subtotal: invoicesTable.subtotal,
      tax: invoicesTable.tax, gstAmount: invoicesTable.gstAmount, discount: invoicesTable.discount,
      totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount,
      dueAmount: invoicesTable.dueAmount, balanceDue: invoicesTable.balanceDue,
      status: invoicesTable.status, gstin: invoicesTable.gstin, currency: invoicesTable.currency,
      dueDate: invoicesTable.dueDate, issuedAt: invoicesTable.issuedAt,
      paidAt: invoicesTable.paidAt, createdAt: invoicesTable.createdAt,
      companyId: invoicesTable.companyId, branchId: invoicesTable.branchId,
      franchiseeId: invoicesTable.franchiseeId,
    }).from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .where(eq(invoicesTable.id, id));
    if (!invoice || !rowInScope(req, invoice)) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    return res.json(invoice);
  } catch (err) {
    req.log.error({ err }, "Get invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) {
      return res.status(404).json({ error: "Invoice not found" });
    }
    const { status, paidAmount, paidAt } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (paidAmount !== undefined) {
      updateData.paidAmount = paidAmount.toString();
      const due = parseFloat(existing.totalAmount) - parseFloat(paidAmount.toString());
      const balanceDue = Math.max(0, due);
      updateData.dueAmount = due.toString();
      updateData.balanceDue = balanceDue.toString();
      if (due <= 0) { updateData.status = "paid"; updateData.paidAt = new Date(); }
    }
    if (paidAt !== undefined) updateData.paidAt = new Date(paidAt);
    const [invoice] = await db.update(invoicesTable).set(updateData).where(eq(invoicesTable.id, id)).returning();
    return res.json(invoice);
  } catch (err) {
    req.log.error({ err }, "Update invoice error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/payments", async (req, res) => {
  try {
    const { customerId, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, PAYMENT_SCOPE)];
    if (customerId) conditions.push(eq(paymentsTable.customerId, parseInt(customerId)));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: paymentsTable.id, customerId: paymentsTable.customerId,
        customerName: customersTable.name, invoiceId: paymentsTable.invoiceId,
        amount: paymentsTable.amount, method: paymentsTable.method,
        transactionId: paymentsTable.transactionId, status: paymentsTable.status,
        notes: paymentsTable.notes, receivedByStaffId: paymentsTable.receivedByStaffId,
        receivedAt: paymentsTable.receivedAt, createdAt: paymentsTable.createdAt,
      }).from(paymentsTable)
        .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
        .where(where).orderBy(desc(paymentsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(paymentsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List payments error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments", async (req, res) => {
  try {
    const { customerId, invoiceId, amount, method, transactionId, notes, receivedByStaffId } = req.body;
    if (!customerId || !amount || !method) return res.status(400).json({ error: "customerId, amount, method are required" });

    const customerRow = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customerRow) return res.status(404).json({ error: "Customer not found" });

    // If linking to an invoice, the invoice must be in the caller's scope.
    let invoiceRow = null;
    if (invoiceId) {
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
      if (!inv || !rowInScope(req, inv)) return res.status(404).json({ error: "Invoice not found" });
      invoiceRow = inv;
    }

    const values = tenantStamp(req, {
      customerId, invoiceId, amount: amount.toString(), method, transactionId, notes, receivedByStaffId,
      receivedAt: new Date(),
      status: "completed" as const,
    });
    const [payment] = await db.insert(paymentsTable).values(values as typeof paymentsTable.$inferInsert).returning();

    if (invoiceRow) {
      const newPaid = parseFloat(invoiceRow.paidAmount) + parseFloat(amount.toString());
      const newDue = parseFloat(invoiceRow.totalAmount) - newPaid;
      const balanceDue = Math.max(0, newDue);
      await db.update(invoicesTable).set({
        paidAmount: newPaid.toString(),
        dueAmount: newDue.toString(),
        balanceDue: balanceDue.toString(),
        status: balanceDue <= 0 ? "paid" : invoiceRow.status,
        paidAt: balanceDue <= 0 ? new Date() : invoiceRow.paidAt,
      }).where(eq(invoicesTable.id, invoiceRow.id));
    }

    return res.status(201).json(payment);
  } catch (err) {
    req.log.error({ err }, "Record payment error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

import PDFDocument from "pdfkit";

router.get("/invoices/:id/pdf", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [inv] = await db.select({
      id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
      customerId: invoicesTable.customerId, customerName: customersTable.name,
      items: invoicesTable.items, subtotal: invoicesTable.subtotal,
      tax: invoicesTable.tax, gstAmount: invoicesTable.gstAmount, discount: invoicesTable.discount,
      totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount,
      dueAmount: invoicesTable.dueAmount, balanceDue: invoicesTable.balanceDue,
      status: invoicesTable.status, gstin: invoicesTable.gstin, currency: invoicesTable.currency,
      dueDate: invoicesTable.dueDate, issuedAt: invoicesTable.issuedAt,
      paidAt: invoicesTable.paidAt, createdAt: invoicesTable.createdAt,
      companyId: invoicesTable.companyId, branchId: invoicesTable.branchId,
      franchiseeId: invoicesTable.franchiseeId,
    }).from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .where(eq(invoicesTable.id, id));
    if (!inv || !rowInScope(req, inv)) return res.status(404).json({ error: "Invoice not found" });

    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const filename = `${inv.invoiceNumber?.replace(/\//g, '-') ?? 'invoice'}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    doc.pipe(res);

    // Header
    doc.fontSize(18).font("Helvetica-Bold").text("CWP DETAILERS", 40, 40);
    doc.fontSize(10).font("Helvetica").text("GST Reg: 09ABCDE1234F1Z5 | GST: 18% extra on all prices", 40, 62);
    doc.fontSize(12).font("Helvetica-Bold").text(`TAX INVOICE`, 40, 82);
    doc.fontSize(10).font("Helvetica").text(`Invoice #: ${inv.invoiceNumber ?? ''}`, 40, 98);
    doc.fontSize(10).font("Helvetica").text(`Date: ${inv.issuedAt ? new Date(inv.issuedAt).toLocaleDateString('en-IN') : '-'}`, 40, 112);
    if (inv.gstin) doc.fontSize(10).font("Helvetica").text(`Customer GSTIN: ${inv.gstin}`, 40, 126);
    if (inv.customerName) doc.fontSize(10).font("Helvetica").text(`Customer: ${inv.customerName}`, 40, inv.gstin ? 140 : 126);

    // Line items
    const items = Array.isArray(inv.items) ? inv.items as { description: string; quantity: number; unitPrice: number; total: number }[] : [];
    let y = 180;
    doc.fontSize(10).font("Helvetica-Bold");
    doc.text("Item", 40, y, { width: 180 });
    doc.text("Qty", 230, y, { width: 50, align: "right" });
    doc.text("Rate", 290, y, { width: 80, align: "right" });
    doc.text("Amount", 380, y, { width: 80, align: "right" });
    y += 18;
    doc.fontSize(10).font("Helvetica");
    for (const item of items) {
      doc.text(item.description || "", 40, y, { width: 180 });
      doc.text(String(item.quantity || 0), 230, y, { width: 50, align: "right" });
      doc.text(`\u20b9${(item.unitPrice || 0).toFixed(2)}`, 290, y, { width: 80, align: "right" });
      doc.text(`\u20b9${(item.total || 0).toFixed(2)}`, 380, y, { width: 80, align: "right" });
      y += 18;
    }

    // Totals
    y += 20;
    doc.fontSize(10).font("Helvetica-Bold").text(`Subtotal: \u20b9${parseFloat(inv.subtotal ?? '0').toFixed(2)}`, 320, y, { width: 140, align: "right" });
    y += 16;
    if (inv.discount && parseFloat(inv.discount) > 0) {
      doc.fontSize(10).font("Helvetica").text(`Discount: -\u20b9${parseFloat(inv.discount).toFixed(2)}`, 320, y, { width: 140, align: "right" });
      y += 16;
    }
    doc.fontSize(10).font("Helvetica").text(`GST (18%): \u20b9${parseFloat(inv.gstAmount ?? '0').toFixed(2)}`, 320, y, { width: 140, align: "right" });
    y += 16;
    doc.fontSize(12).font("Helvetica-Bold").text(`Total: \u20b9${parseFloat(inv.totalAmount ?? '0').toFixed(2)}`, 320, y, { width: 140, align: "right" });
    y += 16;
    if (inv.balanceDue && parseFloat(inv.balanceDue) > 0) {
      doc.fontSize(10).font("Helvetica").text(`Balance Due: \u20b9${parseFloat(inv.balanceDue).toFixed(2)}`, 320, y, { width: 140, align: "right" });
    }
    doc.end();
    return;
  } catch (err) {
    req.log.error({ err }, "PDF generation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/payments/:id/reverse", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [payment] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id)).limit(1);
    if (!payment || !rowInScope(req, payment)) return res.status(404).json({ error: "Payment not found" });
    if (payment.status === "reversed") return res.status(400).json({ error: "Payment already reversed" });

    const [reversal] = await db.insert(paymentsTable).values(tenantStamp(req, {
      customerId: payment.customerId,
      invoiceId: payment.invoiceId,
      amount: `-${payment.amount}`,
      method: payment.method,
      transactionId: payment.transactionId,
      notes: `Reversal of payment #${payment.id}`,
      status: "reversed" as const,
      reversalOfId: payment.id,
    })).returning();

    await db.update(paymentsTable).set({ status: "reversed" }).where(eq(paymentsTable.id, id));

    if (payment.invoiceId) {
      const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, payment.invoiceId)).limit(1);
      if (inv) {
        const newPaid = Math.max(0, parseFloat(inv.paidAmount) - parseFloat(payment.amount));
        const newDue = parseFloat(inv.totalAmount) - newPaid;
        const balanceDue = Math.max(0, newDue);
        await db.update(invoicesTable).set({
          paidAmount: newPaid.toString(),
          dueAmount: newDue.toString(),
          balanceDue: balanceDue.toString(),
          status: balanceDue <= 0 ? "paid" : (inv.status === "paid" ? "draft" : inv.status),
          paidAt: balanceDue <= 0 ? inv.paidAt : null,
        }).where(eq(invoicesTable.id, inv.id));
      }
    }

    return res.json({ reversal, original: { id: payment.id, status: "reversed" } });
  } catch (err) {
    req.log.error({ err }, "Payment reversal error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
