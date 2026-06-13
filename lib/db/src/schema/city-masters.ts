import { pgTable, serial, text, integer, boolean, timestamp, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const statesTable = pgTable("states", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const citiesTable = pgTable("cities", {
  id: serial("id").primaryKey(),
  stateId: integer("state_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const serviceAreasTable = pgTable("service_areas", {
  id: serial("id").primaryKey(),
  cityId: integer("city_id").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pincodesTable = pgTable("pincodes", {
  id: serial("id").primaryKey(),
  serviceAreaId: integer("service_area_id").notNull(),
  pincode: text("pincode").notNull(),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStateSchema = createInsertSchema(statesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCitySchema = createInsertSchema(citiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertServiceAreaSchema = createInsertSchema(serviceAreasTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPincodeSchema = createInsertSchema(pincodesTable).omit({ id: true, createdAt: true, updatedAt: true });

export type State = typeof statesTable.$inferSelect;
export type City = typeof citiesTable.$inferSelect;
export type ServiceArea = typeof serviceAreasTable.$inferSelect;
export type Pincode = typeof pincodesTable.$inferSelect;
