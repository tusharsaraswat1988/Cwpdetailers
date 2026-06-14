import {
  pgTable, serial, integer, text, boolean, timestamp, pgEnum, json, numeric, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { commChannelEnum } from "./communications";

export const commConversationStatusEnum = pgEnum("comm_conversation_status", [
  "open", "assigned", "pending", "resolved", "closed", "spam",
]);

export const commMessageDirectionEnum = pgEnum("comm_message_direction", [
  "incoming", "outgoing",
]);

export const commMessageDeliveryEnum = pgEnum("comm_message_delivery", [
  "pending", "sent", "delivered", "read", "replied", "failed",
]);

export const commSlaStatusEnum = pgEnum("comm_sla_status", [
  "within_sla", "warning", "breached",
]);

export const commTagSourceEnum = pgEnum("comm_tag_source", ["auto", "manual"]);

export const commJourneyEventTypeEnum = pgEnum("comm_journey_event_type", [
  "lead_created", "lead_assigned", "lead_won", "lead_lost",
  "sms_sent", "sms_received", "whatsapp_sent", "whatsapp_delivered", "whatsapp_read", "whatsapp_replied",
  "email_sent", "email_opened", "email_replied", "push_sent", "in_app_sent",
  "booking_created", "invoice_generated", "payment_received", "package_purchased",
  "service_completed", "review_submitted", "conversation_opened", "conversation_closed",
  "ticket_created", "csat_submitted", "link_clicked", "campaign_converted",
  "customer_reactivated",
]);

export const commKbCategoryEnum = pgEnum("comm_kb_category", [
  "faq", "policy", "script", "response_template",
]);

export const commTicketRuleTriggerEnum = pgEnum("comm_ticket_rule_trigger", [
  "complaint_detected", "payment_issue", "escalation_request", "sla_breach",
]);

/** Unified conversation threads — one per customer/channel context or merged */
export const commConversationsTable = pgTable("comm_conversations", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  primaryChannel: commChannelEnum("primary_channel").notNull().default("whatsapp"),
  status: commConversationStatusEnum("status").notNull().default("open"),
  subject: text("subject"),
  assignedToUserId: integer("assigned_to_user_id"),
  assignedTeamId: integer("assigned_team_id"),
  complaintId: integer("complaint_id"),
  emailThreadId: text("email_thread_id"),
  isUnknownContact: boolean("is_unknown_contact").notNull().default(false),
  unknownPhone: text("unknown_phone"),
  unknownEmail: text("unknown_email"),
  slaPolicyId: integer("sla_policy_id"),
  slaStatus: commSlaStatusEnum("sla_status").notNull().default("within_sla"),
  firstResponseDueAt: timestamp("first_response_due_at"),
  resolutionDueAt: timestamp("resolution_due_at"),
  firstResponseAt: timestamp("first_response_at"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  priority: integer("priority").notNull().default(0),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_conv_customer_idx").on(t.customerId, t.lastMessageAt),
  index("comm_conv_status_idx").on(t.status, t.lastMessageAt),
  index("comm_conv_assigned_user_idx").on(t.assignedToUserId, t.status),
  index("comm_conv_assigned_team_idx").on(t.assignedTeamId, t.status),
  index("comm_conv_brand_idx").on(t.brandId),
  index("comm_conv_unknown_idx").on(t.isUnknownContact, t.status),
  index("comm_conv_email_thread_idx").on(t.emailThreadId),
]);

/** All messages in a conversation thread */
export const commConversationMessagesTable = pgTable("comm_conversation_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  channel: commChannelEnum("channel").notNull(),
  direction: commMessageDirectionEnum("direction").notNull(),
  message: text("message").notNull(),
  attachments: json("attachments").$type<Array<{ type: string; url: string; name?: string }>>().default([]),
  providerMessageId: text("provider_message_id"),
  status: commMessageDeliveryEnum("status").notNull().default("pending"),
  sender: text("sender"),
  receiver: text("receiver"),
  senderUserId: integer("sender_user_id"),
  replyToMessageId: integer("reply_to_message_id"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_conv_msg_conversation_idx").on(t.conversationId, t.createdAt),
  index("comm_conv_msg_provider_idx").on(t.providerMessageId),
]);

/** Private internal notes — not visible to customer */
export const commConversationNotesTable = pgTable("comm_conversation_notes", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  authorUserId: integer("author_user_id").notNull(),
  body: text("body").notNull(),
  mentions: json("mentions").$type<number[]>().default([]),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_conv_notes_conversation_idx").on(t.conversationId, t.createdAt),
]);

/** Teams for auto-assignment */
export const commTeamsTable = pgTable("comm_teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  autoAssignRules: json("auto_assign_rules").$type<Record<string, unknown>>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_teams_code_company_idx").on(t.code, t.companyId),
]);

/** Tags on conversations */
export const commConversationTagsTable = pgTable("comm_conversation_tags", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  tag: text("tag").notNull(),
  source: commTagSourceEnum("source").notNull().default("manual"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_conv_tags_conversation_idx").on(t.conversationId),
  index("comm_conv_tags_tag_idx").on(t.tag),
]);

/** SLA policies */
export const commSlaPoliciesTable = pgTable("comm_sla_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  firstResponseMinutes: integer("first_response_minutes").notNull().default(30),
  resolutionMinutes: integer("resolution_minutes").notNull().default(1440),
  escalationMinutes: integer("escalation_minutes").notNull().default(60),
  warningThresholdPct: integer("warning_threshold_pct").notNull().default(80),
  isDefault: boolean("is_default").notNull().default(false),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Unknown contact queue */
export const commUnknownContactsTable = pgTable("comm_unknown_contacts", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id"),
  phone: text("phone"),
  email: text("email"),
  channel: commChannelEnum("channel").notNull(),
  lastMessage: text("last_message"),
  status: text("status").notNull().default("pending"),
  linkedCustomerId: integer("linked_customer_id"),
  linkedLeadId: integer("linked_lead_id"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_unknown_phone_idx").on(t.phone),
  index("comm_unknown_status_idx").on(t.status),
]);

/** AI assistance layer — schema only, no external AI calls */
export const commAiAssistanceTable = pgTable("comm_ai_assistance", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  summary: text("summary"),
  sentiment: text("sentiment"),
  intent: text("intent"),
  priority: text("priority"),
  replySuggestions: json("reply_suggestions").$type<string[]>().default([]),
  leadQualificationHints: json("lead_qualification_hints").$type<Record<string, unknown>>().default({}),
  status: text("status").notNull().default("pending"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_ai_assist_conversation_idx").on(t.conversationId),
]);

/** Campaign link tracking */
export const commLinkTrackingTable = pgTable("comm_link_tracking", {
  id: serial("id").primaryKey(),
  trackingId: text("tracking_id").notNull(),
  campaignId: integer("campaign_id"),
  customerId: integer("customer_id"),
  brandId: integer("brand_id"),
  originalUrl: text("original_url").notNull(),
  clickCount: integer("click_count").notNull().default(0),
  visitedAt: timestamp("visited_at"),
  convertedAt: timestamp("converted_at"),
  conversionValue: numeric("conversion_value", { precision: 10, scale: 2 }),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_link_tracking_id_idx").on(t.trackingId),
  index("comm_link_campaign_idx").on(t.campaignId),
  index("comm_link_customer_idx").on(t.customerId),
]);

/** Channel costs for profitability */
export const commChannelCostsTable = pgTable("comm_channel_costs", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id"),
  brandId: integer("brand_id"),
  channel: commChannelEnum("channel").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  costAmount: numeric("cost_amount", { precision: 10, scale: 4 }).notNull().default("0"),
  revenueAmount: numeric("revenue_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  companyId: integer("company_id"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, (t) => [
  index("comm_channel_costs_campaign_idx").on(t.campaignId),
  index("comm_channel_costs_brand_channel_idx").on(t.brandId, t.channel),
]);

/** Knowledge base */
export const commKnowledgeBaseTable = pgTable("comm_knowledge_base", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id"),
  title: text("title").notNull(),
  category: commKbCategoryEnum("category").notNull().default("faq"),
  content: text("content").notNull(),
  tags: json("tags").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("comm_kb_category_idx").on(t.category),
  index("comm_kb_brand_idx").on(t.brandId),
]);

/** CSAT surveys */
export const commCsatResponsesTable = pgTable("comm_csat_responses", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  customerId: integer("customer_id"),
  agentUserId: integer("agent_user_id"),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comm_csat_conversation_idx").on(t.conversationId),
  index("comm_csat_agent_idx").on(t.agentUserId),
]);

/** Automatic ticket creation rules */
export const commTicketRulesTable = pgTable("comm_ticket_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trigger: commTicketRuleTriggerEnum("trigger").notNull(),
  tagMatch: text("tag_match"),
  intentMatch: text("intent_match"),
  complaintType: text("complaint_type").notNull().default("other"),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Unified customer journey events */
export const commJourneyEventsTable = pgTable("comm_journey_events", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id"),
  leadId: integer("lead_id"),
  eventType: commJourneyEventTypeEnum("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  metadata: json("metadata").$type<Record<string, unknown>>().default({}),
  brandId: integer("brand_id"),
  companyId: integer("company_id"),
  occurredAt: timestamp("occurred_at").notNull().defaultNow(),
}, (t) => [
  index("comm_journey_customer_idx").on(t.customerId, t.occurredAt),
  index("comm_journey_lead_idx").on(t.leadId, t.occurredAt),
  index("comm_journey_type_idx").on(t.eventType),
]);

/** Agent performance snapshots */
export const commAgentMetricsTable = pgTable("comm_agent_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  periodDate: text("period_date").notNull(),
  messagesHandled: integer("messages_handled").notNull().default(0),
  conversationsClosed: integer("conversations_closed").notNull().default(0),
  avgResponseTimeSec: integer("avg_response_time_sec").notNull().default(0),
  csatAvg: numeric("csat_avg", { precision: 3, scale: 2 }),
  revenueGenerated: numeric("revenue_generated", { precision: 10, scale: 2 }).default("0"),
  companyId: integer("company_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("comm_agent_metrics_user_date_idx").on(t.userId, t.periodDate, t.companyId),
]);

export type CommConversation = typeof commConversationsTable.$inferSelect;
export type CommConversationMessage = typeof commConversationMessagesTable.$inferSelect;
export type CommConversationNote = typeof commConversationNotesTable.$inferSelect;
export type CommTeam = typeof commTeamsTable.$inferSelect;
export type CommConversationTag = typeof commConversationTagsTable.$inferSelect;
export type CommSlaPolicy = typeof commSlaPoliciesTable.$inferSelect;
export type CommUnknownContact = typeof commUnknownContactsTable.$inferSelect;
export type CommAiAssistance = typeof commAiAssistanceTable.$inferSelect;
export type CommLinkTracking = typeof commLinkTrackingTable.$inferSelect;
export type CommChannelCost = typeof commChannelCostsTable.$inferSelect;
export type CommKnowledgeBase = typeof commKnowledgeBaseTable.$inferSelect;
export type CommCsatResponse = typeof commCsatResponsesTable.$inferSelect;
export type CommJourneyEvent = typeof commJourneyEventsTable.$inferSelect;
export type CommAgentMetric = typeof commAgentMetricsTable.$inferSelect;

export const AUTO_TAGS = [
  "payment_issue", "complaint", "service_delay", "interested", "hot_lead",
  "lost_lead", "renewal_candidate", "solar_prospect", "high_value_customer",
] as const;

export const DEFAULT_TEAMS = [
  { name: "Solar Team", code: "solar", description: "Solar cleaning & AMC queries" },
  { name: "Service Team", code: "service", description: "Car wash & detailing" },
  { name: "Sales Team", code: "sales", description: "Leads and quotations" },
  { name: "Support Team", code: "support", description: "General support tickets" },
] as const;
