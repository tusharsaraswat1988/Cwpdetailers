import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Generated asset URLs (favicons, PWA icons, OG images, etc.) */
export type BrandGeneratedAssets = {
  favicon16?: string;
  favicon32?: string;
  favicon48?: string;
  androidChrome192?: string;
  androidChrome512?: string;
  appleTouchIcon?: string;
  mstile150?: string;
  ogImage?: string;
  twitterCard?: string;
  pwaIcon192?: string;
  pwaIcon512?: string;
  maskable512?: string;
  webpFull?: string;
  webpNavbar?: string;
  iosSplash750x1334?: string;
  iosSplash1170x2532?: string;
  iosSplash1284x2778?: string;
  iosSplash2048x2732?: string;
};

export type BrandSocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  whatsapp?: string;
};

export type BrandSchemaOrg = {
  "@type"?: string;
  name?: string;
  url?: string;
  logo?: string;
  description?: string;
  telephone?: string;
  address?: {
    streetAddress?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    addressCountry?: string;
  };
};

/** Enterprise Branding Management System — single source of truth for all brand assets */
export const platformBrandingTable = pgTable("platform_branding", {
  id: serial("id").primaryKey(),
  isActive: boolean("is_active").notNull().default(true),

  companyName: text("company_name").notNull().default("CWP Detailers + Kleansolar"),
  brandName: text("brand_name").notNull().default("CWP Detailers"),
  tagline: text("tagline").default("Premium Car Care & Solar Cleaning"),
  shortDescription: text("short_description"),

  fullLogoUrl: text("full_logo_url"),
  navbarLogoUrl: text("navbar_logo_url"),
  mobileLogoUrl: text("mobile_logo_url"),
  lightLogoUrl: text("light_logo_url"),
  darkLogoUrl: text("dark_logo_url"),
  loginLogoUrl: text("login_logo_url"),
  logoWhiteUrl: text("logo_white_url"),
  logoTransparentUrl: text("logo_transparent_url"),
  logoSquareUrl: text("logo_square_url"),
  logoIconUrl: text("logo_icon_url"),

  faviconUrl: text("favicon_url"),
  faviconIcoUrl: text("favicon_ico_url"),
  pwaIconUrl: text("pwa_icon_url"),
  appleTouchIconUrl: text("apple_touch_icon_url"),

  emailLogoUrl: text("email_logo_url"),
  invoiceLogoUrl: text("invoice_logo_url"),
  pdfLogoUrl: text("pdf_logo_url"),

  splashLogoUrl: text("splash_logo_url"),
  loaderAnimationUrl: text("loader_animation_url"),
  loaderBackgroundColor: text("loader_background_color"),
  loaderText: text("loader_text").default("Loading…"),

  ogImageUrl: text("og_image_url"),
  twitterImageUrl: text("twitter_image_url"),
  seoKeywords: text("seo_keywords"),
  seoAuthor: text("seo_author"),

  primaryColor: text("primary_color").notNull().default("#00cccc"),
  secondaryColor: text("secondary_color").notNull().default("#212529"),
  accentColor: text("accent_color").notNull().default("#e0ffff"),
  backgroundColor: text("background_color").notNull().default("#f5f6f8"),
  textColor: text("text_color").default("#212529"),

  website: text("website"),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),

  gstNumber: text("gst_number"),
  address: text("address"),

  metaTitleTemplate: text("meta_title_template").default("{brand} | {tagline}"),
  metaDescriptionTemplate: text("meta_description_template"),
  ogTitle: text("og_title"),
  ogDescription: text("og_description"),
  twitterCardType: text("twitter_card_type").default("summary_large_image"),
  twitterTitle: text("twitter_title"),
  twitterDescription: text("twitter_description"),

  socialLinks: jsonb("social_links").$type<BrandSocialLinks>(),
  schemaOrg: jsonb("schema_org").$type<BrandSchemaOrg>(),
  generatedAssets: jsonb("generated_assets").$type<BrandGeneratedAssets>(),

  /** Incremented on each save for cache busting */
  version: integer("version").notNull().default(1),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPlatformBrandingSchema = createInsertSchema(platformBrandingTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlatformBranding = z.infer<typeof insertPlatformBrandingSchema>;
export type PlatformBranding = typeof platformBrandingTable.$inferSelect;
/** Alias for enterprise BMS — maps to platform_branding table */
export type BrandingSettings = PlatformBranding;
