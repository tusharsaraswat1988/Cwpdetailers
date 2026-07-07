export type BrandSocialLinks = {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
  whatsapp?: string;
};

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

export type PublicBranding = {
  version: number;
  companyName: string;
  brandName: string;
  tagline: string | null;
  shortDescription: string | null;
  website: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  gstNumber: string | null;
  address: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fullLogo: string | null;
  navbarLogo: string | null;
  mobileLogo: string | null;
  lightLogo: string | null;
  darkLogo: string | null;
  loginLogo: string | null;
  logoWhite: string | null;
  logoTransparent: string | null;
  logoSquare: string | null;
  logoIcon: string | null;
  favicon: string | null;
  faviconIco: string | null;
  pwaIcon: string | null;
  appleTouchIcon: string | null;
  emailLogo: string | null;
  invoiceLogo: string | null;
  pdfLogo: string | null;
  splashLogo: string | null;
  loaderAnimation: string | null;
  loaderBackground: string | null;
  loaderText: string;
  ogImage: string | null;
  twitterImage: string | null;
  seoKeywords: string | null;
  seoAuthor: string | null;
  metaTitleTemplate: string | null;
  metaDescriptionTemplate: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCardType: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  socialLinks: BrandSocialLinks;
  schemaOrg: Record<string, unknown>;
  localBusinessSchema: Record<string, unknown>;
  generatedAssets: BrandGeneratedAssets;
  cssVariables: Record<string, string>;
  metaTitle: string;
  metaDescription: string;
};

export type BrandAssetSlot =
  | "full_logo"
  | "navbar_logo"
  | "mobile_logo"
  | "favicon"
  | "favicon_ico"
  | "pwa_icon"
  | "apple_touch_icon"
  | "email_logo"
  | "invoice_logo"
  | "pdf_logo"
  | "og_image"
  | "twitter_image"
  | "login_logo"
  | "light_logo"
  | "dark_logo"
  | "white_logo"
  | "transparent_logo"
  | "square_logo"
  | "logo_icon"
  | "splash_logo"
  | "loader_animation";

import { buildThemeCssVariables, CWP_THEME_DEFAULTS } from "./buildThemeCssVariables";

export const BRANDING_QUERY_KEY = ["branding", "public"] as const;
export const BRANDING_ADMIN_QUERY_KEY = ["branding", "admin"] as const;

/** Neutral fallback before branding loads from API — no hardcoded brand identity */
export const DEFAULT_BRANDING: PublicBranding = {
  version: 0,
  companyName: "",
  brandName: "",
  tagline: null,
  shortDescription: null,
  website: null,
  supportEmail: null,
  supportPhone: null,
  gstNumber: null,
  address: null,
  primaryColor: CWP_THEME_DEFAULTS.primaryColor,
  secondaryColor: CWP_THEME_DEFAULTS.secondaryColor,
  accentColor: CWP_THEME_DEFAULTS.accentColor,
  backgroundColor: CWP_THEME_DEFAULTS.backgroundColor,
  textColor: CWP_THEME_DEFAULTS.textColor,
  fullLogo: null,
  navbarLogo: null,
  mobileLogo: null,
  lightLogo: null,
  darkLogo: null,
  loginLogo: null,
  logoWhite: null,
  logoTransparent: null,
  logoSquare: null,
  logoIcon: null,
  favicon: null,
  faviconIco: null,
  pwaIcon: null,
  appleTouchIcon: null,
  emailLogo: null,
  invoiceLogo: null,
  pdfLogo: null,
  splashLogo: null,
  loaderAnimation: null,
  loaderBackground: CWP_THEME_DEFAULTS.backgroundColor,
  loaderText: "Loading…",
  ogImage: null,
  twitterImage: null,
  seoKeywords: null,
  seoAuthor: null,
  metaTitleTemplate: "{brand} | {tagline}",
  metaDescriptionTemplate: null,
  ogTitle: null,
  ogDescription: null,
  twitterCardType: "summary_large_image",
  twitterTitle: null,
  twitterDescription: null,
  socialLinks: {},
  schemaOrg: {},
  localBusinessSchema: {},
  generatedAssets: {},
  cssVariables: buildThemeCssVariables(CWP_THEME_DEFAULTS),
  metaTitle: "Loading…",
  metaDescription: "",
};
