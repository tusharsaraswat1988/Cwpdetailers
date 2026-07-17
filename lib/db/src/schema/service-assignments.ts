import { pgTable, serial, integer, text, timestamp, pgEnum, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { serviceTaskTypeEnum } from "./service-task-type";

/** Phase 5.3 — ends at ready_for_execution. Execution lifecycle is a later phase. */
export const serviceAssignmentStatusEnum = pgEnum("service_assignment_status", [
  "pending",
  "assigned",
  "ready_for_execution",
  "removed",
]);

export const serviceAssignmentsTable = pgTable("service_assignments", {
  id: serial("id").primaryKey(),
  pendingAssignmentId: integer("pending_assignment_id").notNull(),
  customerId: integer("customer_id").notNull(),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  contractId: integer("contract_id").notNull(),
  serviceId: integer("service_id"),
  /** Read-only link when pending.source_system = booking (Booking Engine frozen). */
  bookingId: integer("booking_id"),
  assignedStaffId: integer("assigned_staff_id").notNull(),
  taskType: serviceTaskTypeEnum("task_type").notNull().default("one_time_service"),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  status: serviceAssignmentStatusEnum("status").notNull().default("assigned"),
  serviceLabel: text("service_label"),
  productLine: text("product_line"),
  notes: text("notes"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => [
  uniqueIndex("service_assignments_pending_task_unique").on(t.pendingAssignmentId, t.taskType),
  index("idx_service_assignments_task_type").on(t.taskType),
  index("idx_service_assignments_status").on(t.status),
  index("idx_service_assignments_staff").on(t.assignedStaffId),
  index("idx_service_assignments_location").on(t.serviceLocationId),
  index("idx_service_assignments_contract").on(t.contractId),
  index("idx_service_assignments_booking").on(t.bookingId),
]);

export const insertServiceAssignmentSchema = createInsertSchema(serviceAssignmentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type InsertServiceAssignment = z.infer<typeof insertServiceAssignmentSchema>;
export type ServiceAssignment = typeof serviceAssignmentsTable.$inferSelect;
export type ServiceAssignmentStatus = typeof serviceAssignmentStatusEnum.enumValues[number];
