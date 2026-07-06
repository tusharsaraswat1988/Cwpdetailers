import { Router } from "express";
import { db } from "@workspace/db";
import { invoicesTable, paymentsTable, customersTable, serviceLocationsTable, assetsTable } from "@workspace/db";
import { eq, and, sql, desc, gt } from "drizzle-orm";
import { tenantFilters, tenantStamp, rowInScope, loadIfInScope } from "../middlewares/tenantScope";
import {
  createInvoice as createInvoiceRecord,
  createCreditNote,
  recordPayment,
  syncCustomerTotalDues,
} from "../lib/billing/invoiceService";
import {
  getInvoiceBillingSettings,
  getInvoiceBillingSettingsForAdmin,
  getServiceCategoryTermsPreview,
  saveInvoiceBillingSettings,
  type InvoiceBillingSettingsPatch,
} from "../lib/billing/invoiceBillingSettings";
import { renderInvoicePdf } from "../lib/billing/invoicePdfGenerator";
import { computeInvoiceGst } from "../lib/billing/invoiceGstEngine";
import { mapBillingError } from "../lib/billing/billingErrors";
import type { InvoiceItem } from "@workspace/db";

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

router.get("/invoices/billing-settings", async (_req, res) => {
  try {
    const settings = await getInvoiceBillingSettingsForAdmin();
    const serviceCategoryTerms = getServiceCategoryTermsPreview();
    return res.json({ settings, serviceCategoryTerms });
  } catch (err) {
    req.log.error({ err }, "Get invoice billing settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/invoices/billing-settings", async (req, res) => {
  try {
    const patch = req.body as InvoiceBillingSettingsPatch;
    if (patch.terms && !Array.isArray(patch.terms)) {
      return res.status(400).json({ error: "terms must be an array of strings" });
    }
    const settings = await saveInvoiceBillingSettings(patch);
    return res.json({ settings });
  } catch (err) {
    req.log.error({ err }, "Update invoice billing settings error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/invoices/gst-preview", async (req, res) => {
  try {
    const { items, discount = 0, gstInclusive = true, isInterState = false } = req.body as {
      items?: InvoiceItem[];
      discount?: number;
      gstInclusive?: boolean;
      isInterState?: boolean;
    };
    if (!items?.length) return res.status(400).json({ error: "items required" });
    const gst = computeInvoiceGst({
      items,
      invoiceDiscount: discount,
      gstInclusive: gstInclusive !== false,
      isInterState: !!isInterState,
    });
    return res.json({
      subtotal: gst.subtotal,
      gstAmount: gst.gstAmount,
      cgstAmount: gst.cgstAmount,
      sgstAmount: gst.sgstAmount,
      igstAmount: gst.igstAmount,
      totalAmount: gst.totalAmount,
    });
  } catch (err) {
    req.log.error({ err }, "GST preview error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/invoices", async (req, res) => {
  try {
    const {
      customerId, status, documentType, hasBalance,
      limit = "50", offset = "0",
    } = req.query as Record<string, string>;
    const lim = Math.min(parseInt(limit), 100);
    const off = parseInt(offset);
    const conditions = [...tenantFilters(req, INVOICE_SCOPE)];
    if (customerId) conditions.push(eq(invoicesTable.customerId, parseInt(customerId)));
    if (status) conditions.push(eq(invoicesTable.status, status as (typeof invoicesTable.status)["_"]["data"]));
    if (documentType) {
      conditions.push(eq(invoicesTable.documentType, documentType as (typeof invoicesTable.documentType)["_"]["data"]));
    }
    if (hasBalance === "true") conditions.push(gt(invoicesTable.balanceDue, "0"));
    const where = conditions.length ? and(...conditions) : undefined;

    const [data, countResult] = await Promise.all([
      db.select({
        id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
        documentType: invoicesTable.documentType,
        referenceInvoiceId: invoicesTable.referenceInvoiceId,
        referenceInvoiceNumber: invoicesTable.referenceInvoiceNumber,
        customerId: invoicesTable.customerId, customerName: customersTable.name,
        subscriptionId: invoicesTable.subscriptionId, bookingId: invoicesTable.bookingId,
        quotationId: invoicesTable.quotationId,
        contractRegistryId: invoicesTable.contractRegistryId,
        serviceLocationId: invoicesTable.serviceLocationId,
        assetId: invoicesTable.assetId,
        serviceLocationLabel: serviceLocationsTable.label,
        assetLabel: assetsTable.label,
        paymentTerms: invoicesTable.paymentTerms,
        items: invoicesTable.items, subtotal: invoicesTable.subtotal,
        tax: invoicesTable.tax, gstAmount: invoicesTable.gstAmount,
        cgstAmount: invoicesTable.cgstAmount, sgstAmount: invoicesTable.sgstAmount,
        igstAmount: invoicesTable.igstAmount,
        discount: invoicesTable.discount, totalAmount: invoicesTable.totalAmount,
        paidAmount: invoicesTable.paidAmount,
        dueAmount: invoicesTable.dueAmount, balanceDue: invoicesTable.balanceDue,
        status: invoicesTable.status, gstin: invoicesTable.gstin,
        placeOfSupply: invoicesTable.placeOfSupply,
        notes: invoicesTable.notes,
        currency: invoicesTable.currency,
        dueDate: invoicesTable.dueDate, issuedAt: invoicesTable.issuedAt,
        paidAt: invoicesTable.paidAt, createdAt: invoicesTable.createdAt,
      }).from(invoicesTable)
        .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
        .leftJoin(serviceLocationsTable, eq(invoicesTable.serviceLocationId, serviceLocationsTable.id))
        .leftJoin(assetsTable, eq(invoicesTable.assetId, assetsTable.id))
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
    const {
      customerId, subscriptionId, bookingId, items, discount, dueDate,
      gstInclusive = true, documentType, referenceInvoiceId, creditReason,
      notes, terms, customerSnapshot, placeOfSupply,
    } = req.body;
    if (!customerId || !items?.length) return res.status(400).json({ error: "customerId and items required" });

    const customer = await loadIfInScope(req,
      () => db.select().from(customersTable).where(eq(customersTable.id, customerId)).limit(1).then(r => r[0]),
      r => ({ ...r, customerId: r.id }),
    );
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const stamped = tenantStamp(req, {});
    const invoice = await createInvoiceRecord({
      customerId,
      subscriptionId,
      bookingId,
      items,
      discount: discount || 0,
      gstInclusive: gstInclusive !== false,
      dueDate,
      status: "sent",
      gstin: customerSnapshot?.gstin ?? customer.gstin ?? null,
      documentType,
      referenceInvoiceId,
      creditReason,
      notes,
      terms,
      customerSnapshot,
      placeOfSupply,
      companyId: stamped.companyId,
      franchiseeId: stamped.franchiseeId,
      branchId: stamped.branchId,
    });
    return res.status(201).json(invoice);
  } catch (err) {
    req.log.error({ err }, "Create invoice error");
    const { status, message } = mapBillingError(err);
    return res.status(status).json({ error: message });
  }
});

router.post("/invoices/:id/credit-note", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).limit(1);
    if (!existing || !rowInScope(req, existing)) return res.status(404).json({ error: "Invoice not found" });
    if (existing.documentType !== "tax_invoice") {
      return res.status(400).json({ error: "Credit notes can only be issued against tax invoices" });
    }

    const { items, creditAmount, creditReason, notes } = req.body;
    const stamped = tenantStamp(req, {});
    const creditNote = await createCreditNote({
      referenceInvoiceId: id,
      items,
      creditAmount: creditAmount != null ? parseFloat(String(creditAmount)) : undefined,
      creditReason,
      notes,
      companyId: stamped.companyId,
      franchiseeId: stamped.franchiseeId,
      branchId: stamped.branchId,
    });
    return res.status(201).json(creditNote);
  } catch (err) {
    req.log.error({ err }, "Create credit note error");
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(err instanceof Error ? 400 : 500).json({ error: message });
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
    await syncCustomerTotalDues(existing.customerId);
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
    const { customerId, invoiceId, amount, method, transactionId, notes, receivedByStaffId, useWallet } = req.body;
    if (!customerId || amount == null || !method) return res.status(400).json({ error: "customerId, amount, method are required" });

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

    const parsedAmount = parseFloat(amount.toString());
    if (parsedAmount < 0) return res.status(400).json({ error: "amount must be non-negative" });
    if (parsedAmount === 0 && !useWallet) {
      return res.status(400).json({ error: "amount must be greater than zero when not using wallet" });
    }

    const stamped = tenantStamp(req, {});
    const payment = await recordPayment({
      customerId,
      invoiceId,
      amount: parsedAmount,
      method,
      useWallet: !!useWallet,
      transactionId,
      notes,
      receivedByStaffId,
      createdBy: req.user?.id ?? null,
      companyId: stamped.companyId,
      branchId: stamped.branchId,
    });

    return res.status(201).json(payment);
  } catch (err) {
    req.log.error({ err }, "Record payment error");
    const message = err instanceof Error ? err.message : "Internal server error";
    return res.status(err instanceof Error && message !== "Internal server error" ? 400 : 500).json({ error: message });
  }
});

router.get("/invoices/:id/pdf", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [inv] = await db.select({
      id: invoicesTable.id, invoiceNumber: invoicesTable.invoiceNumber,
      documentType: invoicesTable.documentType,
      referenceInvoiceNumber: invoicesTable.referenceInvoiceNumber,
      referenceInvoiceDate: invoicesTable.referenceInvoiceDate,
      creditReason: invoicesTable.creditReason,
      customerId: invoicesTable.customerId, customerName: customersTable.name,
      customerPhone: customersTable.phone,
      customerSnapshot: invoicesTable.customerSnapshot,
      items: invoicesTable.items, subtotal: invoicesTable.subtotal,
      tax: invoicesTable.tax, gstAmount: invoicesTable.gstAmount,
      cgstAmount: invoicesTable.cgstAmount, sgstAmount: invoicesTable.sgstAmount,
      igstAmount: invoicesTable.igstAmount, roundOff: invoicesTable.roundOff,
      hsnSummary: invoicesTable.hsnSummary,
      discount: invoicesTable.discount,
      totalAmount: invoicesTable.totalAmount, paidAmount: invoicesTable.paidAmount,
      dueAmount: invoicesTable.dueAmount, balanceDue: invoicesTable.balanceDue,
      status: invoicesTable.status, gstin: invoicesTable.gstin,
      placeOfSupply: invoicesTable.placeOfSupply,
      supplyStateCode: invoicesTable.supplyStateCode,
      isInterState: invoicesTable.isInterState,
      notes: invoicesTable.notes, terms: invoicesTable.terms,
      currency: invoicesTable.currency,
      dueDate: invoicesTable.dueDate, issuedAt: invoicesTable.issuedAt,
      paidAt: invoicesTable.paidAt, createdAt: invoicesTable.createdAt,
      companyId: invoicesTable.companyId, branchId: invoicesTable.branchId,
      franchiseeId: invoicesTable.franchiseeId,
    }).from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .where(eq(invoicesTable.id, id));
    if (!inv || !rowInScope(req, inv)) return res.status(404).json({ error: "Invoice not found" });

    const settings = await getInvoiceBillingSettings();
    const filename = `${inv.invoiceNumber?.replace(/\//g, "-") ?? "invoice"}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${filename}"`);

    const items = Array.isArray(inv.items) ? inv.items : [];
    const snap = inv.customerSnapshot;
    await renderInvoicePdf(
      {
        invoiceNumber: inv.invoiceNumber ?? "",
        documentType: inv.documentType ?? "tax_invoice",
        referenceInvoiceNumber: inv.referenceInvoiceNumber,
        referenceInvoiceDate: inv.referenceInvoiceDate,
        creditReason: inv.creditReason,
        customerName: snap?.name ?? inv.customerName ?? "Customer",
        customerPhone: snap?.phone ?? inv.customerPhone ?? null,
        customerEmail: snap?.email ?? null,
        customerAddress: snap?.address ?? null,
        customerCity: snap?.city ?? null,
        customerGstin: snap?.gstin ?? inv.gstin ?? null,
        placeOfSupply: inv.placeOfSupply ?? snap?.placeOfSupply ?? settings.placeOfSupply,
        supplyStateCode: inv.supplyStateCode ?? snap?.supplyStateCode ?? "09",
        isInterState: inv.isInterState ?? false,
        items,
        subtotal: parseFloat(inv.subtotal ?? "0"),
        gstAmount: parseFloat(inv.gstAmount ?? "0"),
        cgstAmount: parseFloat(inv.cgstAmount ?? "0"),
        sgstAmount: parseFloat(inv.sgstAmount ?? "0"),
        igstAmount: parseFloat(inv.igstAmount ?? "0"),
        roundOff: parseFloat(inv.roundOff ?? "0"),
        hsnSummary: inv.hsnSummary ?? [],
        discount: parseFloat(inv.discount ?? "0"),
        totalAmount: parseFloat(inv.totalAmount ?? "0"),
        paidAmount: parseFloat(inv.paidAmount ?? "0"),
        balanceDue: parseFloat(inv.balanceDue ?? "0"),
        dueDate: inv.dueDate ?? null,
        issuedAt: inv.issuedAt ?? inv.createdAt ?? null,
        notes: inv.notes,
        terms: inv.terms ?? settings.terms,
      },
      settings,
      res,
    );
  } catch (err) {
    req.log.error({ err }, "PDF generation error");
    if (!res.headersSent) return res.status(500).json({ error: "Internal server error" });
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
          status: balanceDue <= 0 ? "paid" : (inv.status === "paid" ? "sent" : inv.status),
          paidAt: balanceDue <= 0 ? inv.paidAt : null,
          updatedAt: new Date(),
        }).where(eq(invoicesTable.id, inv.id));
        await syncCustomerTotalDues(inv.customerId);
      }
    }

    return res.json({ reversal, original: { id: payment.id, status: "reversed" } });
  } catch (err) {
    req.log.error({ err }, "Payment reversal error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
