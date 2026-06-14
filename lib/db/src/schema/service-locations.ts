import { pgTable, serial, text, integer, boolean, timestamp, date, pgEnum, doublePrecision, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceLocationTypeEnum = pgEnum("service_location_type", [
  "office",
  "factory",
  "residence",
  "parking",
  "other",
]);

export const serviceLocationStatusEnum = pgEnum("service_location_status", ["active", "inactive"]);

export const serviceLocationsTable = pgTable("service_locations", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  address: text("address"),
  city: text("city"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  placeId: text("place_id"),
  locationType: serviceLocationTypeEnum("location_type").notNull().default("other"),
  status: serviceLocationStatusEnum("status").notNull().default("active"),
  isAutoCreated: boolean("is_auto_created").notNull().default(false),
  companyId: integer("company_id"),
  franchiseeId: integer("franchisee_id"),
  branchId: integer("branch_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const customerLocationLinksTable = pgTable("customer_location_links", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  serviceLocationId: integer("service_location_id").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  effectiveFrom: date("effective_from"),
  effectiveUntil: date("effective_until"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("customer_location_links_customer_location_unique").on(t.customerId, t.serviceLocationId),
]);

export const insertServiceLocationSchema = createInsertSchema(serviceLocationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomerLocationLinkSchema = createInsertSchema(customerLocationLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ServiceLocation = typeof serviceLocationsTable.$inferSelect;
export type InsertServiceLocation = z.infer<typeof insertServiceLocationSchema>;
export type CustomerLocationLink = typeof customerLocationLinksTable.$inferSelect;
export type InsertCustomerLocationLink = z.infer<typeof insertCustomerLocationLinkSchema>;
