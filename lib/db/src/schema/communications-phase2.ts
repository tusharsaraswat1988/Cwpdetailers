import {
  pgTable, serial, integer, text, boolean, timestamp, pgEnum, json, numeric, date, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import {
  commChannelEnum, dltTemplateCategoryEnum, consentSourceEnum,
} from "./communications";

/** Extended delivery lifecycle for retry engine */
export const commDeliveryStatusEnum = pgEnum("comm_delivery_status", [
  "queued", "processing", "sent", "delivered", "read", "failed", "retrying", "dead_letter",
]);

export const commBrandStatusEnum = pgEnum("comm_brand_status", ["active", "inactive", "archived"]);

export const commDltTemplateStatusEnum = pgEnum("comm_dlt_template_status", [
  "draft", "pending_approval", "approved", "rejected", "suspended",
]);

export const commEmailTypeEnum = pgEnum("comm_email_type", [
  "marketing", "transactional", "service",
]);

export const commWhatsappCategoryEnum = pgEnum("comm_whatsapp_category", [
  "marketing", "utility", "authentication",
]);

export const commWhatsappApprovalEnum = pgEnum("comm_whatsapp_approval_status", [
  "draft", "pending", "approved", "rejected",
]);

export const commAutomationStepTypeEnum = pgEnum("comm_automation_step_type", [
  "send_sms", "send_whatsapp", "send_email", "send_push", "create_task",
  "assign_staff", "wait", "branch",
]);

export const commAutomationRunStatusEnum = pgEnum("comm_automation_run_status", [
  "pending", "running", "completed", "failed", "cancelled",
]);

export const commQueueNameEnum = pgEnum("comm_queue_name", [
  "sms_queue", "whatsapp_queue", "email_queue", "push_queue",
]);

export const commAiRecommendationTypeEnum = pgEnum("comm_ai_recommendation_type", [
  "best_send_time", "campaign_suggestion", "segment_suggestion", "reactivation",
]);

/** Phase 2 automation triggers (superset — legacy triggers remain in phase1 enum) */
export const commWorkflowTriggerEnum = pgEnum("comm_workflow_trigger", [
  "lead_created", "lead_lost", "lead_won", "customer_registered", "package_purchased",
  "invoice_generated", "payment_received", "payment_due", "wash_due", "solar_cleaning_due",
  "amc_due", "package_expiry", "no_visit_30_days", "no_visit_60_days", "no_visit_90_days",
  "birthday", "anniversary",
]);

/** Multi-brand registry */
export const commBrandsTable = pgTable("comm_brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  status: commBrandStatusEnum("status").notNull().default("active"),
  logo: text("logo"),
  primaryColor: text("primary_color"),
  emailSender: text("email_sender"),
  emailReplyTo: text("email_reply_to"),
  defaultSmsHeader: text("default_sms_header"),
  defaultWhatsappNumber: text("default_whatsapp_number"),
  defaultSupportNumber: text("default_support_number"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_brands_code_company_idx").on(t.code, t.companyId),
  index("comm_brands_status_idx").on(t.status),
]);

/** DLT governance — approved templates with validation metadata */
export const commDltTemplatesTable = pgTable("comm_dlt_templates", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  entityId: integer("entity_id").notNull(),
  headerId: integer("header_id").notNull(),
  templateId: text("template_id").notNull(),
  name: text("name").notNull(),
  templateType: dltTemplateCategoryEnum("template_type").notNull(),
  approvedContent: text("approved_content").notNull(),
  variables: json("variables").$type<string[]>().default([]),
  status: commDltTemplateStatusEnum("status").notNull().default("approved"),
  approvalDate: timestamp("approval_date"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_dlt_templates_brand_template_idx").on(t.brandId, t.templateId),
  index("comm_dlt_templates_brand_idx").on(t.brandId),
  index("comm_dlt_templates_status_idx").on(t.status),
]);

/** Centralized communication timeline (denormalized for fast customer profile reads) */
export const commTimelineTable = pgTable("comm_timeline", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  channel: commChannelEnum("channel").notNull(),
  templateId: integer("template_id"),
  campaignId: integer("campaign_id"),
  automationId: integer("automation_id"),
  eventId: integer("event_id"),
  message: text("message").notNull(),
  subject: text("subject"),
  status: text("status").notNull(),
  provider: text("provider"),
  deliveryStatus: commDeliveryStatusEnum("delivery_status").notNull().default("queued"),
  readStatus: boolean("read_status").notNull().default(false),
  clicked: boolean("clicked").notNull().default(false),
  responded: boolean("responded").notNull().default(false),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_timeline_customer_idx").on(t.customerId, t.createdAt),
  index("comm_timeline_brand_idx").on(t.brandId),
  index("comm_timeline_campaign_idx").on(t.campaignId),
  index("comm_timeline_created_idx").on(t.createdAt),
]);

/** Email template center */
export const commEmailTemplatesTable = pgTable("comm_email_templates", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content").notNull(),
  emailType: commEmailTypeEnum("email_type").notNull().default("transactional"),
  variables: json("variables").$type<string[]>().default([]),
  attachments: json("attachments").$type<Array<{ name: string; url: string }>>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_email_templates_brand_idx").on(t.brandId),
]);

/** WhatsApp template center (Meta-approved) */
export const commWhatsappTemplatesTable = pgTable("comm_whatsapp_templates", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  metaTemplateName: text("meta_template_name").notNull(),
  category: commWhatsappCategoryEnum("category").notNull(),
  language: text("language").notNull().default("en"),
  bodyPreview: text("body_preview").notNull(),
  variables: json("variables").$type<string[]>().default([]),
  approvalStatus: commWhatsappApprovalEnum("approval_status").notNull().default("approved"),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_wa_templates_brand_name_idx").on(t.brandId, t.metaTemplateName, t.language),
  index("comm_wa_templates_brand_idx").on(t.brandId),
]);

/** Workflow automation definitions (Phase 2 — multi-step) */
export const commWorkflowsTable = pgTable("comm_workflows", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  name: text("name").notNull(),
  trigger: commWorkflowTriggerEnum("trigger").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  config: json("config").$type<Record<string, unknown>>().default({}),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_workflows_brand_trigger_idx").on(t.brandId, t.trigger),
]);

export type WorkflowStepConfig = {
  templateId?: number;
  emailTemplateId?: number;
  whatsappTemplateId?: number;
  waitMinutes?: number;
  branchCondition?: Record<string, unknown>;
  staffId?: number;
  taskTitle?: string;
};

/** Steps within a workflow */
export const commWorkflowStepsTable = pgTable("comm_workflow_steps", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  stepOrder: integer("step_order").notNull(),
  stepType: commAutomationStepTypeEnum("step_type").notNull(),
  config: json("config").$type<WorkflowStepConfig>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_workflow_steps_workflow_idx").on(t.workflowId, t.stepOrder),
]);

/** Workflow execution runs */
export const commWorkflowRunsTable = pgTable("comm_workflow_runs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").notNull(),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  currentStepId: integer("current_step_id"),
  status: commAutomationRunStatusEnum("status").notNull().default("pending"),
  context: json("context").$type<Record<string, unknown>>().default({}),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_workflow_runs_workflow_idx").on(t.workflowId),
  index("comm_workflow_runs_customer_idx").on(t.customerId),
  index("comm_workflow_runs_status_idx").on(t.status),
]);

/** Message queue jobs (BullMQ mirror + DB fallback) */
export const commQueueJobsTable = pgTable("comm_queue_jobs", {
  id: serial("id").primaryKey(),
  queueName: commQueueNameEnum("queue_name").notNull(),
  bullJobId: text("bull_job_id"),
  eventId: integer("event_id"),
  campaignId: integer("campaign_id"),
  brandId: integer("brand_id"),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  status: commDeliveryStatusEnum("status").notNull().default("queued"),
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(4),
  nextRetryAt: timestamp("next_retry_at"),
  lastError: text("last_error"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_queue_jobs_status_retry_idx").on(t.status, t.nextRetryAt),
  index("comm_queue_jobs_queue_idx").on(t.queueName, t.status),
  index("comm_queue_jobs_event_idx").on(t.eventId),
]);

/** Dead-letter queue for permanently failed messages */
export const commDeadLetterTable = pgTable("comm_dead_letter", {
  id: serial("id").primaryKey(),
  queueJobId: integer("queue_job_id"),
  eventId: integer("event_id"),
  channel: commChannelEnum("channel").notNull(),
  payload: json("payload").$type<Record<string, unknown>>(),
  error: text("error").notNull(),
  brandId: integer("brand_id"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_dead_letter_brand_idx").on(t.brandId),
  index("comm_dead_letter_created_idx").on(t.createdAt),
]);

/** Consent change history */
export const commConsentHistoryTable = pgTable("comm_consent_history", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  brandId: integer("brand_id"),
  smsConsent: boolean("sms_consent"),
  whatsappConsent: boolean("whatsapp_consent"),
  emailConsent: boolean("email_consent"),
  pushConsent: boolean("push_consent"),
  consentSource: consentSourceEnum("consent_source"),
  changedBy: integer("changed_by"),
  consentIp: text("consent_ip"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_consent_history_customer_idx").on(t.customerId, t.createdAt),
]);

/** AI readiness — schema only, no implementation */
export const commAiRecommendationsTable = pgTable("comm_ai_recommendations", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  recommendationType: commAiRecommendationTypeEnum("recommendation_type").notNull(),
  targetEntity: text("target_entity"),
  targetId: integer("target_id"),
  suggestion: json("suggestion").$type<Record<string, unknown>>().notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }),
  status: text("status").notNull().default("pending"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_ai_rec_brand_type_idx").on(t.brandId, t.recommendationType),
]);

export const insertCommBrandSchema = createInsertSchema(commBrandsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type CommBrand = typeof commBrandsTable.$inferSelect;
export type CommDltTemplate = typeof commDltTemplatesTable.$inferSelect;
export type CommTimelineEntry = typeof commTimelineTable.$inferSelect;
export type CommEmailTemplate = typeof commEmailTemplatesTable.$inferSelect;
export type CommWhatsappTemplate = typeof commWhatsappTemplatesTable.$inferSelect;
export type CommWorkflow = typeof commWorkflowsTable.$inferSelect;
export type CommWorkflowStep = typeof commWorkflowStepsTable.$inferSelect;
export type CommWorkflowRun = typeof commWorkflowRunsTable.$inferSelect;
export type CommQueueJob = typeof commQueueJobsTable.$inferSelect;
export type CommDeadLetter = typeof commDeadLetterTable.$inferSelect;
export type CommConsentHistory = typeof commConsentHistoryTable.$inferSelect;
export type CommAiRecommendation = typeof commAiRecommendationsTable.$inferSelect;
