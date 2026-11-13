import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { citiesTable } from "./city-masters";
import { branchesTable } from "./branches";
import { promotionsTable } from "./promotions";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Homepage Sections Configuration
// ─────────────────────────────────────────────────────────────────────────────
export const homepageSectionsTable = pgTable(
  "homepage_sections",
  {
    id: serial("id").primaryKey(),
    sectionKey: varchar("section_key", { length: 60 }).notNull(),
    title: varchar("title", { length: 255 }),
    subtitle: text("subtitle"),
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    isEnabled: boolean("is_enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    content: jsonb("content").$type<Record<string, unknown>>().default({}),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_homepage_sections_city").on(table.cityId),
    index("idx_homepage_sections_branch").on(table.branchId),
    index("idx_homepage_sections_key").on(table.sectionKey),
    index("idx_homepage_sections_sort").on(table.sortOrder),
    index("idx_homepage_sections_enabled").on(table.isEnabled),
  ]
);

export type HomepageSection = typeof homepageSectionsTable.$inferSelect;
export type InsertHomepageSection = typeof homepageSectionsTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 2. Marketing Campaigns & Promotional Offers
// ─────────────────────────────────────────────────────────────────────────────
export const marketingCampaignsTable = pgTable(
  "marketing_campaigns",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }),
    offerType: varchar("offer_type", { length: 50 }).notNull().default("percentage_discount"), // 'percentage_discount', 'flat_discount', 'fixed_price'
    discountValue: numeric("discount_value", { precision: 10, scale: 2 }).notNull().default("0"),
    minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }).default("0"),
    maxDiscountAmount: numeric("max_discount_amount", { precision: 10, scale: 2 }),
    applicableServiceIds: jsonb("applicable_service_ids").$type<number[]>().default([]),
    applicablePackageIds: jsonb("applicable_package_ids").$type<string[]>().default([]),
    applicableVehicleCategories: jsonb("applicable_vehicle_categories").$type<string[]>().default([]),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    perCustomerLimit: integer("per_customer_limit").default(1),
    eligibilityRule: varchar("eligibility_rule", { length: 50 }).default("all"), // 'all', 'first_time_customer', 'active_subscriber'
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    status: varchar("status", { length: 20 }).notNull().default("active"), // 'draft', 'active', 'paused', 'expired'
    termsAndConditions: text("terms_and_conditions"),
    bannerId: integer("banner_id").references(() => promotionsTable.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_marketing_campaigns_code").on(table.code),
    index("idx_marketing_campaigns_city").on(table.cityId),
    index("idx_marketing_campaigns_branch").on(table.branchId),
    index("idx_marketing_campaigns_status").on(table.status),
    index("idx_marketing_campaigns_active").on(table.isActive),
  ]
);

export type MarketingCampaign = typeof marketingCampaignsTable.$inferSelect;
export type InsertMarketingCampaign = typeof marketingCampaignsTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 3. City-Wise Landing Pages & Dynamic SEO Overrides
// ─────────────────────────────────────────────────────────────────────────────
export const cityLandingPagesTable = pgTable(
  "city_landing_pages",
  {
    id: serial("id").primaryKey(),
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "cascade" }).notNull(),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 100 }).notNull(),
    pageTitle: text("page_title").notNull(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoKeywords: text("seo_keywords"),
    canonicalUrl: text("canonical_url"),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImage: text("og_image"),
    heroHeadline: text("hero_headline"),
    heroSubheadline: text("hero_subheadline"),
    customFaqs: jsonb("custom_faqs").$type<Array<{ question: string; answer: string }>>().default([]),
    customTestimonials: jsonb("custom_testimonials")
      .$type<Array<{ author: string; rating: number; review: string; vehicle?: string; society?: string }>>()
      .default([]),
    localizedContent: jsonb("localized_content").$type<Record<string, unknown>>().default({}),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_city_landing_city_branch_slug").on(table.cityId, table.branchId, table.slug),
    index("idx_city_landing_slug").on(table.slug),
    index("idx_city_landing_published").on(table.isPublished),
  ]
);

export type CityLandingPage = typeof cityLandingPagesTable.$inferSelect;
export type InsertCityLandingPage = typeof cityLandingPagesTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 4. Marketing Media Assets Library
// ─────────────────────────────────────────────────────────────────────────────
export const marketingMediaAssetsTable = pgTable(
  "marketing_media_assets",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    altText: text("alt_text"),
    fileUrl: text("file_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    fileType: varchar("file_type", { length: 50 }),
    fileSizeBytes: integer("file_size_bytes"),
    width: integer("width"),
    height: integer("height"),
    tags: jsonb("tags").$type<string[]>().default([]),
    cityId: integer("city_id").references(() => citiesTable.id, { onDelete: "set null" }),
    branchId: integer("branch_id").references(() => branchesTable.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_media_assets_city").on(table.cityId),
    index("idx_media_assets_branch").on(table.branchId),
    index("idx_media_assets_active").on(table.isActive),
  ]
);

export type MarketingMediaAsset = typeof marketingMediaAssetsTable.$inferSelect;
export type InsertMarketingMediaAsset = typeof marketingMediaAssetsTable.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────────
// 5. Marketing Analytics & Campaign Conversion Events
// ─────────────────────────────────────────────────────────────────────────────
export const marketingEventsTable = pgTable(
  "marketing_events",
  {
    id: serial("id").primaryKey(),
    eventType: varchar("event_type", { length: 50 }).notNull(), // 'banner_impression', 'banner_click', 'campaign_view', 'coupon_applied', 'campaign_conversion'
    bannerId: integer("banner_id"),
    campaignId: integer("campaign_id"),
    cityId: integer("city_id"),
    branchId: integer("branch_id"),
    customerId: integer("customer_id"),
    sessionId: text("session_id"),
    orderId: text("order_id"),
    conversionValue: numeric("conversion_value", { precision: 10, scale: 2 }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_mkt_events_type_time").on(table.eventType, table.recordedAt),
    index("idx_mkt_events_city_type").on(table.cityId, table.eventType),
    index("idx_mkt_events_campaign").on(table.campaignId),
    index("idx_mkt_events_banner").on(table.bannerId),
  ]
);

export type MarketingEvent = typeof marketingEventsTable.$inferSelect;
export type InsertMarketingEvent = typeof marketingEventsTable.$inferInsert;
