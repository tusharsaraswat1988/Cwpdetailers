import { pgTable, serial, text, integer, numeric, boolean, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceCategoryEnum = pgEnum("service_category", [
  "car_wash", "detailing", "ceramic_coating", "ppf", "interior", "solar_cleaning", "amc", "subscription"
]);

export const assignmentStrategyEnum = pgEnum("assignment_strategy", ["manual", "auto", "round_robin"]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  serviceCategoryId: integer("service_category_id"),
  category: serviceCategoryEnum("category").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  durationMinutes: integer("duration_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  imageUrl: text("image_url"),
  features: json("features").$type<string[]>().default([]),
  assignmentStrategy: assignmentStrategyEnum("assignment_strategy").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
