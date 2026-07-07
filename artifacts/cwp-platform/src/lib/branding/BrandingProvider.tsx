import { ReactNode, useEffect } from "react";
import { useBranding } from "./useBranding";
import { getBrandAsset } from "./brandAssets";
import { applyBrandingToSplash, detectPwaPortal } from "@/lib/pwa/splash";
import { syncPwaHeadTags } from "@/lib/pwa/pwaHead";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  if (!content) return;
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}='${key}']`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, attrs?: Record<string, string>) {
  if (!href) return;
  const selector = attrs?.sizes
    ? `link[rel='${rel}'][sizes='${attrs.sizes}']`
    : attrs?.type
      ? `link[rel='${rel}'][type='${attrs.type}']`
      : `link[rel='${rel}']`;
  let el = document.querySelector<HTMLLinkElement>(selector);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  }
}

function syncFavicons(branding: ReturnType<typeof useBranding>) {
  const favicon32 = getBrandAsset(branding, "favicon_32") ?? branding.favicon;
  const favicon16 = getBrandAsset(branding, "favicon_16");
  const favicon48 = getBrandAsset(branding, "favicon_48");
  const faviconIco = getBrandAsset(branding, "favicon_ico");
  const appleTouch = getBrandAsset(branding, "apple_touch");
  const android192 = getBrandAsset(branding, "android_192");
  const android512 = getBrandAsset(branding, "android_512");
  const maskable = getBrandAsset(branding, "maskable_icon");

  if (faviconIco) upsertLink("icon", faviconIco, { type: "image/x-icon" });
  if (favicon32) upsertLink("icon", favicon32, { type: "image/png", sizes: "32x32" });
  if (favicon16) upsertLink("icon", favicon16, { type: "image/png", sizes: "16x16" });
  if (favicon48) upsertLink("icon", favicon48, { type: "image/png", sizes: "48x48" });
  if (appleTouch) upsertLink("apple-touch-icon", appleTouch);
  if (android192) upsertLink("icon", android192, { type: "image/png", sizes: "192x192" });
  if (android512) upsertLink("icon", android512, { type: "image/png", sizes: "512x512" });
  if (maskable) upsertLink("icon", maskable, { type: "image/png", sizes: "512x512", purpose: "maskable" });
}

function syncStructuredData(branding: ReturnType<typeof useBranding>) {
  document.querySelectorAll("[data-brand-schema]").forEach(node => node.remove());

  const schemas = [
    { id: "brand-schema-org", data: branding.schemaOrg },
    { id: "brand-schema-local", data: branding.localBusinessSchema },
  ];

  for (const { id, data } of schemas) {
    if (!data || Object.keys(data).length === 0) continue;
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.setAttribute("data-brand-schema", "true");
    script.textContent = JSON.stringify({
      "@context": "https://schema.org",
      ...data,
    });
    document.head.appendChild(script);
  }
}

type BrandingProviderProps = {
  children: ReactNode;
  portal?: "admin" | "customer" | "staff" | "franchisee";
};

export function BrandingProvider({ children, portal }: BrandingProviderProps) {
  const branding = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    for (const [key, value] of Object.entries(branding.cssVariables)) {
      root.style.setProperty(key, value);
    }
  }, [branding.cssVariables, branding.version]);

  useEffect(() => {
    if (branding.brandName) {
      document.title = branding.metaTitle;
    }

    upsertMeta("name", "description", branding.metaDescription);
    upsertMeta("name", "theme-color", branding.primaryColor);
    if (branding.seoKeywords) upsertMeta("name", "keywords", branding.seoKeywords);
    if (branding.seoAuthor) upsertMeta("name", "author", branding.seoAuthor);

    upsertMeta("property", "og:title", branding.ogTitle ?? branding.metaTitle);
    upsertMeta("property", "og:description", branding.ogDescription ?? branding.metaDescription);
    upsertMeta("property", "og:site_name", branding.companyName || branding.brandName);
    if (branding.website) upsertMeta("property", "og:url", branding.website);
    const ogImg = branding.ogImage ?? getBrandAsset(branding, "seo_image");
    if (ogImg) upsertMeta("property", "og:image", ogImg);

    upsertMeta("name", "twitter:card", branding.twitterCardType ?? "summary_large_image");
    upsertMeta("name", "twitter:title", branding.twitterTitle ?? branding.metaTitle);
    upsertMeta("name", "twitter:description", branding.twitterDescription ?? branding.metaDescription);
    const twitterImg = branding.twitterImage ?? branding.generatedAssets.twitterCard ?? ogImg;
    if (twitterImg) upsertMeta("name", "twitter:image", twitterImg);

    if (branding.website) upsertLink("canonical", branding.website);

    syncFavicons(branding);

    const resolvedPortal = portal ?? detectPwaPortal(window.location.pathname);
    syncPwaHeadTags(branding, resolvedPortal);
    applyBrandingToSplash(branding);
    syncStructuredData(branding);
  }, [branding, portal]);

  return <>{children}</>;
}
