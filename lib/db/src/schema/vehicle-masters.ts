import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vehicleCategoriesTable = pgTable("vehicle_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const seatCategoriesTable = pgTable("seat_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  seatCount: integer("seat_count").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const fuelTypesTable = pgTable("fuel_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vehicleBrandsTable = pgTable("vehicle_brands", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const vehicleModelsTable = pgTable("vehicle_models", {
  id: serial("id").primaryKey(),
  brandId: integer("brand_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  vehicleCategoryId: integer("vehicle_category_id").notNull(),
  seatCategoryId: integer("seat_category_id").notNull(),
  fuelTypeId: integer("fuel_type_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertVehicleCategorySchema = createInsertSchema(vehicleCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSeatCategorySchema = createInsertSchema(seatCategoriesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFuelTypeSchema = createInsertSchema(fuelTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVehicleBrandSchema = createInsertSchema(vehicleBrandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVehicleModelSchema = createInsertSchema(vehicleModelsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type VehicleCategory = typeof vehicleCategoriesTable.$inferSelect;
export type SeatCategory = typeof seatCategoriesTable.$inferSelect;
export type FuelType = typeof fuelTypesTable.$inferSelect;
export type VehicleBrand = typeof vehicleBrandsTable.$inferSelect;
export type VehicleModel = typeof vehicleModelsTable.$inferSelect;
