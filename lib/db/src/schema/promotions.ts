import { pgTable, serial, varchar, text, integer, boolean, timestamp, json, index } from "drizzle-orm/pg-core";
import { citiesTable } from "./city-masters";
import { servicesTable } from "./services";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: text("subtitle"),
  bannerType: varchar("banner_type", { length: 50 }).notNull().default("first_party"), // 'first_party', 'third_party', 'announcement'
  placement: varchar("placement", { length: 50 }).notNull().default("home_hero"), // 'home_hero', 'home_secondary', 'booking_flow', 'checkout'
  cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "set null" }),
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  badgeText: varchar("badge_text", { length: 100 }),
  imageUrl: text("image_url"),
  mobileImageUrl: text("mobile_image_url"),
  ctaText: varchar("cta_text", { length: 100 }),
  ctaLink: varchar("cta_link", { length: 500 }),
  highlights: json("highlights").$type<string[]>(),
  advertiserName: varchar("advertiser_name", { length: 255 }),
  advertiserContact: varchar("advertiser_contact", { length: 255 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  clickCount: integer("click_count").notNull().default(0),
  impressionCount: integer("impression_count").notNull().default(0),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_promotions_city").on(table.cityId),
  index("idx_promotions_placement").on(table.placement),
  index("idx_promotions_active").on(table.isActive),
]);

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
