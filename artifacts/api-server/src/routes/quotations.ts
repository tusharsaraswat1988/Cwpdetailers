import { Router } from "express";
import { db } from "@workspace/db";
import { quotationsTable, customersTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import { computeGst } from "../lib/gst";
import { createInvoiceFromQuotation } from "../lib/billing/invoiceService";

const router = Router();

const SCOPE_COLS = {
  companyCol: quotationsTable.companyId,
  branchCol: quotationsTable.branchId,
  franchiseeCol: quotationsTable.franchiseeId,
  customerCol: quotationsTable.customerId,
};

let qCounter = 1000;
function generateQuotationNumber(): string {
  return `Q-${new Date().getFullYear()}-${String(++qCounter).padStart(4, '0')}`;
}

const qSelect = {
  id: quotationsTable.id,
  quotationNumber: quotationsTable.quotationNumber,
  customerId: quotationsTable.customerId,
  customerName: customersTable.name,
  leadId: quotationsTable.leadId,
  bookingId: quotationsTable.bookingId,
  items: quotationsTable.items,
  subtotal: quotationsTable.subtotal,
  gstAmount: quotationsTable.gstAmount,
  discount: quotationsTable.discount,
  totalAmount: quotationsTable.totalAmount,
  status: quotationsTable.status,
  validUntil: quotationsTable.validUntil,
  notes: quotationsTable.notes,
  companyId: quotationsTable.companyId,
  branchId: quotationsTable.branchId,
  franchiseeId: quotationsTable.franchiseeId,
  createdAt: quotationsTable.createdAt,
  updatedAt: quotationsTable.updatedAt,
};

router.get("/quotations", async (req, res) => {
  try {
    const { customerId, status, limit = "50", offset = "0" } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, SCOPE_COLS)];
    if (customerId) conditions.push(eq(quotationsTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(quotationsTable.status, status as (typeof quotationsTable.status)["_"]["data"]));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select(qSelect).from(quotationsTable)
        .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
        .where(where).orderBy(desc(quotationsTable.createdAt)).limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(quotationsTable).where(where),
    ]);

    return res.json({ data, total: Number(countResult[0]?.count ?? 0), limit: lim, offset: off });
  } catch (err) {
    req.log.error({ err }, "List quotations error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations", async (req, res) => {
  try {
    const { customerId, leadId, bookingId, items, discount, validUntil, notes } = req.body;
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
      quotationNumber: generateQuotationNumber(),
      customerId, leadId, bookingId, items,
      subtotal: subtotal.toString(),
      gstAmount: gst.toString(),
      discount: disc.toString(),
      totalAmount: total.toString(),
      status: "draft" as const,
      validUntil, notes,
    });

    const [q] = await db.insert(quotationsTable).values(values as typeof quotationsTable.$inferInsert).returning();
    return res.status(201).json(q);
  } catch (err) {
    req.log.error({ err }, "Create quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/quotations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [q] = await db.select(qSelect).from(quotationsTable)
      .leftJoin(customersTable, eq(quotationsTable.customerId, customersTable.id))
      .where(eq(quotationsTable.id, id));
    if (!q || !rowInScope(req, q)) return res.status(404).json({ error: "Quotation not found" });
    return res.json(q);
  } catch (err) {
    req.log.error({ err }, "Get quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/quotations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Quotation not found" });
    const { status, items, discount, notes, validUntil } = req.body;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (validUntil !== undefined) updateData.validUntil = validUntil;
    if (items?.length) {
      const subtotal = items.reduce((s: number, item: { total: number }) => s + item.total, 0);
      const disc = discount !== undefined ? discount : parseFloat(existing.discount);
      const { gst, total } = computeGst(subtotal - disc);
      updateData.items = items;
      updateData.subtotal = subtotal.toString();
      updateData.gstAmount = gst.toString();
      updateData.discount = disc.toString();
      updateData.totalAmount = total.toString();
    }
    const [q] = await db.update(quotationsTable).set(updateData).where(eq(quotationsTable.id, id)).returning();
    return res.json(q);
  } catch (err) {
    req.log.error({ err }, "Update quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quotations/:id/convert", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [q] = await db.select().from(quotationsTable).where(eq(quotationsTable.id, id)).limit(1);
    if (!q || !rowInScope(req, q)) return res.status(404).json({ error: "Quotation not found" });
    if (q.status !== "draft" && q.status !== "sent" && q.status !== "accepted") {
      return res.status(400).json({ error: "Quotation must be draft, sent, or accepted to convert" });
    }

    const customer = await db.select().from(customersTable).where(eq(customersTable.id, q.customerId)).limit(1).then(r => r[0]);
    const stamped = tenantStamp(req, {});

    const invoice = await createInvoiceFromQuotation(
      {
        id: q.id,
        customerId: q.customerId,
        bookingId: q.bookingId,
        items: q.items as import("@workspace/db").InvoiceItem[],
        subtotal: q.subtotal,
        gstAmount: q.gstAmount,
        discount: q.discount,
        totalAmount: q.totalAmount,
      },
      {
        ...stamped,
        dueDate: req.body.dueDate ?? null,
        gstin: customer?.gstin ?? null,
      },
    );

    await db.update(quotationsTable).set({ status: "converted", updatedAt: new Date() }).where(eq(quotationsTable.id, id));
    return res.json({ invoice, quotation: { id: q.id, status: "converted" } });
  } catch (err) {
    req.log.error({ err }, "Convert quotation error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
