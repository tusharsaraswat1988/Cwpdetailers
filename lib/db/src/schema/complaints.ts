import { pgTable, serial, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const complaintTypeEnum = pgEnum("complaint_type", ["quality", "delay", "reclean", "damage", "billing", "other"]);
export const complaintStatusEnum = pgEnum("complaint_status", ["open", "in_progress", "resolved", "closed"]);
export const complaintPriorityEnum = pgEnum("complaint_priority", ["low", "medium", "high"]);

export const complaintsTable = pgTable("complaints", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  bookingId: integer("booking_id"),
  type: complaintTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: complaintStatusEnum("status").notNull().default("open"),
  priority: complaintPriorityEnum("priority").notNull().default("medium"),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  relatedStaffId: integer("related_staff_id"),
  assignedSupervisorId: integer("assigned_supervisor_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertComplaintSchema = createInsertSchema(complaintsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComplaint = z.infer<typeof insertComplaintSchema>;
export type Complaint = typeof complaintsTable.$inferSelect;
