import { Router } from "express";
import { db } from "@workspace/db";
import {
  commBrandsTable, commDltTemplatesTable, commEmailTemplatesTable,
  commWhatsappTemplatesTable, commWorkflowsTable, commWorkflowStepsTable,
  commWorkflowRunsTable, commAiRecommendationsTable, commDeadLetterTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { tenantStamp } from "../middlewares/tenantScope";
import { logCommAudit } from "../lib/communications/audit";
import { listBrands, seedDefaultBrands } from "../lib/communications/brandService";
import { getCustomerTimeline, getTimelineAnalytics } from "../lib/communications/timelineService";
import { getQueueStats, processQueueJobs } from "../lib/communications/queueService";
import { getWorkflowWithSteps, startWorkflowRun, listWorkflows } from "../lib/communications/workflowEngine";
import { getConsentHistory } from "../lib/communications/consentService";
import { validateBeforeSmsSend } from "../lib/communications/dltValidator";

const router = Router();

// ─── Brands ───────────────────────────────────────────────────────────────────

router.get("/communications/brands", async (req, res) => {
  try {
    await seedDefaultBrands(req.scope?.companyId);
    const data = await listBrands(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List brands error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/brands", async (req, res) => {
  try {
    const { name, code, logo, primaryColor, emailSender, emailReplyTo, defaultSmsHeader, defaultWhatsappNumber, defaultSupportNumber } = req.body;
    if (!name || !code) return res.status(400).json({ error: "name and code required" });
    const payload = tenantStamp(req, {
      name, code, logo, primaryColor, emailSender, emailReplyTo,
      defaultSmsHeader, defaultWhatsappNumber, defaultSupportNumber, status: "active" as const,
    });
    const [row] = await db.insert(commBrandsTable).values(payload).returning();
    await logCommAudit({ action: "brand.create", resource: "brand", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId, brandId: row!.id, payload: { code } });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/communications/brands/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(commBrandsTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(commBrandsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    await logCommAudit({ action: "brand.update", resource: "brand", resourceId: id, userId: req.user?.id, companyId: row.companyId, brandId: id });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DLT Governance Templates ─────────────────────────────────────────────────

router.get("/communications/dlt/templates", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const conditions = [];
    if (brandId) conditions.push(eq(commDltTemplatesTable.brandId, brandId));
    if (req.scope?.companyId) conditions.push(eq(commDltTemplatesTable.companyId, req.scope.companyId));
    const data = await db.select().from(commDltTemplatesTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(commDltTemplatesTable.createdAt));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/dlt/templates", async (req, res) => {
  try {
    const { brandId, entityId, headerId, templateId, name, templateType, approvedContent, variables, status, approvalDate } = req.body;
    if (!brandId || !entityId || !headerId || !templateId || !name || !approvedContent) {
      return res.status(400).json({ error: "Missing required DLT template fields" });
    }
    const payload = tenantStamp(req, {
      brandId, entityId, headerId, templateId, name,
      templateType: templateType ?? "transactional",
      approvedContent, variables: variables ?? [],
      status: status ?? "approved", approvalDate: approvalDate ? new Date(approvalDate) : new Date(),
    });
    const [row] = await db.insert(commDltTemplatesTable).values(payload).returning();
    await logCommAudit({ action: "dlt_template.create", resource: "dlt_template", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId, brandId });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/dlt/validate", async (req, res) => {
  try {
    const result = await validateBeforeSmsSend({
      ...req.body,
      userId: req.user?.id,
      companyId: req.scope?.companyId,
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Email Templates ──────────────────────────────────────────────────────────

router.get("/communications/email/templates", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const conditions = [];
    if (brandId) conditions.push(eq(commEmailTemplatesTable.brandId, brandId));
    if (req.scope?.companyId) conditions.push(eq(commEmailTemplatesTable.companyId, req.scope.companyId));
    const data = await db.select().from(commEmailTemplatesTable)
      .where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/email/templates", async (req, res) => {
  try {
    const { brandId, name, subject, htmlContent, emailType, variables, attachments } = req.body;
    if (!brandId || !name || !subject || !htmlContent) return res.status(400).json({ error: "Missing required fields" });
    const payload = tenantStamp(req, { brandId, name, subject, htmlContent, emailType, variables, attachments });
    const [row] = await db.insert(commEmailTemplatesTable).values(payload).returning();
    await logCommAudit({ action: "email_template.create", resource: "email_template", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId, brandId });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WhatsApp Templates ───────────────────────────────────────────────────────

router.get("/communications/whatsapp/templates", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const conditions = [];
    if (brandId) conditions.push(eq(commWhatsappTemplatesTable.brandId, brandId));
    if (req.scope?.companyId) conditions.push(eq(commWhatsappTemplatesTable.companyId, req.scope.companyId));
    const data = await db.select().from(commWhatsappTemplatesTable)
      .where(conditions.length ? and(...conditions) : undefined);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/whatsapp/templates", async (req, res) => {
  try {
    const { brandId, metaTemplateName, category, language, bodyPreview, variables, approvalStatus } = req.body;
    if (!brandId || !metaTemplateName || !bodyPreview) return res.status(400).json({ error: "Missing required fields" });
    const payload = tenantStamp(req, {
      brandId, metaTemplateName, category: category ?? "utility",
      language: language ?? "en", bodyPreview, variables, approvalStatus,
    });
    const [row] = await db.insert(commWhatsappTemplatesTable).values(payload).returning();
    await logCommAudit({ action: "whatsapp_template.create", resource: "whatsapp_template", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId, brandId });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Workflows ────────────────────────────────────────────────────────────────

router.get("/communications/workflows", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const data = await listWorkflows(req.scope?.companyId, brandId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/workflows/:id", async (req, res) => {
  try {
    const data = await getWorkflowWithSteps(parseInt(req.params.id));
    if (!data) return res.status(404).json({ error: "Not found" });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/workflows", async (req, res) => {
  try {
    const { brandId, name, trigger, steps, config } = req.body;
    if (!brandId || !name || !trigger) return res.status(400).json({ error: "brandId, name, trigger required" });
    const payload = tenantStamp(req, { brandId, name, trigger, config: config ?? {}, isActive: true });
    const [workflow] = await db.insert(commWorkflowsTable).values(payload).returning();
    if (steps?.length) {
      await db.insert(commWorkflowStepsTable).values(
        steps.map((s: { stepOrder: number; stepType: string; config?: Record<string, unknown> }, i: number) => ({
          workflowId: workflow!.id,
          stepOrder: s.stepOrder ?? i + 1,
          stepType: s.stepType,
          config: s.config ?? {},
        })),
      );
    }
    await logCommAudit({ action: "workflow.create", resource: "workflow", resourceId: workflow!.id, userId: req.user?.id, companyId: workflow!.companyId, brandId });
    const full = await getWorkflowWithSteps(workflow!.id);
    return res.status(201).json(full);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/workflows/:id/run", async (req, res) => {
  try {
    const run = await startWorkflowRun(parseInt(req.params.id), {
      ...req.body,
      companyId: req.scope?.companyId,
    });
    return res.status(201).json(run);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Internal server error" });
  }
});

router.get("/communications/workflows/:id/runs", async (req, res) => {
  try {
    const workflowId = parseInt(req.params.id);
    const data = await db.select().from(commWorkflowRunsTable)
      .where(eq(commWorkflowRunsTable.workflowId, workflowId))
      .orderBy(desc(commWorkflowRunsTable.createdAt))
      .limit(50);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Timeline ─────────────────────────────────────────────────────────────────

router.get("/communications/timeline/customer/:customerId", async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const data = await getCustomerTimeline(customerId, { brandId, cursor, limit });
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/timeline/analytics", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const data = await getTimelineAnalytics(req.scope?.companyId, brandId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Queue & Dead Letter ──────────────────────────────────────────────────────

router.get("/communications/queue/stats", async (req, res) => {
  try {
    const data = await getQueueStats(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/queue/process", async (req, res) => {
  try {
    const limit = parseInt((req.body.limit as string) ?? "50");
    const results = await processQueueJobs(limit);
    return res.json({ processed: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/queue/dead-letter", async (req, res) => {
  try {
    const conditions = [];
    if (req.scope?.companyId) conditions.push(eq(commDeadLetterTable.companyId, req.scope.companyId));
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    if (brandId) conditions.push(eq(commDeadLetterTable.brandId, brandId));
    const data = await db.select().from(commDeadLetterTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(commDeadLetterTable.createdAt))
      .limit(100);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Consent History ──────────────────────────────────────────────────────────

router.get("/communications/consents/:customerId/history", async (req, res) => {
  try {
    const data = await getConsentHistory(parseInt(req.params.customerId));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── AI Placeholder ───────────────────────────────────────────────────────────

router.get("/communications/ai/recommendations", async (req, res) => {
  try {
    const brandId = req.query.brandId ? parseInt(req.query.brandId as string) : undefined;
    const conditions = [];
    if (brandId) conditions.push(eq(commAiRecommendationsTable.brandId, brandId));
    if (req.scope?.companyId) conditions.push(eq(commAiRecommendationsTable.companyId, req.scope.companyId));
    const data = await db.select().from(commAiRecommendationsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(50);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
