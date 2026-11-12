import { pgTable, serial, text, boolean, integer, timestamp, json, numeric, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { servicesTable } from "./services";

export const branchesTable = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  city: text("city").notNull(),
  cityId: integer("city_id"),
  address: text("address"),
  phone: text("phone"),
  managerName: text("manager_name"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  legalEntityId: integer("legal_entity_id"),
  isCompanyOperated: boolean("is_company_operated").notNull().default(true),
  status: text("status").notNull().default("active"),
  serviceAvailability: json("service_availability").$type<string[]>(),
  operationalNotes: text("operational_notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBranchSchema = createInsertSchema(branchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type Branch = typeof branchesTable.$inferSelect;

/** Branch-User Assignment model (PRD v3.0, BR-003) */
export const branchUserAssignmentsTable = pgTable("branch_user_assignments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  assignmentRole: text("assignment_role").notNull().default("branch_manager"),
  isActive: boolean("is_active").notNull().default(true),
  assignedBy: integer("assigned_by").references(() => usersTable.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revocationReason: text("revocation_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  userActiveIdx: index("idx_branch_user_assignments_user_active").on(t.userId, t.isActive),
  branchActiveIdx: index("idx_branch_user_assignments_branch_active").on(t.branchId, t.isActive),
  userBranchIdx: index("idx_branch_user_assignments_user_branch").on(t.userId, t.branchId),
}));

export const insertBranchUserAssignmentSchema = createInsertSchema(branchUserAssignmentsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertBranchUserAssignment = z.infer<typeof insertBranchUserAssignmentSchema>;
export type BranchUserAssignment = typeof branchUserAssignmentsTable.$inferSelect;

/** Branch-Level Service Catalog & Pricing Overrides (PRD v3.0, BR-004) */
export const serviceBranchOverridesTable = pgTable("service_branch_overrides", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  basePriceOverride: numeric("base_price_override", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  customSettings: json("custom_settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, t => ({
  serviceBranchUnique: uniqueIndex("service_branch_overrides_service_branch_unique").on(t.serviceId, t.branchId),
  branchIdx: index("idx_service_branch_overrides_branch").on(t.branchId),
  serviceIdx: index("idx_service_branch_overrides_service").on(t.serviceId),
}));

export const insertServiceBranchOverrideSchema = createInsertSchema(serviceBranchOverridesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertServiceBranchOverride = z.infer<typeof insertServiceBranchOverrideSchema>;
export type ServiceBranchOverride = typeof serviceBranchOverridesTable.$inferSelect;

