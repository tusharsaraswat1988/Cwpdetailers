import { pgTable, serial, varchar, text, integer, boolean, timestamp, json, index } from "drizzle-orm/pg-core";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { servicesTable } from "./services";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: text("subtitle"),
  bannerType: varchar("banner_type", { length: 50 }).notNull().default("first_party"), // 'first_party', 'third_party', 'announcement'
  placement: varchar("placement", { length: 50 }).notNull().default("home_hero"), // 'home_hero', 'home_secondary', 'booking_flow', 'checkout'
  cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "set null" }),
  branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
  serviceId: integer("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  campaignId: integer("campaign_id"),
  badgeText: varchar("badge_text", { length: 100 }),
  imageUrl: text("image_url"),
  desktopImageUrl: text("desktop_image_url"),
  mobileImageUrl: text("mobile_image_url"),
  altText: text("alt_text"),
  ctaText: varchar("cta_text", { length: 100 }),
  ctaLink: varchar("cta_link", { length: 500 }),
  highlights: json("highlights").$type<string[]>(),
  advertiserName: varchar("advertiser_name", { length: 255 }),
  advertiserContact: varchar("advertiser_contact", { length: 255 }),
  adminNotes: text("admin_notes"),
  targetAudience: varchar("target_audience", { length: 50 }).default("all"), // 'all', 'new_customer', 'active_subscriber', 'expired_subscriber'
  status: varchar("status", { length: 20 }).default("published"), // 'draft', 'scheduled', 'published', 'archived'
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
  index("idx_promotions_branch").on(table.branchId),
  index("idx_promotions_placement").on(table.placement),
  index("idx_promotions_active").on(table.isActive),
  index("idx_promotions_status").on(table.status),
]);

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
