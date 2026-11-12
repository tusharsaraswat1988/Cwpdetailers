import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const residentialSocietiesTable = pgTable("residential_societies", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull(),
  serviceAreaId: integer("service_area_id"),
  name: text("name").notNull(),
  code: text("code").notNull(),
  address: text("address").notNull(),
  pincode: text("pincode"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  gateSecurityNotes: text("gate_security_notes"),
  totalTowers: integer("total_towers").default(0),
  totalFlats: integer("total_flats").default(0),
  isActive: boolean("is_active").notNull().default(true),
  companyId: integer("company_id"),
  branchId: integer("branch_id"),
  franchiseeId: integer("franchisee_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_societies_city").on(t.cityId),
  index("idx_societies_service_area").on(t.serviceAreaId),
  index("idx_societies_code").on(t.code),
]);

export const societyTowersTable = pgTable("society_towers", {
  id: serial("id").primaryKey(),
  societyId: integer("society_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  totalFloors: integer("total_floors"),
  totalFlats: integer("total_flats"),
  parkingLevels: text("parking_levels"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("idx_society_towers_society").on(t.societyId),
]);

export const insertResidentialSocietySchema = createInsertSchema(residentialSocietiesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocietyTowerSchema = createInsertSchema(societyTowersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertResidentialSociety = z.infer<typeof insertResidentialSocietySchema>;
export type ResidentialSociety = typeof residentialSocietiesTable.$inferSelect;
export type InsertSocietyTower = z.infer<typeof insertSocietyTowerSchema>;
export type SocietyTower = typeof societyTowersTable.$inferSelect;
