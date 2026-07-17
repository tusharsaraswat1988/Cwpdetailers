import {
  pgTable, serial, integer, text, timestamp, date, pgEnum, boolean, doublePrecision, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceTaskTypeEnum } from "./service-task-type";

/**
 * Phase 5.4 Field Execution lifecycle (happy path):
 * ready_for_execution → started → paused → resumed → completed
 * Legacy: scheduled (treated as ready), missed, rescheduled kept for history.
 *
 * Phase 5.5: this row IS the Job entity (ADR A — no Job Card).
 * Operational lifecycle lives in ops_status / priority / escalation columns.
 */
export const serviceExecutionStatusEnum = pgEnum("service_execution_status", [
  "scheduled",
  "ready_for_execution",
  "started",
  "paused",
  "resumed",
  "completed",
  "missed",
  "cancelled",
  "rescheduled",
]);

/** Phase 5.5 — operational job lifecycle (orthogonal to field status). */
export const jobOpsStatusEnum = pgEnum("job_ops_status", [
  "in_field",
  "pending_quality_review",
  "reopened",
  "approved",
  "ready_for_billing",
  "cancelled",
]);

export const jobPriorityEnum = pgEnum("job_priority", [
  "low",
  "normal",
  "high",
  "urgent",
]);

export const serviceExecutionPhotoKindEnum = pgEnum("service_execution_photo_kind", [
  "before", "after", "proof", "other",
]);

export const serviceExecutionNoteKindEnum = pgEnum("service_execution_note_kind", [
  "technician", "customer", "internal",
]);

export const serviceExecutionLocationEventEnum = pgEnum("service_execution_location_event", [
  "check_in", "check_out", "gps_ping",
]);

export const serviceExecutionsTable = pgTable("service_executions", {
  id: serial("id").primaryKey(),
  serviceAssignmentId: integer("service_assignment_id"),
  contractId: integer("contract_id").notNull(),
  customerId: integer("customer_id").notNull(),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  assignedStaffId: integer("assigned_staff_id").notNull(),
  taskType: serviceTaskTypeEnum("task_type").notNull().default("one_time_service"),
  isSubstitute: boolean("is_substitute").notNull().default(false),
  substituteForStaffId: integer("substitute_for_staff_id"),
  scheduledDate: date("scheduled_date").notNull(),
  scheduledTime: text("scheduled_time"),
  status: serviceExecutionStatusEnum("status").notNull().default("ready_for_execution"),
  startedAt: timestamp("started_at"),
  pausedAt: timestamp("paused_at"),
  resumedAt: timestamp("resumed_at"),
  completedAt: timestamp("completed_at"),
  customerSignatureUrl: text("customer_signature_url"),
  customerSignedAt: timestamp("customer_signed_at"),
  cancellationReason: text("cancellation_reason"),
  rescheduledFromId: integer("rescheduled_from_id"),
  /** Phase 5.5 Job Orchestration (Job = this row). */
  opsStatus: jobOpsStatusEnum("ops_status").notNull().default("in_field"),
  priority: jobPriorityEnum("priority").notNull().default("normal"),
  dependsOnExecutionId: integer("depends_on_execution_id"),
  isEscalated: boolean("is_escalated").notNull().default(false),
  escalationReason: text("escalation_reason"),
  escalatedAt: timestamp("escalated_at"),
  escalatedBy: integer("escalated_by"),
  opsOwnerUserId: integer("ops_owner_user_id"),
  qualityReviewStartedAt: timestamp("quality_review_started_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by"),
  readyForBillingAt: timestamp("ready_for_billing_at"),
  reopenedAt: timestamp("reopened_at"),
  reopenReason: text("reopen_reason"),
  opsCancelledAt: timestamp("ops_cancelled_at"),
  opsCancelReason: text("ops_cancel_reason"),
  legacyBookingId: integer("legacy_booking_id"),
  legacyDcmsVisitId: integer("legacy_dcms_visit_id"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => [
  index("idx_service_executions_assignment").on(t.serviceAssignmentId),
  index("idx_service_executions_staff_date").on(t.assignedStaffId, t.scheduledDate),
  index("idx_service_executions_task_type").on(t.taskType),
  index("idx_service_executions_status").on(t.status),
  index("idx_service_executions_customer").on(t.customerId),
  index("idx_service_executions_scheduled_date").on(t.scheduledDate),
  index("idx_service_executions_ops_status").on(t.opsStatus),
  index("idx_service_executions_priority").on(t.priority),
  index("idx_service_executions_escalated").on(t.isEscalated),
  index("idx_service_executions_depends_on").on(t.dependsOnExecutionId),
]);

export const serviceExecutionPhotosTable = pgTable("service_execution_photos", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  kind: serviceExecutionPhotoKindEnum("kind").notNull().default("proof"),
  url: text("url").notNull(),
  caption: text("caption"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  accuracy: doublePrecision("accuracy"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => [
  index("idx_service_execution_photos_execution").on(t.executionId),
]);

export const serviceExecutionNotesTable = pgTable("service_execution_notes", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  kind: serviceExecutionNoteKindEnum("kind").notNull().default("technician"),
  body: text("body").notNull(),
  authorStaffId: integer("author_staff_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => [
  index("idx_service_execution_notes_execution").on(t.executionId),
]);

export const serviceExecutionChecklistItemsTable = pgTable("service_execution_checklist_items", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  label: text("label").notNull(),
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, t => [
  index("idx_service_execution_checklist_execution").on(t.executionId),
]);

export const serviceExecutionLocationLogsTable = pgTable("service_execution_location_logs", {
  id: serial("id").primaryKey(),
  executionId: integer("execution_id").notNull(),
  eventType: serviceExecutionLocationEventEnum("event_type").notNull().default("gps_ping"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  accuracy: doublePrecision("accuracy"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
}, t => [
  index("idx_service_execution_location_execution").on(t.executionId),
]);

export const insertServiceExecutionSchema = createInsertSchema(serviceExecutionsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type ServiceExecution = typeof serviceExecutionsTable.$inferSelect;
export type InsertServiceExecution = z.infer<typeof insertServiceExecutionSchema>;
export type ServiceExecutionStatus = typeof serviceExecutionStatusEnum.enumValues[number];
export type JobOpsStatus = typeof jobOpsStatusEnum.enumValues[number];
export type JobPriority = typeof jobPriorityEnum.enumValues[number];
