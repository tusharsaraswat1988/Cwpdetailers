import {
  pgTable, serial, integer, text, boolean, timestamp, pgEnum, json, numeric, date, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** DLT template categories per TRAI regulations */
export const dltTemplateCategoryEnum = pgEnum("dlt_template_category", [
  "transactional", "promotional", "service_implicit", "otp", "utility",
]);

export const commChannelEnum = pgEnum("comm_channel", [
  "sms", "whatsapp", "email", "push", "in_app",
]);

export const commProviderTypeEnum = pgEnum("comm_provider_type", [
  "fast2sms", "msg91", "twilio", "resend", "smtp", "firebase", "whatsapp_business",
]);

export const commCampaignStatusEnum = pgEnum("comm_campaign_status", [
  "draft", "scheduled", "processing", "sent", "failed", "cancelled",
]);

export const commEventStatusEnum = pgEnum("comm_event_status", [
  "pending", "queued", "processing", "sent", "delivered", "read", "failed", "skipped",
  "clicked", "converted", "consent_blocked", "retrying", "dead_letter",
]);

export const consentSourceEnum = pgEnum("comm_consent_source", [
  "walk_in", "website", "lead_form", "invoice", "manual", "import",
]);

export const commAutomationTriggerEnum = pgEnum("comm_automation_trigger", [
  "payment_due", "wash_due", "package_expiry", "birthday", "lead_follow_up",
  "invoice_generated", "payment_received", "amc_reminder",
]);

export const audienceFilterTypeEnum = pgEnum("audience_filter_type", [
  "all_customers", "active_customers", "inactive_customers", "lost_leads", "open_leads",
  "hot_leads", "warm_leads", "cold_leads", "cwp_customers", "dcc_customers", "solar_customers",
  "bidwar_customers", "payment_due", "wash_due", "amc_due", "expiring_package", "no_visit_since_days",
  "multiple_vehicles", "high_value_customers", "revenue_above", "last_visit_between",
]);

/** DLT registered entity (PE ID) */
export const commDltEntitiesTable = pgTable("comm_dlt_entities", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  entityId: text("entity_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** DLT approved sender headers */
export const commDltHeadersTable = pgTable("comm_dlt_headers", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  headerId: text("header_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Approved message templates with DLT registration */
export const commTemplatesTable = pgTable("comm_templates", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  channel: commChannelEnum("channel").notNull().default("sms"),
  category: dltTemplateCategoryEnum("category").notNull().default("transactional"),
  dltTemplateId: text("dlt_template_id"),
  headerId: integer("header_id"),
  subject: text("subject"),
  body: text("body").notNull(),
  variables: json("variables").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Provider configuration — switch providers without code changes */
export const commProvidersTable = pgTable("comm_providers", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  providerType: commProviderTypeEnum("provider_type").notNull(),
  channel: commChannelEnum("channel").notNull(),
  config: json("config").$type<Record<string, string>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  isPrimary: boolean("is_primary").notNull().default(false),
  priority: integer("priority").notNull().default(0),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AudienceFilterNode =
  | { type: "filter"; filter: string; params?: Record<string, unknown> }
  | { type: "smart_segment"; segmentKey: string }
  | { type: "group"; operator: "AND" | "OR"; children: AudienceFilterNode[] };

/** Saved audience definitions with dynamic filter trees */
export const commAudiencesTable = pgTable("comm_audiences", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  description: text("description"),
  filterDefinition: json("filter_definition").$type<AudienceFilterNode>().notNull(),
  estimatedCount: integer("estimated_count"),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Campaigns — channel + audience + template + schedule */
export const commCampaignRecurrenceEnum = pgEnum("comm_campaign_recurrence", [
  "none", "daily", "weekly", "monthly",
]);

export const commCampaignsTable = pgTable("comm_campaigns", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  channel: commChannelEnum("channel").notNull(),
  audienceId: integer("audience_id"),
  templateId: integer("template_id"),
  emailTemplateId: integer("email_template_id"),
  whatsappTemplateId: integer("whatsapp_template_id"),
  status: commCampaignStatusEnum("status").notNull().default("draft"),
  recurrence: commCampaignRecurrenceEnum("recurrence").notNull().default("none"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  costAmount: numeric("cost_amount", { precision: 10, scale: 2 }).default("0"),
  stats: json("stats").$type<{
    sent?: number; delivered?: number; read?: number; failed?: number;
    clicked?: number; converted?: number; revenue?: number;
    consentBlocked?: number; bookingsGenerated?: number; invoicesGenerated?: number; roi?: number;
  }>().default({}),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Per-customer communication consent (TRAI / DPDP compliance) */
export const commCustomerConsentsTable = pgTable("comm_customer_consents", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  brandId: integer("brand_id"),
  smsConsent: boolean("sms_consent").notNull().default(false),
  whatsappConsent: boolean("whatsapp_consent").notNull().default(false),
  emailConsent: boolean("email_consent").notNull().default(false),
  pushConsent: boolean("push_consent").notNull().default(false),
  consentSource: consentSourceEnum("consent_source").notNull().default("manual"),
  consentDate: timestamp("consent_date").notNull().defaultNow(),
  consentIp: text("consent_ip"),
  birthDate: date("birth_date"),
  anniversaryDate: date("anniversary_date"),
  notes: text("notes"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_customer_consents_customer_idx").on(t.customerId),
  index("comm_customer_consents_company_idx").on(t.companyId),
]);

/** Reusable smart audience segments */
export const commSmartSegmentsTable = pgTable("comm_smart_segments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  segmentKey: text("segment_key").notNull(),
  configJson: json("config_json").$type<AudienceFilterNode>().notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  active: boolean("active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_smart_segments_key_company_idx").on(t.segmentKey, t.companyId),
  index("comm_smart_segments_active_idx").on(t.active),
]);

/** Campaign revenue attribution (30-day window) */
export const commCampaignAttributionTable = pgTable("comm_campaign_attribution", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull(),
  customerId: integer("customer_id").notNull(),
  bookingId: integer("booking_id"),
  invoiceId: integer("invoice_id"),
  revenueAmount: numeric("revenue_amount", { precision: 10, scale: 2 }).notNull(),
  attributedAt: timestamp("attributed_at").notNull().defaultNow(),
  companyId: integer("company_id"),
}, (t) => [
  index("comm_attr_campaign_idx").on(t.campaignId),
  index("comm_attr_customer_idx").on(t.customerId),
  index("comm_attr_campaign_customer_idx").on(t.campaignId, t.customerId),
]);

/** Per-recipient communication events — customer timeline + analytics */
export const commEventsTable = pgTable("comm_events", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  campaignId: integer("campaign_id"),
  automationId: integer("automation_id"),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  channel: commChannelEnum("channel").notNull(),
  templateId: integer("template_id"),
  renderedBody: text("rendered_body").notNull(),
  renderedSubject: text("rendered_subject"),
  status: commEventStatusEnum("status").notNull().default("pending"),
  externalId: text("external_id"),
  errorMessage: text("error_message"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  clickedAt: timestamp("clicked_at"),
  convertedAt: timestamp("converted_at"),
  revenue: numeric("revenue", { precision: 10, scale: 2 }),
  retryCount: integer("retry_count").notNull().default(0),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_events_campaign_idx").on(t.campaignId),
  index("comm_events_customer_idx").on(t.customerId),
  index("comm_events_status_idx").on(t.status),
  index("comm_events_created_idx").on(t.createdAt),
  index("comm_events_company_created_idx").on(t.companyId, t.createdAt),
]);

/** Trigger-based automation rules */
export const commAutomationsTable = pgTable("comm_automations", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  name: text("name").notNull(),
  trigger: commAutomationTriggerEnum("trigger").notNull(),
  channel: commChannelEnum("channel").notNull(),
  templateId: integer("template_id").notNull(),
  audienceId: integer("audience_id"),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  config: json("config").$type<Record<string, unknown>>().default({}),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Audit trail for all communication center actions */
export const commAuditLogsTable = pgTable("comm_audit_logs", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id"),
  userId: integer("user_id"),
  payload: json("payload").$type<Record<string, unknown>>(),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCommDltEntitySchema = createInsertSchema(commDltEntitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommTemplateSchema = createInsertSchema(commTemplatesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommCampaignSchema = createInsertSchema(commCampaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommAutomationSchema = createInsertSchema(commAutomationsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type CommDltEntity = typeof commDltEntitiesTable.$inferSelect;
export type CommTemplate = typeof commTemplatesTable.$inferSelect;
export type CommProvider = typeof commProvidersTable.$inferSelect;
export type CommAudience = typeof commAudiencesTable.$inferSelect;
export type CommCampaign = typeof commCampaignsTable.$inferSelect;
export type CommEvent = typeof commEventsTable.$inferSelect;
export type CommAutomation = typeof commAutomationsTable.$inferSelect;
export type CommAuditLog = typeof commAuditLogsTable.$inferSelect;
export type CommCustomerConsent = typeof commCustomerConsentsTable.$inferSelect;
export type CommSmartSegment = typeof commSmartSegmentsTable.$inferSelect;
export type CommCampaignAttribution = typeof commCampaignAttributionTable.$inferSelect;
