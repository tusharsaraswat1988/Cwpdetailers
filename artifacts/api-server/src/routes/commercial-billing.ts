/**
 * Phase 5.6 — Billing & Commercial Closure APIs.
 * Permission resource: invoices (registered in routes/index.ts).
 */

import { Router } from "express";
import {
  listReadyForBillingQueue,
  previewJobInvoice,
  generateJobInvoice,
  issueInvoice,
  markInvoicePaid,
  voidInvoice,
  createCommercialCreditNote,
  listCommercialInvoices,
  getCommercialInvoiceDetail,
} from "../lib/billing/commercialClosureService";
import { mapBillingError } from "../lib/billing/billingErrors";
import type { InvoiceCommercialStatus } from "@workspace/db";

const router = Router();

router.get("/billing/ready-for-billing", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const result = await listReadyForBillingQueue(req, { limit, offset });
    return res.json(result);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "ready-for-billing queue failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get("/billing/jobs/:jobId/preview", async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (!jobId) return res.status(400).json({ error: "Invalid job id" });
    const preview = await previewJobInvoice(req, jobId);
    return res.json(preview);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "billing preview failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post("/billing/jobs/:jobId/generate", async (req, res) => {
  try {
    const jobId = parseInt(req.params.jobId, 10);
    if (!jobId) return res.status(400).json({ error: "Invalid job id" });
    const invoice = await generateJobInvoice(req, jobId);
    return res.status(201).json(invoice);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "generate invoice failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get("/billing/commercial", async (req, res) => {
  try {
    const status = (req.query.status as string | undefined) ?? "all";
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const result = await listCommercialInvoices(req, {
      commercialStatus: status as InvoiceCommercialStatus | "outstanding" | "all",
      limit,
      offset,
    });
    return res.json(result);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "list commercial invoices failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get("/billing/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const detail = await getCommercialInvoiceDetail(req, id);
    return res.json(detail);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "commercial invoice detail failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get("/billing/invoices/:id/timeline", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const detail = await getCommercialInvoiceDetail(req, id);
    return res.json({ invoiceId: id, timeline: detail.timeline });
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "commercial timeline failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.get("/billing/invoices/:id/history", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const detail = await getCommercialInvoiceDetail(req, id);
    return res.json({ invoiceId: id, history: detail.timeline });
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "commercial history failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post("/billing/invoices/:id/issue", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const invoice = await issueInvoice(req, id);
    return res.json(invoice);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "issue invoice failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post("/billing/invoices/:id/mark-paid", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const invoice = await markInvoicePaid(req, id, req.body ?? {});
    return res.json(invoice);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "mark paid failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post("/billing/invoices/:id/void", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const reason = typeof req.body?.reason === "string" ? req.body.reason : undefined;
    const invoice = await voidInvoice(req, id, reason);
    return res.json(invoice);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "void invoice failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

router.post("/billing/invoices/:id/credit-note", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid invoice id" });
    const credit = await createCommercialCreditNote(req, id, {
      items: req.body?.items,
      reason: req.body?.reason,
    });
    return res.status(201).json(credit);
  } catch (err) {
    const mapped = mapBillingError(err);
    if (mapped.status >= 500) req.log.error({ err }, "credit note failed");
    return res.status(mapped.status).json({ error: mapped.message });
  }
});

export default router;
