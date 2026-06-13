import { pgTable, serial, text, integer, numeric, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCategoriesTable = pgTable("service_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  iconUrl: text("icon_url"),
  legacyCategory: text("legacy_category"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const servicePlansTable = pgTable("service_plans", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  durationMonths: integer("duration_months"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  features: json("features").$type<string[]>().default([]),
  tag: text("tag"),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const servicePricingTable = pgTable("service_pricing", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  vehicleCategoryId: integer("vehicle_category_id"),
  seatCategoryId: integer("seat_category_id"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceCategorySchema = createInsertSchema(serviceCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServicePlanSchema = createInsertSchema(servicePlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServicePricingSchema = createInsertSchema(servicePricingTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ServiceCategory = typeof serviceCategoriesTable.$inferSelect;
export type ServicePlan = typeof servicePlansTable.$inferSelect;
export type ServicePricing = typeof servicePricingTable.$inferSelect;
