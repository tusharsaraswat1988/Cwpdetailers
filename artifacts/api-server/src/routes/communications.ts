import { Router } from "express";
import { db } from "@workspace/db";
import {
  commDltEntitiesTable, commDltHeadersTable, commTemplatesTable,
  commProvidersTable, commAudiencesTable, commCampaignsTable,
  commEventsTable, commAutomationsTable, commAuditLogsTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { tenantFilters, tenantStamp } from "../middlewares/tenantScope";
import { countAudience, resolveAudience } from "../lib/communications/audienceBuilder";
import { launchCampaign, previewCampaign, testWhatsAppSend } from "../lib/communications/campaignEngine";
import { getCommAnalytics, getDashboardAnalytics } from "../lib/communications/analytics";
import { enqueueCommJob, processCommJobs } from "../lib/communications/jobProcessor";
import { logCommAudit } from "../lib/communications/audit";
import { extractVariables, TEMPLATE_VARIABLES } from "../lib/communications/templateEngine";
import { getCustomerConsent, upsertCustomerConsent } from "../lib/communications/consentService";
import { listSmartSegments, createCustomSmartSegment } from "../lib/communications/smartSegments";
import { getCampaignAttributionDetail, processCampaignAttribution } from "../lib/communications/attributionService";
import type { AudienceFilterNode } from "@workspace/db";

const router = Router();
const SCOPE_COMM = {
  companyCol: commCampaignsTable.companyId,
  branchCol: commCampaignsTable.branchId,
};

// ─── DLT Entities ───────────────────────────────────────────────────────────

router.get("/communications/dlt/entities", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commDltEntitiesTable.companyId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commDltEntitiesTable).where(where).orderBy(desc(commDltEntitiesTable.createdAt));
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List DLT entities error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/dlt/entities", async (req, res) => {
  try {
    const { name, entityId, isActive } = req.body;
    if (!name || !entityId) return res.status(400).json({ error: "name and entityId are required" });
    const payload = tenantStamp(req, { name, entityId, isActive: isActive ?? true });
    const [row] = await db.insert(commDltEntitiesTable).values(payload).returning();
    await logCommAudit({ action: "dlt_entity.create", resource: "dlt_entity", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId, payload: { name } });
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create DLT entity error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/communications/dlt/entities/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(commDltEntitiesTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(commDltEntitiesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DLT Headers ────────────────────────────────────────────────────────────

router.get("/communications/dlt/headers", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commDltHeadersTable.companyId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commDltHeadersTable).where(where);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/dlt/headers", async (req, res) => {
  try {
    const { entityId, headerId, name, isActive } = req.body;
    if (!entityId || !headerId || !name) return res.status(400).json({ error: "entityId, headerId, name required" });
    const payload = tenantStamp(req, { entityId, headerId, name, isActive: isActive ?? true });
    const [row] = await db.insert(commDltHeadersTable).values(payload).returning();
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Templates ──────────────────────────────────────────────────────────────

router.get("/communications/templates", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commTemplatesTable.companyId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commTemplatesTable).where(where).orderBy(desc(commTemplatesTable.createdAt));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/templates", async (req, res) => {
  try {
    const { name, channel, category, dltTemplateId, headerId, subject, body, isActive } = req.body;
    if (!name || !body) return res.status(400).json({ error: "name and body required" });
    const variables = extractVariables(body + (subject ?? ""));
    const payload = tenantStamp(req, {
      name, channel: channel ?? "sms", category: category ?? "transactional",
      dltTemplateId, headerId, subject, body, variables, isActive: isActive ?? true,
    });
    const [row] = await db.insert(commTemplatesTable).values(payload).returning();
    await logCommAudit({ action: "template.create", resource: "template", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/communications/templates/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = { ...req.body, updatedAt: new Date() };
    if (updates.body) updates.variables = extractVariables(updates.body + (updates.subject ?? ""));
    const [row] = await db.update(commTemplatesTable).set(updates)
      .where(eq(commTemplatesTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/template-variables", (_req, res) => {
  return res.json(TEMPLATE_VARIABLES.map(v => ({ key: v, placeholder: `{{${v}}}` })));
});

// ─── Providers ────────────────────────────────────────────────────────────

router.get("/communications/providers", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commProvidersTable.companyId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commProvidersTable).where(where).orderBy(desc(commProvidersTable.priority));
    const sanitized = data.map(({ config, ...rest }) => ({
      ...rest,
      configKeys: Object.keys((config as Record<string, string>) ?? {}),
      hasConfig: Boolean(config),
    }));
    return res.json(sanitized);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/providers", async (req, res) => {
  try {
    const { name, providerType, channel, config, isActive, isPrimary, priority } = req.body;
    if (!name || !providerType || !channel) return res.status(400).json({ error: "name, providerType, channel required" });
    const payload = tenantStamp(req, {
      name, providerType, channel, config: config ?? {},
      isActive: isActive ?? true, isPrimary: isPrimary ?? false, priority: priority ?? 0,
    });
    const [row] = await db.insert(commProvidersTable).values(payload).returning();
    await logCommAudit({ action: "provider.create", resource: "provider", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId });
    return res.status(201).json({ ...row, configKeys: Object.keys((row!.config as Record<string, string>) ?? {}) });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/communications/providers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(commProvidersTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(commProvidersTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Audiences ──────────────────────────────────────────────────────────────

router.get("/communications/audiences", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commAudiencesTable.companyId, branchCol: commAudiencesTable.branchId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commAudiencesTable).where(where).orderBy(desc(commAudiencesTable.createdAt));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/audiences", async (req, res) => {
  try {
    const { name, description, filterDefinition } = req.body as { name: string; description?: string; filterDefinition: AudienceFilterNode };
    if (!name || !filterDefinition) return res.status(400).json({ error: "name and filterDefinition required" });
    const scope = { companyId: req.scope?.companyId, branchId: req.scope?.branchIds?.[0] };
    const estimatedCount = await countAudience(filterDefinition, scope);
    const payload = tenantStamp(req, {
      name, description, filterDefinition, estimatedCount, createdBy: req.user?.id,
    });
    const [row] = await db.insert(commAudiencesTable).values(payload).returning();
    return res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Create audience error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/audiences/preview", async (req, res) => {
  try {
    const { filterDefinition } = req.body as { filterDefinition: AudienceFilterNode };
    if (!filterDefinition) return res.status(400).json({ error: "filterDefinition required" });
    const scope = { companyId: req.scope?.companyId, branchId: req.scope?.branchIds?.[0], franchiseeId: req.scope?.franchiseeId };
    const count = await countAudience(filterDefinition, scope);
    const { customers, leads } = await resolveAudience(filterDefinition, scope);
    const sample = [...customers.slice(0, 5), ...leads.slice(0, 5)];
    return res.json({ count, sample });
  } catch (err) {
    req.log.error({ err }, "Audience preview error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/audience-filters", (_req, res) => {
  return res.json([
    { id: "all_customers", label: "All Customers", group: "customers" },
    { id: "active_customers", label: "Active Customers", group: "customers" },
    { id: "inactive_customers", label: "Inactive Customers", group: "customers" },
    { id: "payment_due", label: "Payment Due Customers", group: "customers" },
    { id: "wash_due", label: "Wash Due Customers", group: "customers" },
    { id: "amc_due", label: "AMC Due Customers", group: "customers" },
    { id: "expiring_package", label: "Expiring Package Customers", group: "customers", params: [{ key: "days", type: "number", default: 7 }] },
    { id: "no_visit_since_days", label: "No Visit Since X Days", group: "customers", params: [{ key: "days", type: "number", default: 30 }] },
    { id: "multiple_vehicles", label: "Multiple Vehicle Owners", group: "customers" },
    { id: "high_value_customers", label: "High Value Customers", group: "customers" },
    { id: "cwp_customers", label: "CWP Customers", group: "segments" },
    { id: "dcc_customers", label: "DCC Customers", group: "segments" },
    { id: "solar_customers", label: "Solar Customers", group: "segments" },
    { id: "bidwar_customers", label: "BidWar Customers", group: "segments" },
    { id: "revenue_above", label: "Revenue Above X", group: "customers", params: [{ key: "minRevenue", type: "number", default: 10000 }] },
    { id: "last_visit_between", label: "Last Visit Between Dates", group: "customers", params: [{ key: "fromDate", type: "date", default: "" }, { key: "toDate", type: "date", default: "" }] },
    { id: "lost_leads", label: "Lost Leads", group: "leads" },
    { id: "open_leads", label: "Open Leads", group: "leads" },
    { id: "hot_leads", label: "Hot Leads", group: "leads" },
    { id: "warm_leads", label: "Warm Leads", group: "leads" },
    { id: "cold_leads", label: "Cold Leads", group: "leads" },
  ]);
});

// ─── Campaigns ──────────────────────────────────────────────────────────────

router.get("/communications/campaigns", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, SCOPE_COMM)];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commCampaignsTable).where(where).orderBy(desc(commCampaignsTable.createdAt));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/campaigns", async (req, res) => {
  try {
    const { name, channel, audienceId, templateId, scheduledAt } = req.body;
    if (!name || !channel || !templateId) return res.status(400).json({ error: "name, channel, templateId required" });
    const status = scheduledAt ? "scheduled" as const : "draft" as const;
    const payload = tenantStamp(req, {
      name, channel, audienceId, templateId,
      status, scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      createdBy: req.user?.id,
    });
    const [row] = await db.insert(commCampaignsTable).values(payload).returning();
    await logCommAudit({ action: "campaign.create", resource: "campaign", resourceId: row!.id, userId: req.user?.id, companyId: row!.companyId });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/campaigns/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await launchCampaign(id, req.user?.id);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "Campaign send error");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Send failed" });
  }
});

router.post("/communications/campaigns/:id/schedule", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: "scheduledAt required" });
    const runAt = new Date(scheduledAt);
    const [row] = await db.update(commCampaignsTable).set({ status: "scheduled", scheduledAt: runAt })
      .where(eq(commCampaignsTable.id, id)).returning();
    await enqueueCommJob({ type: "campaign_send", campaignId: id }, runAt);
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/campaigns/preview", async (req, res) => {
  try {
    const { templateBody, recipient } = req.body;
    if (!templateBody) return res.status(400).json({ error: "templateBody required" });
    const preview = await previewCampaign(templateBody, recipient ?? {
      customerName: "Rajesh Kumar", vehicleNumber: "MH12AB1234",
      amountDue: "2500", invoiceNumber: "INV-2024-001",
      packageName: "Daily Wash Premium", nextServiceDate: "2024-06-15",
    });
    return res.json(preview);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Automations ────────────────────────────────────────────────────────────

router.get("/communications/automations", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commAutomationsTable.companyId, branchCol: commAutomationsTable.branchId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commAutomationsTable).where(where).orderBy(desc(commAutomationsTable.createdAt));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/automations", async (req, res) => {
  try {
    const { name, trigger, channel, templateId, audienceId, delayMinutes, isActive, config } = req.body;
    if (!name || !trigger || !channel || !templateId) {
      return res.status(400).json({ error: "name, trigger, channel, templateId required" });
    }
    const payload = tenantStamp(req, {
      name, trigger, channel, templateId, audienceId,
      delayMinutes: delayMinutes ?? 0, isActive: isActive ?? true, config: config ?? {},
    });
    const [row] = await db.insert(commAutomationsTable).values(payload).returning();
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/communications/automations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [row] = await db.update(commAutomationsTable).set({ ...req.body, updatedAt: new Date() })
      .where(eq(commAutomationsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Not found" });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/automation-triggers", (_req, res) => {
  return res.json([
    { id: "payment_due", label: "Payment Due" },
    { id: "wash_due", label: "Wash Due" },
    { id: "package_expiry", label: "Package Expiry" },
    { id: "birthday", label: "Birthday" },
    { id: "lead_follow_up", label: "Lead Follow-up" },
    { id: "invoice_generated", label: "Invoice Generated" },
    { id: "payment_received", label: "Payment Received" },
    { id: "amc_reminder", label: "AMC Reminder" },
  ]);
});

// ─── Timeline ───────────────────────────────────────────────────────────────

router.get("/communications/timeline", async (req, res) => {
  try {
    const { customerId, leadId } = req.query as Record<string, string>;
    const conditions = [...tenantFilters(req, { companyCol: commEventsTable.companyId, branchCol: commEventsTable.branchId })];
    if (customerId) conditions.push(eq(commEventsTable.customerId, parseInt(customerId)));
    if (leadId) conditions.push(eq(commEventsTable.leadId, parseInt(leadId)));
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commEventsTable).where(where).orderBy(desc(commEventsTable.createdAt)).limit(200);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Analytics ──────────────────────────────────────────────────────────────

router.get("/communications/analytics", async (req, res) => {
  try {
    const days = parseInt((req.query.days as string) ?? "30");
    const since = new Date(Date.now() - days * 86400000);
    const data = await getCommAnalytics(req.scope?.companyId, since);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Audit Logs ─────────────────────────────────────────────────────────────

router.get("/communications/audit-logs", async (req, res) => {
  try {
    const conditions = [...tenantFilters(req, { companyCol: commAuditLogsTable.companyId })];
    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(commAuditLogsTable).where(where).orderBy(desc(commAuditLogsTable.createdAt)).limit(100);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Job Processor ──────────────────────────────────────────────────────────

router.post("/communications/jobs/process", async (req, res) => {
  try {
    const results = await processCommJobs(20);
    await processCampaignAttribution();
    return res.json({ processed: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Consent Management ─────────────────────────────────────────────────────

router.get("/communications/consents/:customerId", async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const consent = await getCustomerConsent(customerId);
    return res.json(consent ?? {
      customerId, smsConsent: false, whatsappConsent: false, emailConsent: false,
      consentSource: "manual", consentDate: null,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/communications/consents/:customerId", async (req, res) => {
  try {
    const customerId = parseInt(req.params.customerId);
    const { smsConsent, whatsappConsent, emailConsent, consentSource, birthDate, anniversaryDate, notes } = req.body;
    const consentIp = req.ip ?? req.headers["x-forwarded-for"]?.toString() ?? null;
    const row = await upsertCustomerConsent(customerId, {
      smsConsent, whatsappConsent, emailConsent,
      consentSource: consentSource ?? "manual",
      consentIp,
      birthDate, anniversaryDate, notes,
      companyId: req.scope?.companyId,
    });
    await logCommAudit({
      action: "consent.update",
      resource: "consent",
      resourceId: row.id,
      userId: req.user?.id,
      companyId: row.companyId,
      payload: { customerId, smsConsent, whatsappConsent, emailConsent },
    });
    return res.json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Smart Segments ─────────────────────────────────────────────────────────

router.get("/communications/smart-segments", async (req, res) => {
  try {
    const data = await listSmartSegments(req.scope?.companyId);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/smart-segments", async (req, res) => {
  try {
    const { name, description, segmentKey, configJson } = req.body;
    if (!name || !segmentKey || !configJson) {
      return res.status(400).json({ error: "name, segmentKey, configJson required" });
    }
    const row = await createCustomSmartSegment({
      name, description, segmentKey, configJson,
      companyId: req.scope?.companyId,
    });
    await logCommAudit({
      action: "segment.create",
      resource: "smart_segment",
      resourceId: row.id,
      userId: req.user?.id,
      companyId: row.companyId,
      payload: { segmentKey },
    });
    return res.status(201).json(row);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/smart-segments/preview", async (req, res) => {
  try {
    const { segmentKey, combineWith } = req.body as {
      segmentKey: string;
      combineWith?: AudienceFilterNode;
    };
    if (!segmentKey) return res.status(400).json({ error: "segmentKey required" });
    const scope = { companyId: req.scope?.companyId, branchId: req.scope?.branchIds?.[0] };
    let filterDef: AudienceFilterNode = { type: "smart_segment", segmentKey };
    if (combineWith) {
      filterDef = { type: "group", operator: "AND", children: [filterDef, combineWith] };
    }
    const count = await countAudience(filterDef, scope);
    const { customers, leads } = await resolveAudience(filterDef, scope, 5);
    return res.json({ count, sample: [...customers.slice(0, 5), ...leads.slice(0, 5)] });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Campaign Detail & Attribution ──────────────────────────────────────────

router.get("/communications/campaigns/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [campaign] = await db.select().from(commCampaignsTable).where(eq(commCampaignsTable.id, id)).limit(1);
    if (!campaign) return res.status(404).json({ error: "Not found" });
    const attribution = await getCampaignAttributionDetail(id);
    const cost = Number(campaign.costAmount ?? 0);
    const revenue = attribution.summary.revenue;
    return res.json({
      ...campaign,
      attribution,
      roi: cost > 0 ? Math.round((revenue / cost) * 100) / 100 : null,
    });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/communications/campaigns/:id/attribution", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data = await getCampaignAttributionDetail(id);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/communications/campaigns/:id/attribution/process", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await processCampaignAttribution(id);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── WhatsApp Test Send ─────────────────────────────────────────────────────

router.post("/communications/whatsapp/test-send", async (req, res) => {
  try {
    const { phone, templateBody, templateName, recipient } = req.body;
    if (!phone || !templateBody) return res.status(400).json({ error: "phone and templateBody required" });
    const result = await testWhatsAppSend({
      phone, templateBody, templateName,
      companyId: req.scope?.companyId,
      recipient,
    });
    await logCommAudit({
      action: "whatsapp.test_send",
      resource: "whatsapp",
      userId: req.user?.id,
      companyId: req.scope?.companyId,
      payload: { phone, success: result.success },
    });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Dashboard Analytics ──────────────────────────────────────────────────────

router.get("/communications/dashboard", async (req, res) => {
  try {
    const days = parseInt((req.query.days as string) ?? "30");
    const data = await getDashboardAnalytics(req.scope?.companyId, days);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
