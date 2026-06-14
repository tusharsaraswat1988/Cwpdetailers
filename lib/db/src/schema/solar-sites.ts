import { pgTable, serial, text, integer, numeric, date, timestamp, doublePrecision, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const solarSitesTable = pgTable("solar_sites", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  address: text("address").notNull(),
  city: text("city"),
  panelCount: integer("panel_count").notNull(),
  siteName: text("site_name"),
  notes: text("notes"),
  panelCapacityKw: numeric("panel_capacity_kw", { precision: 8, scale: 2 }),
  installationDate: date("installation_date"),
  lastCleanedDate: date("last_cleaned_date"),
  nextServiceDate: date("next_service_date"),
  serviceLat: doublePrecision("service_lat"),
  serviceLng: doublePrecision("service_lng"),
  placeId: text("place_id"),
  locationLabel: text("location_label"),
  locationComplete: boolean("location_complete").notNull().default(false),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSolarSiteSchema = createInsertSchema(solarSitesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSolarSite = z.infer<typeof insertSolarSiteSchema>;
export type SolarSite = typeof solarSitesTable.$inferSelect;
