import {
  boolean, integer, jsonb, pgEnum, pgTable, serial, text, timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const legalPageStatusEnum = pgEnum("legal_page_status", ["draft", "published"]);

// ─── Legal Pages (CMS) ───────────────────────────────────────────────────────

/**
 * One row per legal page slug. Each save creates a version snapshot.
 * Public pages render the live published record; drafts are admin-only.
 */
export const legalPagesTable = pgTable("legal_pages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),           // e.g. "privacy-policy"
  title: text("title").notNull(),
  status: legalPageStatusEnum("status").notNull().default("draft"),

  // Rich content (HTML string from editor)
  content: text("content").notNull().default(""),

  // SEO
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  canonicalUrl: text("canonical_url"),

  // Open Graph
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),

  // Audit
  lastUpdatedBy: text("last_updated_by"),           // editor name/email
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Legal Page Version History ───────────────────────────────────────────────

export const legalPageVersionsTable = pgTable("legal_page_versions", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => legalPagesTable.id, { onDelete: "cascade" }),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords"),
  canonicalUrl: text("canonical_url"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  savedBy: text("saved_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Business Information ─────────────────────────────────────────────────────

/**
 * Single row (id=1) — single source of truth for all business details.
 * Referenced by Contact Us page, footer, SEO schemas, invoices, email templates.
 */
export const businessInfoTable = pgTable("business_info", {
  id: serial("id").primaryKey(),

  businessName: text("business_name").notNull().default("CWP Detailers And Motors"),
  ownerName: text("owner_name").notNull().default("Tushar Saraswat"),
  businessType: text("business_type").notNull().default("Proprietorship"),
  gstNumber: text("gst_number"),

  supportEmail: text("support_email").notNull().default("cwpdetailers@gmail.com"),
  supportPhone: text("support_phone").notNull().default("+91-7054007733"),
  whatsappNumber: text("whatsapp_number"),
  alternatePhone: text("alternate_phone"),

  addressLine1: text("address_line1").notNull().default("Seer Goverdhanpur, Behind BHU"),
  addressLine2: text("address_line2"),
  city: text("city").notNull().default("Varanasi"),
  state: text("state").notNull().default("Uttar Pradesh"),
  pinCode: text("pin_code").notNull().default("221005"),
  country: text("country").notNull().default("India"),

  // Services offered
  services: jsonb("services").$type<string[]>().default([
    "Car Wash", "Solar Panel Cleaning & Maintenance", "Vehicle Detailing",
    "Ceramic Coating", "Graphene Coating", "PPF", "Bike Detailing", "Dent & Paint Services",
  ]),

  // Social links
  facebook: text("facebook"),
  instagram: text("instagram"),
  youtube: text("youtube"),
  linkedin: text("linkedin"),
  twitter: text("twitter"),

  website: text("website"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Refund Policy Settings ───────────────────────────────────────────────────

export const refundPolicySettingsTable = pgTable("refund_policy_settings", {
  id: serial("id").primaryKey(),

  refundEligibleCases: jsonb("refund_eligible_cases").$type<string[]>().default([
    "Service failure on company side",
    "Service not delivered as promised",
    "Duplicate payment",
    "Technical error in payment processing",
  ]),
  nonRefundableCases: jsonb("non_refundable_cases").$type<string[]>().default([
    "Customer-initiated cancellation",
    "Service already rendered",
    "Partial service completion at customer request",
  ]),
  refundProcessingDays: text("refund_processing_days").notNull().default("7-10 business days"),
  cancellationRules: text("cancellation_rules").notNull().default("Cancellations initiated by the customer are non-refundable. Company-side failures are fully eligible for refund."),
  advancePaymentRules: text("advance_payment_rules"),
  partialPaymentRules: text("partial_payment_rules"),
  fullPaymentRules: text("full_payment_rules"),
  settlementInfo: text("settlement_info"),
  acceptedPaymentMethods: jsonb("accepted_payment_methods").$type<string[]>().default([
    "UPI", "Credit Card", "Debit Card", "Net Banking", "Wallets",
  ]),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Google OAuth Compliance ──────────────────────────────────────────────────

export const oauthComplianceSettingsTable = pgTable("oauth_compliance_settings", {
  id: serial("id").primaryKey(),

  dataCollected: text("data_collected").notNull().default("Name, Email address, Profile photo"),
  dataUsageDescription: text("data_usage_description").notNull().default("We use your name, email and profile image solely to create and manage your account on our platform. We do not share or sell your data to any third party."),
  dataRetentionDescription: text("data_retention_description").notNull().default("We retain your personal data for as long as your account is active. Upon deletion request, data is permanently removed within 30 days."),
  dataDeletionProcess: text("data_deletion_process").notNull().default("Users can request data deletion by emailing cwpdetailers@gmail.com. We will process the request within 30 days."),
  privacyPolicyUrl: text("privacy_policy_url").notNull().default("/privacy-policy"),
  termsUrl: text("terms_url").notNull().default("/terms-and-conditions"),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── SEO Settings ────────────────────────────────────────────────────────────

export const seoSettingsTable = pgTable("seo_settings", {
  id: serial("id").primaryKey(),

  siteTitle: text("site_title").notNull().default("CWP Detailers And Motors — Professional Car Detailing in Varanasi"),
  siteDescription: text("site_description").notNull().default("CWP Detailers And Motors offers professional car wash, vehicle detailing, ceramic coating, PPF, graphene coating, solar panel cleaning, and bike detailing services in Varanasi, UP."),
  metaKeywords: text("meta_keywords"),
  canonicalDomain: text("canonical_domain").notNull().default("https://cwpdetailers.in"),

  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  ogImage: text("og_image"),

  twitterCardType: text("twitter_card_type").default("summary_large_image"),
  twitterTitle: text("twitter_title"),
  twitterDescription: text("twitter_description"),

  robotsIndex: boolean("robots_index").notNull().default(true),
  robotsFollow: boolean("robots_follow").notNull().default(true),
  robotsAdditionalRules: text("robots_additional_rules"),

  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const insertLegalPageSchema = createInsertSchema(legalPagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLegalPageVersionSchema = createInsertSchema(legalPageVersionsTable).omit({ id: true, createdAt: true });
export const insertBusinessInfoSchema = createInsertSchema(businessInfoTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRefundPolicySettingsSchema = createInsertSchema(refundPolicySettingsTable).omit({ id: true, updatedAt: true });
export const insertOauthComplianceSettingsSchema = createInsertSchema(oauthComplianceSettingsTable).omit({ id: true, updatedAt: true });
export const insertSeoSettingsSchema = createInsertSchema(seoSettingsTable).omit({ id: true, updatedAt: true });

export type LegalPage = typeof legalPagesTable.$inferSelect;
export type LegalPageVersion = typeof legalPageVersionsTable.$inferSelect;
export type BusinessInfo = typeof businessInfoTable.$inferSelect;
export type RefundPolicySettings = typeof refundPolicySettingsTable.$inferSelect;
export type OauthComplianceSettings = typeof oauthComplianceSettingsTable.$inferSelect;
export type SeoSettings = typeof seoSettingsTable.$inferSelect;

export type InsertLegalPage = z.infer<typeof insertLegalPageSchema>;
