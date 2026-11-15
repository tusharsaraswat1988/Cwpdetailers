import { pgTable, serial, text, integer, numeric, boolean, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { servicesTable } from "./services";
import { catalogPackagesTable } from "./service-catalog";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { operationalZonesTable } from "./operational-zones";
import { residentialSocietiesTable } from "./societies";
import { usersTable } from "./users";

export const locationPricingRulesTable = pgTable("location_pricing_rules", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  packageId: integer("package_id").references(() => catalogPackagesTable.id, { onDelete: "set null" }),
  cityId: integer("city_id").notNull().references(() => citiesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  zoneId: integer("zone_id").references(() => operationalZonesTable.id, { onDelete: "set null" }),
  societyId: integer("society_id").references(() => residentialSocietiesTable.id, { onDelete: "set null" }),
  locationType: text("location_type").notNull().default("ALL"), // 'ALL', 'GATED_SOCIETY', 'APARTMENT', 'INDIVIDUAL_HOME', 'COMMERCIAL_PROPERTY', 'OTHER'
  vehicleCategoryId: integer("vehicle_category_id"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  pricingType: text("pricing_type").notNull().default("inclusive"), // 'inclusive', 'exclusive'
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  status: text("status").notNull().default("active"), // 'active', 'draft', 'expired', 'archived'
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  notes: text("notes"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_loc_pricing_lookup").on(t.cityId, t.serviceId, t.locationType, t.isActive),
  index("idx_loc_pricing_branch").on(t.branchId, t.isActive),
  index("idx_loc_pricing_zone").on(t.zoneId, t.isActive),
  index("idx_loc_pricing_society").on(t.societyId, t.isActive),
]);

export const pricingRuleAuditTable = pgTable("pricing_rule_audit_logs", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").notNull().references(() => locationPricingRulesTable.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'created', 'updated', 'deactivated', 'price_changed'
  previousValues: jsonb("previous_values"),
  newValues: jsonb("new_values"),
  changedBy: integer("changed_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_pricing_audit_rule").on(t.ruleId),
]);

export const insertLocationPricingRuleSchema = createInsertSchema(locationPricingRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertLocationPricingRule = z.infer<typeof insertLocationPricingRuleSchema>;
export type LocationPricingRule = typeof locationPricingRulesTable.$inferSelect;

export const insertPricingRuleAuditSchema = createInsertSchema(pricingRuleAuditTable).omit({ id: true, createdAt: true });
export type InsertPricingRuleAudit = z.infer<typeof insertPricingRuleAuditSchema>;
export type PricingRuleAudit = typeof pricingRuleAuditTable.$inferSelect;
