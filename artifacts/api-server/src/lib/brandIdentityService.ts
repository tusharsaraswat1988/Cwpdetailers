import { v2 as cloudinary } from "cloudinary";
import { eq } from "drizzle-orm";
import {
  db,
  platformBrandingTable,
  type BrandGeneratedAssets,
  type BrandSchemaOrg,
  type BrandSocialLinks,
  type PlatformBranding,
} from "@workspace/db";

const CACHE_TTL_MS = 60_000;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/png", "image/webp", "image/svg+xml"]);

const SVG_UNSAFE = /<script\b|on\w+\s*=|javascript:|data:text\/html|<foreignObject/i;

type CacheEntry = { data: PublicBranding; expiresAt: number };
let publicCache: CacheEntry | null = null;

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
  schemaOrg: BrandSchemaOrg;
  generatedAssets: BrandGeneratedAssets;
  cssVariables: Record<string, string>;
  metaTitle: string;
  metaDescription: string;
};

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

function bust(url: string | null | undefined, version: number): string | null {
  if (!url) return null;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${version}`;
}

function hexToHsl(hex: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  let r = parseInt(m[1], 16) / 255;
  let g = parseInt(m[2], 16) / 255;
  let b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function buildCssVariables(row: PlatformBranding): Record<string, string> {
  const primaryHsl = hexToHsl(row.primaryColor) ?? "180 100% 40%";
  const secondaryHsl = hexToHsl(row.secondaryColor) ?? "220 15% 15%";
  const accentHsl = hexToHsl(row.accentColor) ?? "180 100% 90%";
  return {
    "--brand-primary": row.primaryColor,
    "--brand-secondary": row.secondaryColor,
    "--brand-accent": row.accentColor,
    "--brand-background": row.backgroundColor,
    "--primary": primaryHsl,
    "--secondary": secondaryHsl,
    "--accent": accentHsl,
  };
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function toPublicBranding(row: PlatformBranding): PublicBranding {
  const v = row.version;
  const vars = {
    brand: row.brandName,
    company: row.companyName,
    tagline: row.tagline ?? "",
  };
  const metaTitleTemplate = row.metaTitleTemplate ?? "{brand} | {tagline}";
  const metaDescriptionTemplate =
    row.metaDescriptionTemplate ??
    "Premium car detailing, daily wash subscriptions, and solar panel cleaning services.";

  const generated = row.generatedAssets ?? {};
  const fullLogo = row.fullLogoUrl ?? row.pwaIconUrl;

  return {
    version: v,
    companyName: row.companyName,
    brandName: row.brandName,
    tagline: row.tagline,
    website: row.website,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    gstNumber: row.gstNumber,
    address: row.address,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    fullLogo: bust(fullLogo, v),
    navbarLogo: bust(row.navbarLogoUrl ?? fullLogo, v),
    mobileLogo: bust(row.mobileLogoUrl ?? row.navbarLogoUrl ?? fullLogo, v),
    lightLogo: bust(row.lightLogoUrl ?? fullLogo, v),
    darkLogo: bust(row.darkLogoUrl ?? fullLogo, v),
    loginLogo: bust(row.loginLogoUrl ?? fullLogo, v),
    favicon: bust(row.faviconUrl ?? generated.favicon32 ?? generated.favicon16, v),
    pwaIcon: bust(row.pwaIconUrl ?? generated.pwaIcon512 ?? generated.androidChrome512, v),
    appleTouchIcon: bust(row.appleTouchIconUrl ?? generated.appleTouchIcon, v),
    emailLogo: bust(row.emailLogoUrl ?? fullLogo, v),
    invoiceLogo: bust(row.invoiceLogoUrl ?? fullLogo, v),
    pdfLogo: bust(row.pdfLogoUrl ?? row.invoiceLogoUrl ?? fullLogo, v),
    ogImage: bust(row.ogImageUrl ?? generated.ogImage, v),
    metaTitleTemplate: row.metaTitleTemplate,
    metaDescriptionTemplate: row.metaDescriptionTemplate,
    ogTitle: row.ogTitle ?? row.brandName,
    ogDescription: row.ogDescription ?? metaDescriptionTemplate,
    twitterCardType: row.twitterCardType ?? "summary_large_image",
    twitterTitle: row.twitterTitle ?? row.ogTitle ?? row.brandName,
    twitterDescription: row.twitterDescription ?? row.ogDescription ?? metaDescriptionTemplate,
    socialLinks: row.socialLinks ?? {},
    schemaOrg: row.schemaOrg ?? {
      "@type": "Organization",
      name: row.companyName,
      url: row.website ?? undefined,
      logo: fullLogo ?? undefined,
      description: metaDescriptionTemplate,
      telephone: row.supportPhone ?? undefined,
    },
    generatedAssets: Object.fromEntries(
      Object.entries(generated).map(([k, val]) => [k, bust(val, v)]),
    ) as BrandGeneratedAssets,
    cssVariables: buildCssVariables(row),
    metaTitle: interpolateTemplate(metaTitleTemplate, vars).replace(/\s*\|\s*$/, "").trim(),
    metaDescription: interpolateTemplate(metaDescriptionTemplate, vars),
  };
}

export function invalidateBrandingCache() {
  publicCache = null;
}

export async function getActiveBrandingRow(): Promise<PlatformBranding> {
  const [row] = await db
    .select()
    .from(platformBrandingTable)
    .where(eq(platformBrandingTable.isActive, true))
    .limit(1);

  if (row) return row;

  const [created] = await db
    .insert(platformBrandingTable)
    .values({
      companyName: "CWP Detailers + Kleansolar",
      brandName: "CWP Detailers",
      tagline: "Premium Car Care & Solar Cleaning",
      metaDescriptionTemplate:
        "Premium car detailing, daily wash subscriptions, and solar panel cleaning services.",
    })
    .returning();

  return created;
}

export async function getPublicBranding(force = false): Promise<PublicBranding> {
  const now = Date.now();
  if (!force && publicCache && publicCache.expiresAt > now) {
    return publicCache.data;
  }
  const row = await getActiveBrandingRow();
  const data = toPublicBranding(row);
  publicCache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

export async function getBrandingForAdmin(): Promise<PlatformBranding> {
  return getActiveBrandingRow();
}

export async function updateBranding(
  patch: Partial<Omit<PlatformBranding, "id" | "createdAt">>,
): Promise<PlatformBranding> {
  const current = await getActiveBrandingRow();
  const [updated] = await db
    .update(platformBrandingTable)
    .set({
      ...patch,
      version: (current.version ?? 1) + 1,
      updatedAt: new Date(),
    })
    .where(eq(platformBrandingTable.id, current.id))
    .returning();
  invalidateBrandingCache();
  return updated;
}

export function validateUpload(file: { size: number; contentType: string; name?: string }) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("File exceeds 10 MB limit");
  }
  if (!ALLOWED_MIME.has(file.contentType)) {
    throw new Error("Only SVG, PNG, and WebP uploads are allowed");
  }
}

export function sanitizeSvgContent(svg: string): void {
  if (SVG_UNSAFE.test(svg)) {
    throw new Error("SVG contains unsafe content and was rejected");
  }
}

/** Extract Cloudinary public_id from a secure_url, if applicable. */
function cloudinaryPublicId(url: string): string | null {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
  if (!match) return null;
  return match[1];
}

function transformationUrl(publicId: string, transformation: string): string {
  const cfg = getCloudinaryConfig();
  if (!cfg) return "";
  return `https://res.cloudinary.com/${cfg.cloudName}/image/upload/${transformation}/${publicId}.png`;
}

/**
 * Generate optimized derivative URLs from a source logo using Cloudinary transformations.
 * Falls back to the source URL when Cloudinary is not configured.
 */
export async function processLogoAssets(sourceUrl: string): Promise<BrandGeneratedAssets> {
  const publicId = cloudinaryPublicId(sourceUrl);
  if (!publicId || !getCloudinaryConfig()) {
    return {
      favicon16: sourceUrl,
      favicon32: sourceUrl,
      favicon48: sourceUrl,
      androidChrome192: sourceUrl,
      androidChrome512: sourceUrl,
      appleTouchIcon: sourceUrl,
      mstile150: sourceUrl,
      ogImage: sourceUrl,
      twitterCard: sourceUrl,
      pwaIcon192: sourceUrl,
      pwaIcon512: sourceUrl,
      maskable512: sourceUrl,
      webpFull: sourceUrl,
      webpNavbar: sourceUrl,
    };
  }

  const eagerTransforms = [
    { key: "favicon16", t: "w_16,h_16,c_fit,f_png,q_auto" },
    { key: "favicon32", t: "w_32,h_32,c_fit,f_png,q_auto" },
    { key: "favicon48", t: "w_48,h_48,c_fit,f_png,q_auto" },
    { key: "androidChrome192", t: "w_192,h_192,c_fit,f_png,q_auto" },
    { key: "androidChrome512", t: "w_512,h_512,c_fit,f_png,q_auto" },
    { key: "appleTouchIcon", t: "w_180,h_180,c_fit,f_png,q_auto" },
    { key: "mstile150", t: "w_150,h_150,c_fit,f_png,q_auto" },
    { key: "ogImage", t: "w_1200,h_630,c_pad,b_white,f_jpg,q_auto" },
    { key: "twitterCard", t: "w_1200,h_600,c_pad,b_white,f_jpg,q_auto" },
    { key: "pwaIcon192", t: "w_192,h_192,c_fit,f_png,q_auto" },
    { key: "pwaIcon512", t: "w_512,h_512,c_fit,f_png,q_auto" },
    { key: "maskable512", t: "w_512,h_512,c_pad,b_white,f_png,q_auto" },
    { key: "webpFull", t: "w_800,c_limit,f_webp,q_auto" },
    { key: "webpNavbar", t: "w_200,c_limit,f_webp,q_auto" },
  ] as const;

  const assets: BrandGeneratedAssets = {};
  for (const { key, t } of eagerTransforms) {
    assets[key as keyof BrandGeneratedAssets] = transformationUrl(publicId, t);
  }
  return assets;
}

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

const SLOT_FIELD: Record<BrandAssetSlot, keyof PlatformBranding> = {
  full_logo: "fullLogoUrl",
  navbar_logo: "navbarLogoUrl",
  mobile_logo: "mobileLogoUrl",
  favicon: "faviconUrl",
  pwa_icon: "pwaIconUrl",
  apple_touch_icon: "appleTouchIconUrl",
  email_logo: "emailLogoUrl",
  invoice_logo: "invoiceLogoUrl",
  pdf_logo: "pdfLogoUrl",
  og_image: "ogImageUrl",
  login_logo: "loginLogoUrl",
  light_logo: "lightLogoUrl",
  dark_logo: "darkLogoUrl",
};

export async function assignBrandingAsset(
  slot: BrandAssetSlot,
  url: string,
  options?: { regenerateDerivatives?: boolean },
): Promise<PlatformBranding> {
  const field = SLOT_FIELD[slot];
  const patch: Partial<PlatformBranding> = { [field]: url };

  if (options?.regenerateDerivatives || slot === "full_logo" || slot === "pwa_icon") {
    const generated = await processLogoAssets(url);
    patch.generatedAssets = generated;
    if (slot === "full_logo" || slot === "pwa_icon") {
      const current = await getActiveBrandingRow();
      patch.faviconUrl = generated.favicon32 ?? url;
      patch.pwaIconUrl = generated.pwaIcon512 ?? url;
      patch.appleTouchIconUrl = generated.appleTouchIcon ?? url;
      patch.ogImageUrl = generated.ogImage ?? url;
      if (!current.navbarLogoUrl) patch.navbarLogoUrl = url;
    }
  }

  return updateBranding(patch);
}

export function buildPwaManifest(
  branding: PublicBranding,
  portal: "admin" | "customer" | "staff" | "franchisee",
) {
  const startUrls: Record<string, string> = {
    admin: "/admin/dashboard",
    customer: "/customer/dashboard",
    staff: "/staff/dashboard",
    franchisee: "/franchisee/dashboard",
  };
  const names: Record<string, { name: string; short: string }> = {
    admin: { name: `${branding.brandName} Admin`, short: "Admin" },
    customer: { name: branding.companyName, short: branding.brandName },
    staff: { name: `${branding.brandName} Staff`, short: "Staff" },
    franchisee: { name: `${branding.brandName} Franchise`, short: "Franchise" },
  };
  const icon192 = branding.generatedAssets.pwaIcon192 ?? branding.pwaIcon ?? branding.fullLogo;
  const icon512 = branding.generatedAssets.pwaIcon512 ?? branding.pwaIcon ?? branding.fullLogo;
  const maskable = branding.generatedAssets.maskable512 ?? icon512;

  return {
    name: names[portal].name,
    short_name: names[portal].short,
    description: branding.metaDescription,
    start_url: startUrls[portal],
    scope: `/${portal}/`,
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: branding.primaryColor,
    background_color: branding.backgroundColor,
    icons: [
      ...(icon192 ? [{ src: icon192, sizes: "192x192", type: "image/png", purpose: "any" }] : []),
      ...(icon512 ? [{ src: icon512, sizes: "512x512", type: "image/png", purpose: "any" }] : []),
      ...(maskable ? [{ src: maskable, sizes: "512x512", type: "image/png", purpose: "maskable" }] : []),
    ],
  };
}

/** Server-side helper for PDFs, emails, notifications */
export async function getBrandName(): Promise<string> {
  const b = await getPublicBranding();
  return b.brandName;
}

export async function getInvoiceBranding() {
  const b = await getPublicBranding();
  return {
    companyName: b.companyName,
    brandName: b.brandName,
    gstNumber: b.gstNumber,
    address: b.address,
    supportPhone: b.supportPhone,
    supportEmail: b.supportEmail,
    pdfLogoUrl: b.pdfLogo,
    primaryColor: b.primaryColor,
  };
}
