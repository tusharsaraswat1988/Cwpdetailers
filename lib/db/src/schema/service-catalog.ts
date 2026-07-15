import {
  pgTable, serial, text, integer, numeric, boolean, timestamp, json, pgEnum, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pricingTypeEnum = pgEnum("pricing_type", ["inclusive", "exclusive"]);
export const pricingModelEnum = pgEnum("pricing_model", ["fixed", "vehicle_matrix", "solar_slab"]);
export const serviceStatusEnum = pgEnum("service_status", ["active", "disabled", "archived"]);
export const entitlementTypeEnum = pgEnum("entitlement_type", [
  "wash_credit", "cleaning_credit", "solar_visit", "detailing_credit", "generic",
]);
export const entitlementStatusEnum = pgEnum("entitlement_status", [
  "active", "expired", "exhausted", "cancelled",
]);

/** Global catalog settings (default GST mode, rates, etc.) */
export const catalogSettingsTable = pgTable("catalog_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: json("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** City availability + optional base price override per service */
export const serviceCityAvailabilityTable = pgTable("service_city_availability", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  cityId: integer("city_id").notNull(),
  basePriceOverride: numeric("base_price_override", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Solar panel pricing slabs per service (optionally per city) */
export const solarPricingSlabsTable = pgTable("solar_pricing_slabs", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  cityId: integer("city_id"),
  minPanels: integer("min_panels").notNull().default(1),
  maxPanels: integer("max_panels"),
  pricePerPanel: numeric("price_per_panel", { precision: 10, scale: 2 }).notNull(),
  minimumBilling: numeric("minimum_billing", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Add-on services (wax, vacuum, etc.) */
export const serviceAddonsTable = pgTable("service_addons", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 }).notNull(),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  pricingType: pricingTypeEnum("pricing_type").notNull().default("inclusive"),
  durationMinutes: integer("duration_minutes"),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Link addons to services or categories */
export const serviceAddonLinksTable = pgTable("service_addon_links", {
  id: serial("id").primaryKey(),
  addonId: integer("addon_id").notNull(),
  serviceId: integer("service_id"),
  serviceCategoryId: integer("service_category_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Packages — entitlement containers (distinct from one-off services) */
export const catalogPackagesTable = pgTable("catalog_packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),
  serviceCategoryId: integer("service_category_id"),
  cityId: integer("city_id"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull().default("18"),
  pricingType: pricingTypeEnum("pricing_type").notNull().default("inclusive"),
  validityDays: integer("validity_days").notNull().default(30),
  offDays: json("off_days").$type<number[]>().default([]),
  tag: text("tag"),
  isHighlighted: boolean("is_highlighted").notNull().default(false),
  showOnHomepage: boolean("show_on_homepage").notNull().default(false),
  features: json("features").$type<string[]>().default([]),
  imageUrl: text("image_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: serviceStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** What each package grants */
export const catalogPackageEntitlementsTable = pgTable("catalog_package_entitlements", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull(),
  serviceId: integer("service_id").notNull(),
  entitlementType: entitlementTypeEnum("entitlement_type").notNull(),
  creditCount: integer("credit_count").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Add-ons bundled with a catalog package (from service catalog). */
export const catalogPackageAddonsTable = pgTable("catalog_package_addons", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull(),
  addonId: integer("addon_id").notNull(),
  extraPrice: numeric("extra_price", { precision: 10, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Runtime customer entitlements (credits from packages/AMC) */
export const customerEntitlementsTable = pgTable("customer_entitlements", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  packageId: integer("package_id"),
  subscriptionId: integer("subscription_id"),
  serviceId: integer("service_id").notNull(),
  serviceLocationId: integer("service_location_id"),
  assetId: integer("asset_id"),
  vehicleId: integer("vehicle_id"),
  solarSiteId: integer("solar_site_id"),
  cityId: integer("city_id"),
  entitlementType: entitlementTypeEnum("entitlement_type").notNull(),
  totalCredits: integer("total_credits").notNull(),
  usedCredits: integer("used_credits").notNull().default(0),
  remainingCredits: integer("remaining_credits").notNull(),
  validFrom: date("valid_from").notNull(),
  validUntil: date("valid_until").notNull(),
  status: entitlementStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Entitlement consumption log (audit trail) */
export const entitlementConsumptionLogTable = pgTable("entitlement_consumption_log", {
  id: serial("id").primaryKey(),
  entitlementId: integer("entitlement_id").notNull(),
  bookingId: integer("booking_id"),
  creditsConsumed: integer("credits_consumed").notNull().default(1),
  consumedAt: timestamp("consumed_at").notNull().defaultNow(),
  revertedAt: timestamp("reverted_at"),
});

/** Per-service city SEO + content overrides */
export const serviceCityContentTable = pgTable("service_city_content", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  cityId: integer("city_id").notNull(),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  ogImageUrl: text("og_image_url"),
  schemaData: json("schema_data").$type<Record<string, unknown>>(),
  shortDescription: text("short_description"),
  longDescription: text("long_description"),
  benefits: json("benefits").$type<string[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Homepage CMS sections */
export const homepageSectionsTable = pgTable("homepage_sections", {
  id: serial("id").primaryKey(),
  sectionKey: text("section_key").notNull().unique(),
  title: text("title"),
  subtitle: text("subtitle"),
  content: json("content").$type<Record<string, unknown>>().notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Reminder hooks for future notification engine */
export const catalogReminderHooksTable = pgTable("catalog_reminder_hooks", {
  id: serial("id").primaryKey(),
  hookKey: text("hook_key").notNull().unique(),
  description: text("description"),
  triggerDays: integer("trigger_days"),
  isActive: boolean("is_active").notNull().default(true),
  config: json("config").$type<Record<string, unknown>>().default({}),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCatalogSettingsSchema = createInsertSchema(catalogSettingsTable).omit({ id: true, updatedAt: true });
export const insertServiceAddonSchema = createInsertSchema(serviceAddonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCatalogPackageSchema = createInsertSchema(catalogPackagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerEntitlementSchema = createInsertSchema(customerEntitlementsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertHomepageSectionSchema = createInsertSchema(homepageSectionsTable).omit({ id: true, updatedAt: true });

export type CatalogSetting = typeof catalogSettingsTable.$inferSelect;
export type ServiceAddon = typeof serviceAddonsTable.$inferSelect;
export type CatalogPackage = typeof catalogPackagesTable.$inferSelect;
export type CatalogPackageAddon = typeof catalogPackageAddonsTable.$inferSelect;
export type CustomerEntitlement = typeof customerEntitlementsTable.$inferSelect;
export type HomepageSection = typeof homepageSectionsTable.$inferSelect;
export type SolarPricingSlab = typeof solarPricingSlabsTable.$inferSelect;
