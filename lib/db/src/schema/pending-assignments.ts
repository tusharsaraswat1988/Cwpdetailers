import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contractSourceSystemEnum } from "./customer-contracts";

export const pendingServiceAssignmentsTable = pgTable("pending_service_assignments", {
  id: serial("id").primaryKey(),
  contractRegistryId: integer("contract_registry_id").notNull(),
  customerId: integer("customer_id").notNull(),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  serviceId: integer("service_id"),
  sourceSystem: contractSourceSystemEnum("source_system").notNull(),
  sourceId: integer("source_id").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, t => [
  index("idx_pending_assignments_customer").on(t.customerId),
  index("idx_pending_assignments_status").on(t.status),
]);

export const insertPendingServiceAssignmentSchema = createInsertSchema(pendingServiceAssignmentsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});

export type InsertPendingServiceAssignment = z.infer<typeof insertPendingServiceAssignmentSchema>;
export type PendingServiceAssignment = typeof pendingServiceAssignmentsTable.$inferSelect;
