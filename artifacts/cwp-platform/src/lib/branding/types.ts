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
  website: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  gstNumber: string | null;
  address: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  fullLogo: string | null;
  navbarLogo: string | null;
  mobileLogo: string | null;
  lightLogo: string | null;
  darkLogo: string | null;
  loginLogo: string | null;
  favicon: string | null;
  pwaIcon: string | null;
  appleTouchIcon: string | null;
  emailLogo: string | null;
  invoiceLogo: string | null;
  pdfLogo: string | null;
  ogImage: string | null;
  metaTitleTemplate: string | null;
  metaDescriptionTemplate: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  twitterCardType: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  socialLinks: BrandSocialLinks;
  schemaOrg: Record<string, unknown>;
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
  | "pwa_icon"
  | "apple_touch_icon"
  | "email_logo"
  | "invoice_logo"
  | "pdf_logo"
  | "og_image"
  | "login_logo"
  | "light_logo"
  | "dark_logo";

export const BRANDING_QUERY_KEY = ["branding", "public"] as const;
export const BRANDING_ADMIN_QUERY_KEY = ["branding", "admin"] as const;

export const DEFAULT_BRANDING: PublicBranding = {
  version: 1,
  companyName: "CWP Detailers + Kleansolar",
  brandName: "CWP Detailers",
  tagline: "Premium Car Care & Solar Cleaning",
  website: null,
  supportEmail: null,
  supportPhone: null,
  gstNumber: null,
  address: null,
  primaryColor: "#00cccc",
  secondaryColor: "#212529",
  accentColor: "#e0ffff",
  backgroundColor: "#ffffff",
  fullLogo: null,
  navbarLogo: null,
  mobileLogo: null,
  lightLogo: null,
  darkLogo: null,
  loginLogo: null,
  favicon: null,
  pwaIcon: null,
  appleTouchIcon: null,
  emailLogo: null,
  invoiceLogo: null,
  pdfLogo: null,
  ogImage: null,
  metaTitleTemplate: "{brand} | {tagline}",
  metaDescriptionTemplate: "Premium car detailing, daily wash subscriptions, and solar panel cleaning services.",
  ogTitle: null,
  ogDescription: null,
  twitterCardType: "summary_large_image",
  twitterTitle: null,
  twitterDescription: null,
  socialLinks: {},
  schemaOrg: {},
  generatedAssets: {},
  cssVariables: {
    "--brand-primary": "#00cccc",
    "--brand-secondary": "#212529",
    "--brand-accent": "#e0ffff",
    "--brand-background": "#ffffff",
  },
  metaTitle: "CWP Detailers | Premium Car Care & Solar Cleaning",
  metaDescription: "Premium car detailing, daily wash subscriptions, and solar panel cleaning services.",
};
