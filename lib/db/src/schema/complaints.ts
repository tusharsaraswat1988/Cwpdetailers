import { pgTable, serial, integer, text, timestamp, pgEnum, boolean, json, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const complaintTypeEnum = pgEnum("complaint_type", [
  "quality", "delay", "reclean", "damage", "billing", "subscription", "other"
]);
export const complaintStatusEnum = pgEnum("complaint_status", [
  "open", "assigned", "in_progress", "awaiting_customer", "resolved", "closed"
]);
export const complaintPriorityEnum = pgEnum("complaint_priority", [
  "low", "medium", "high", "urgent"
]);

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  ticketNumber: text("ticket_number"),
  customerId: integer("customer_id").notNull(),
  cityId: integer("city_id"),
  bookingId: integer("booking_id"),
  subscriptionId: integer("subscription_id"),
  visitId: integer("visit_id"),
  invoiceId: integer("invoice_id"),
  operationalExceptionId: integer("operational_exception_id"),
  type: complaintTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  photoUrl: text("photo_url"),
  internalNotes: text("internal_notes"),
  status: complaintStatusEnum("status").notNull().default("open"),
  priority: complaintPriorityEnum("priority").notNull().default("medium"),
  slaPolicyId: integer("sla_policy_id"),
  responseDueAt: timestamp("response_due_at"),
  resolutionDueAt: timestamp("resolution_due_at"),
  firstRespondedAt: timestamp("first_responded_at"),
  slaPausedAt: timestamp("sla_paused_at"),
  slaTotalPausedMinutes: integer("sla_total_paused_minutes").default(0),
  slaStatus: text("sla_status").default("on_track"), // 'on_track' | 'approaching_breach' | 'breached'
  escalationLevel: integer("escalation_level").default(0),
  escalatedAt: timestamp("escalated_at"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  relatedStaffId: integer("related_staff_id"),
  assignedSupervisorId: integer("assigned_supervisor_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  ticketNumberIdx: uniqueIndex("idx_complaints_ticket_number").on(t.ticketNumber),
  customerStatusIdx: index("idx_complaints_customer_status").on(t.customerId, t.status),
  cityIdx: index("idx_complaints_city").on(t.cityId),
  branchIdx: index("idx_complaints_branch").on(t.branchId),
  subscriptionIdx: index("idx_complaints_sub").on(t.subscriptionId),
}));

export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id").notNull(),
  senderType: text("sender_type").notNull(), // 'customer' | 'staff' | 'admin' | 'system'
  senderId: integer("sender_id"),
  senderName: text("sender_name").notNull(),
  message: text("message").notNull(),
  isInternal: boolean("is_internal").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  complaintIdx: index("idx_ticket_messages_complaint").on(t.complaintId, t.createdAt),
}));

export const slaPoliciesTable = pgTable("sla_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  cityId: integer("city_id"),
  serviceType: text("service_type"),
  category: text("category").notNull().default("all"),
  priority: text("priority").notNull().default("all"),
  responseTargetMinutes: integer("response_target_minutes").notNull().default(720),
  resolutionTargetMinutes: integer("resolution_target_minutes").notNull().default(1440),
  pauseOnCustomerResponse: boolean("pause_on_customer_response").notNull().default(true),
  escalationLevel1Minutes: integer("escalation_level_1_minutes"),
  escalationLevel2Minutes: integer("escalation_level_2_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => ({
  cityIdx: index("idx_sla_policies_city").on(t.cityId),
  priorityIdx: index("idx_sla_policies_priority").on(t.priority),
  activeIdx: index("idx_sla_policies_active").on(t.isActive),
}));

export const slaEscalationLogsTable = pgTable("sla_escalation_logs", {
  id: serial("id").primaryKey(),
  complaintId: integer("complaint_id"),
  operationalExceptionId: integer("operational_exception_id"),
  slaPolicyId: integer("sla_policy_id"),
  escalationLevel: integer("escalation_level").notNull(),
  reason: text("reason").notNull(),
  escalatedToRole: text("escalated_to_role").notNull(),
  escalatedToUserId: integer("escalated_to_user_id"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => ({
  complaintIdx: index("idx_sla_escalation_complaint").on(t.complaintId),
  levelIdx: index("idx_sla_escalation_level").on(t.escalationLevel),
}));

export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Complaint = typeof complaintsTable.$inferSelect;

export const insertSupportTicketMessageSchema = createInsertSchema(supportTicketMessagesTable).omit({ id: true, createdAt: true });
export type InsertSupportTicketMessage = z.infer<typeof insertSupportTicketMessageSchema>;
export type SupportTicketMessage = typeof supportTicketMessagesTable.$inferSelect;

export const insertSlaPolicySchema = createInsertSchema(slaPoliciesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSlaPolicy = z.infer<typeof insertSlaPolicySchema>;
export type SlaPolicy = typeof slaPoliciesTable.$inferSelect;

export type SlaEscalationLog = typeof slaEscalationLogsTable.$inferSelect;
