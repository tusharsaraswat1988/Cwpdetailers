import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { residentialSocietiesTable } from "./societies";
import { geographicLocalitiesTable } from "./location-hierarchy";
import { servicesTable } from "./services";

export const operationalZonesTable = pgTable("operational_zones", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull().references(() => citiesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  centerLatitude: doublePrecision("center_latitude"),
  centerLongitude: doublePrecision("center_longitude"),
  radiusMeters: integer("radius_meters"),
  boundaryGeoJson: jsonb("boundary_geojson"),
  status: text("status").notNull().default("active"), // 'active', 'inactive', 'maintenance'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_operational_zones_city").on(t.cityId),
  index("idx_operational_zones_branch").on(t.branchId),
  index("idx_operational_zones_status").on(t.status, t.isActive),
]);

export const branchZoneMappingsTable = pgTable("branch_zone_mappings", {
  id: serial("id").primaryKey(),
  branchId: integer("branch_id").notNull().references(() => branchesTable.id, { onDelete: "cascade" }),
  zoneId: integer("zone_id").notNull().references(() => operationalZonesTable.id, { onDelete: "cascade" }),
  isPrimary: boolean("is_primary").notNull().default(true),
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
  effectiveUntil: timestamp("effective_until", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("uq_branch_zone_mapping").on(t.branchId, t.zoneId),
  index("idx_branch_zone_branch").on(t.branchId, t.isActive),
  index("idx_branch_zone_zone").on(t.zoneId, t.isActive),
]);

export const zoneCoverageRulesTable = pgTable("zone_coverage_rules", {
  id: serial("id").primaryKey(),
  zoneId: integer("zone_id").notNull().references(() => operationalZonesTable.id, { onDelete: "cascade" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  coverageType: text("coverage_type").notNull(), // 'society', 'locality', 'pincode', 'property_type', 'all'
  societyId: integer("society_id").references(() => residentialSocietiesTable.id, { onDelete: "cascade" }),
  localityId: integer("locality_id").references(() => geographicLocalitiesTable.id, { onDelete: "cascade" }),
  pincode: text("pincode"),
  propertyType: text("property_type").notNull().default("ALL"), // 'ALL', 'GATED_SOCIETY', 'APARTMENT', 'INDIVIDUAL_HOME', 'COMMERCIAL_PROPERTY', 'OTHER'
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("serviceable"), // 'serviceable', 'not_serviceable', 'coming_soon', 'waitlist'
  rejectionReason: text("rejection_reason"),
  priority: integer("priority").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_zone_coverage_zone").on(t.zoneId, t.isActive),
  index("idx_zone_coverage_society").on(t.societyId, t.isActive),
  index("idx_zone_coverage_locality").on(t.localityId, t.isActive),
  index("idx_zone_coverage_pincode").on(t.pincode, t.isActive),
]);

export const insertOperationalZoneSchema = createInsertSchema(operationalZonesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOperationalZone = z.infer<typeof insertOperationalZoneSchema>;
export type OperationalZone = typeof operationalZonesTable.$inferSelect;

export const insertBranchZoneMappingSchema = createInsertSchema(branchZoneMappingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBranchZoneMapping = z.infer<typeof insertBranchZoneMappingSchema>;
export type BranchZoneMapping = typeof branchZoneMappingsTable.$inferSelect;

export const insertZoneCoverageRuleSchema = createInsertSchema(zoneCoverageRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertZoneCoverageRule = z.infer<typeof insertZoneCoverageRuleSchema>;
export type ZoneCoverageRule = typeof zoneCoverageRulesTable.$inferSelect;
