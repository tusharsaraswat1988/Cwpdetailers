import { pgTable, serial, text, integer, timestamp, date, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vehiclesTable } from "./vehicles";
import { solarSitesTable } from "./solar-sites";

export const assetTypeEnum = pgEnum("asset_type", ["vehicle", "solar_site"]);

export const assetStatusEnum = pgEnum("asset_status", ["active", "inactive", "retired"]);

export const customerAssetLinkTypeEnum = pgEnum("customer_asset_link_type", [
  "operational",
  "commercial",
  "historical",
]);

export const assetsTable = pgTable("assets", {
  id: serial("id").primaryKey(),
  assetType: assetTypeEnum("asset_type").notNull(),
  vehicleId: integer("vehicle_id").references(() => vehiclesTable.id),
  solarSiteId: integer("solar_site_id").references(() => solarSitesTable.id),
  label: text("label").notNull(),
  notes: text("notes"),
  status: assetStatusEnum("status").notNull().default("active"),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const locationAssetLinksTable = pgTable("location_asset_links", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  serviceLocationId: integer("service_location_id").notNull(),
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerAssetLinksTable = pgTable("customer_asset_links", {
  id: serial("id").primaryKey(),
  assetId: integer("asset_id").notNull(),
  customerId: integer("customer_id").notNull(),
  linkType: customerAssetLinkTypeEnum("link_type").notNull().default("commercial"),
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Asset = typeof assetsTable.$inferSelect;
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type LocationAssetLink = typeof locationAssetLinksTable.$inferSelect;
export type CustomerAssetLink = typeof customerAssetLinksTable.$inferSelect;
