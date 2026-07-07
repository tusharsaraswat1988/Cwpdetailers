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
  schemaOrg: BrandSchemaOrg;
  localBusinessSchema: BrandSchemaOrg;
  generatedAssets: BrandGeneratedAssets;
  cssVariables: Record<string, string>;
  metaTitle: string;
  metaDescription: string;
};

/** Asset keys for the brand asset library — request assets by key, not file path */
export type BrandAssetKey =
  | "main_logo"
  | "navbar_logo"
  | "dark_logo"
  | "light_logo"
  | "white_logo"
  | "transparent_logo"
  | "square_logo"
  | "logo_icon"
  | "footer_logo"
  | "email_logo"
  | "invoice_logo"
  | "favicon"
  | "favicon_ico"
  | "favicon_16"
  | "favicon_32"
  | "favicon_48"
  | "apple_touch"
  | "android_192"
  | "android_512"
  | "maskable_icon"
  | "seo_image"
  | "twitter_image"
  | "splash_logo"
  | "loader"
  | "loader_background"
  | "pwa_icon";

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
  const textHsl = hexToHsl(row.textColor ?? "#212529") ?? "220 40% 10%";
  return {
    "--brand-primary": row.primaryColor,
    "--brand-secondary": row.secondaryColor,
    "--brand-accent": row.accentColor,
    "--brand-background": row.backgroundColor,
    "--brand-text": row.textColor ?? "#212529",
    "--primary": primaryHsl,
    "--secondary": secondaryHsl,
    "--accent": accentHsl,
    "--foreground": textHsl,
  };
}

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

function buildLocalBusinessSchema(row: PlatformBranding, fullLogo: string | null, description: string): BrandSchemaOrg {
  const base = row.schemaOrg ?? {};
  return {
    "@type": "LocalBusiness",
    name: row.companyName || row.brandName,
    url: row.website ?? undefined,
    logo: fullLogo ?? undefined,
    description,
    telephone: row.supportPhone ?? undefined,
    email: row.supportEmail ?? undefined,
    ...base,
  };
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
    row.shortDescription ??
    "";

  const generated = row.generatedAssets ?? {};
  const fullLogo = row.fullLogoUrl ?? row.pwaIconUrl;

  const schemaDescription = metaDescriptionTemplate;
  const orgSchema: BrandSchemaOrg = row.schemaOrg ?? {
    "@type": "Organization",
    name: row.companyName || row.brandName,
    url: row.website ?? undefined,
    logo: fullLogo ?? undefined,
    description: schemaDescription,
    telephone: row.supportPhone ?? undefined,
  };

  return {
    version: v,
    companyName: row.companyName,
    brandName: row.brandName,
    tagline: row.tagline,
    shortDescription: row.shortDescription,
    website: row.website,
    supportEmail: row.supportEmail,
    supportPhone: row.supportPhone,
    gstNumber: row.gstNumber,
    address: row.address,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    accentColor: row.accentColor,
    backgroundColor: row.backgroundColor,
    textColor: row.textColor ?? "#212529",
    fullLogo: bust(fullLogo, v),
    navbarLogo: bust(row.navbarLogoUrl ?? fullLogo, v),
    mobileLogo: bust(row.mobileLogoUrl ?? row.navbarLogoUrl ?? fullLogo, v),
    lightLogo: bust(row.lightLogoUrl ?? fullLogo, v),
    darkLogo: bust(row.darkLogoUrl ?? fullLogo, v),
    loginLogo: bust(row.loginLogoUrl ?? fullLogo, v),
    logoWhite: bust(row.logoWhiteUrl ?? row.lightLogoUrl ?? fullLogo, v),
    logoTransparent: bust(row.logoTransparentUrl ?? fullLogo, v),
    logoSquare: bust(row.logoSquareUrl ?? row.pwaIconUrl ?? fullLogo, v),
    logoIcon: bust(row.logoIconUrl ?? row.pwaIconUrl ?? fullLogo, v),
    favicon: bust(row.faviconUrl ?? generated.favicon32 ?? generated.favicon16, v),
    faviconIco: bust(row.faviconIcoUrl ?? row.faviconUrl ?? generated.favicon32, v),
    pwaIcon: bust(row.pwaIconUrl ?? generated.pwaIcon512 ?? generated.androidChrome512, v),
    appleTouchIcon: bust(row.appleTouchIconUrl ?? generated.appleTouchIcon, v),
    emailLogo: bust(row.emailLogoUrl ?? fullLogo, v),
    invoiceLogo: bust(row.invoiceLogoUrl ?? fullLogo, v),
    pdfLogo: bust(row.pdfLogoUrl ?? row.invoiceLogoUrl ?? fullLogo, v),
    splashLogo: bust(row.splashLogoUrl ?? row.loginLogoUrl ?? fullLogo, v),
    loaderAnimation: bust(row.loaderAnimationUrl, v),
    loaderBackground: row.loaderBackgroundColor ?? row.backgroundColor,
    loaderText: row.loaderText ?? "Loading…",
    ogImage: bust(row.ogImageUrl ?? generated.ogImage, v),
    twitterImage: bust(row.twitterImageUrl ?? row.ogImageUrl ?? generated.twitterCard, v),
    seoKeywords: row.seoKeywords,
    seoAuthor: row.seoAuthor,
    metaTitleTemplate: row.metaTitleTemplate,
    metaDescriptionTemplate: row.metaDescriptionTemplate,
    ogTitle: row.ogTitle ?? row.brandName,
    ogDescription: row.ogDescription ?? metaDescriptionTemplate,
    twitterCardType: row.twitterCardType ?? "summary_large_image",
    twitterTitle: row.twitterTitle ?? row.ogTitle ?? row.brandName,
    twitterDescription: row.twitterDescription ?? row.ogDescription ?? metaDescriptionTemplate,
    socialLinks: row.socialLinks ?? {},
    schemaOrg: orgSchema,
    localBusinessSchema: buildLocalBusinessSchema(row, fullLogo, schemaDescription),
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
      companyName: "",
      brandName: "",
      tagline: "",
      metaDescriptionTemplate: "",
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

  if (
    patch.backgroundColor &&
    patch.backgroundColor !== current.backgroundColor &&
    !patch.generatedAssets
  ) {
    const source = current.fullLogoUrl ?? current.pwaIconUrl;
    if (source) {
      patch.generatedAssets = await processLogoAssets(source, {
        backgroundColor: patch.backgroundColor,
      });
    }
  }

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

function cloudinaryBgHex(hex: string): string {
  const normalized = hex.replace("#", "").trim();
  return normalized.length === 6 ? normalized.toUpperCase() : "FFFFFF";
}

/**
 * Generate optimized derivative URLs from a source logo using Cloudinary transformations.
 * Falls back to the source URL when Cloudinary is not configured.
 */
export async function processLogoAssets(
  sourceUrl: string,
  options?: { backgroundColor?: string },
): Promise<BrandGeneratedAssets> {
  const bg = cloudinaryBgHex(options?.backgroundColor ?? "#ffffff");
  const fallbackSplash = sourceUrl;

  if (!cloudinaryPublicId(sourceUrl) || !getCloudinaryConfig()) {
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
      iosSplash750x1334: fallbackSplash,
      iosSplash1170x2532: fallbackSplash,
      iosSplash1284x2778: fallbackSplash,
      iosSplash2048x2732: fallbackSplash,
    };
  }

  const publicId = cloudinaryPublicId(sourceUrl)!;

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
    { key: "maskable512", t: "w_512,h_512,c_pad,b_rgb:" + bg + ",f_png,q_auto" },
    { key: "webpFull", t: "w_800,c_limit,f_webp,q_auto" },
    { key: "webpNavbar", t: "w_200,c_limit,f_webp,q_auto" },
    { key: "iosSplash750x1334", t: `w_750,h_1334,c_pad,b_rgb:${bg},f_png,q_auto` },
    { key: "iosSplash1170x2532", t: `w_1170,h_2532,c_pad,b_rgb:${bg},f_png,q_auto` },
    { key: "iosSplash1284x2778", t: `w_1284,h_2778,c_pad,b_rgb:${bg},f_png,q_auto` },
    { key: "iosSplash2048x2732", t: `w_2048,h_2732,c_pad,b_rgb:${bg},f_png,q_auto` },
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

const SLOT_FIELD: Record<BrandAssetSlot, keyof PlatformBranding> = {
  full_logo: "fullLogoUrl",
  navbar_logo: "navbarLogoUrl",
  mobile_logo: "mobileLogoUrl",
  favicon: "faviconUrl",
  favicon_ico: "faviconIcoUrl",
  pwa_icon: "pwaIconUrl",
  apple_touch_icon: "appleTouchIconUrl",
  email_logo: "emailLogoUrl",
  invoice_logo: "invoiceLogoUrl",
  pdf_logo: "pdfLogoUrl",
  og_image: "ogImageUrl",
  twitter_image: "twitterImageUrl",
  login_logo: "loginLogoUrl",
  light_logo: "lightLogoUrl",
  dark_logo: "darkLogoUrl",
  white_logo: "logoWhiteUrl",
  transparent_logo: "logoTransparentUrl",
  square_logo: "logoSquareUrl",
  logo_icon: "logoIconUrl",
  splash_logo: "splashLogoUrl",
  loader_animation: "loaderAnimationUrl",
};

/** Resolve a brand asset by semantic key */
export function getBrandAsset(branding: PublicBranding, key: BrandAssetKey): string | null {
  const ga = branding.generatedAssets;
  const map: Record<BrandAssetKey, string | null | undefined> = {
    main_logo: branding.fullLogo,
    navbar_logo: branding.navbarLogo,
    dark_logo: branding.darkLogo,
    light_logo: branding.lightLogo,
    white_logo: branding.logoWhite,
    transparent_logo: branding.logoTransparent,
    square_logo: branding.logoSquare,
    logo_icon: branding.logoIcon,
    footer_logo: branding.lightLogo ?? branding.fullLogo,
    email_logo: branding.emailLogo,
    invoice_logo: branding.invoiceLogo,
    favicon: branding.favicon,
    favicon_ico: branding.faviconIco,
    favicon_16: ga.favicon16,
    favicon_32: ga.favicon32,
    favicon_48: ga.favicon48,
    apple_touch: branding.appleTouchIcon,
    android_192: ga.androidChrome192 ?? ga.pwaIcon192,
    android_512: ga.androidChrome512 ?? ga.pwaIcon512,
    maskable_icon: ga.maskable512,
    seo_image: branding.ogImage,
    twitter_image: branding.twitterImage,
    splash_logo: branding.splashLogo,
    loader: branding.loaderAnimation,
    loader_background: branding.loaderBackground,
    pwa_icon: branding.pwaIcon,
  };
  return map[key] ?? null;
}

export async function assignBrandingAsset(
  slot: BrandAssetSlot,
  url: string,
  options?: { regenerateDerivatives?: boolean },
): Promise<PlatformBranding> {
  const field = SLOT_FIELD[slot];
  const patch: Partial<PlatformBranding> = { [field]: url };

  if (options?.regenerateDerivatives || slot === "full_logo" || slot === "pwa_icon") {
    const current = await getActiveBrandingRow();
    const generated = await processLogoAssets(url, { backgroundColor: current.backgroundColor });
    patch.generatedAssets = generated;
    if (slot === "full_logo" || slot === "pwa_icon") {
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
  portal: "main" | "admin" | "customer" | "staff" | "franchisee",
) {
  const startUrls: Record<string, string> = {
    main: "/",
    admin: "/admin/dashboard",
    customer: "/customer/dashboard",
    staff: "/staff/dashboard",
    franchisee: "/franchisee/dashboard",
  };
  const scopes: Record<string, string> = {
    main: "/",
    admin: "/admin/",
    customer: "/customer/",
    staff: "/staff/",
    franchisee: "/franchisee/",
  };
  const names: Record<string, { name: string; short: string }> = {
    main: { name: branding.companyName, short: branding.brandName },
    admin: { name: `${branding.brandName} Admin`, short: "Admin" },
    customer: { name: branding.companyName, short: branding.brandName },
    staff: { name: `${branding.brandName} Staff`, short: "Staff" },
    franchisee: { name: `${branding.brandName} Franchise`, short: "Franchise" },
  };
  const icon192 = branding.generatedAssets.pwaIcon192 ?? branding.pwaIcon ?? branding.fullLogo;
  const icon512 = branding.generatedAssets.pwaIcon512 ?? branding.pwaIcon ?? branding.fullLogo;
  const maskable = branding.generatedAssets.maskable512 ?? icon512;
  const apple180 = branding.appleTouchIcon ?? branding.generatedAssets.appleTouchIcon;

  return {
    name: names[portal].name,
    short_name: names[portal].short,
    description: branding.metaDescription,
    start_url: startUrls[portal],
    scope: scopes[portal],
    id: scopes[portal],
    display: "standalone",
    display_override: ["standalone", "browser"],
    orientation: portal === "main" ? "any" : "portrait-primary",
    theme_color: branding.primaryColor,
    background_color: branding.backgroundColor,
    categories: ["business", "lifestyle"],
    icons: [
      ...(icon192 ? [{ src: icon192, sizes: "192x192", type: "image/png", purpose: "any" }] : []),
      ...(icon512 ? [{ src: icon512, sizes: "512x512", type: "image/png", purpose: "any" }] : []),
      ...(apple180 ? [{ src: apple180, sizes: "180x180", type: "image/png", purpose: "any" }] : []),
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
    website: b.website,
    pdfLogoUrl: b.pdfLogo,
    primaryColor: b.primaryColor,
  };
}

/** Full branding context for outgoing emails */
export async function getEmailBranding() {
  const b = await getPublicBranding();
  return {
    brandName: b.brandName,
    companyName: b.companyName,
    logoUrl: b.emailLogo ?? b.fullLogo,
    primaryColor: b.primaryColor,
    supportEmail: b.supportEmail,
    supportPhone: b.supportPhone,
    website: b.website,
    footerText: `${b.brandName}${b.supportEmail ? ` · ${b.supportEmail}` : ""}${b.website ? ` · ${b.website}` : ""}`,
  };
}
