import { pgTable, serial, text, integer, numeric, boolean, timestamp, pgEnum, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { pricingModelEnum, pricingTypeEnum, serviceStatusEnum } from "./service-catalog";

export const serviceCategoryEnum = pgEnum("service_category", [
  "car_wash", "detailing", "ceramic_coating", "ppf", "interior", "solar_cleaning", "amc", "subscription"
]);

export const assignmentStrategyEnum = pgEnum("assignment_strategy", ["manual", "auto", "round_robin"]);

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug"),
  description: text("description"),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  serviceCategoryId: integer("service_category_id"),
  category: serviceCategoryEnum("category").notNull(),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  pricingType: pricingTypeEnum("pricing_type").notNull().default("inclusive"),
  pricingModel: pricingModelEnum("pricing_model").notNull().default("fixed"),
  durationMinutes: integer("duration_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  status: serviceStatusEnum("status").notNull().default("active"),
  imageUrl: text("image_url"),
  gallery: json("gallery").$type<string[]>().default([]),
  featureIcons: json("feature_icons").$type<string[]>().default([]),
  benefits: json("benefits").$type<string[]>().default([]),
  process: json("process").$type<string[]>().default([]),
  faqs: json("faqs").$type<Array<{ question: string; answer: string }>>().default([]),
  features: json("features").$type<string[]>().default([]),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  ogImageUrl: text("og_image_url"),
  schemaData: json("schema_data").$type<Record<string, unknown>>(),
  assignmentStrategy: assignmentStrategyEnum("assignment_strategy").notNull().default("manual"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
