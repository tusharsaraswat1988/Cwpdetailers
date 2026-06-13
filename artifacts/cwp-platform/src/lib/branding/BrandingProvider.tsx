import { ReactNode, useEffect } from "react";
import { useBranding } from "./useBranding";
import { applyBrandingToSplash, detectPwaPortal } from "@/lib/pwa/splash";
import { syncPwaHeadTags } from "@/lib/pwa/pwaHead";

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}='${key}']`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string, attrs?: Record<string, string>) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
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

type BrandingProviderProps = {
  children: ReactNode;
  /** Optional portal for dynamic PWA manifest */
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
    document.title = branding.metaTitle;

    upsertMeta("name", "description", branding.metaDescription);
    upsertMeta("name", "theme-color", branding.primaryColor);

    upsertMeta("property", "og:title", branding.ogTitle ?? branding.metaTitle);
    upsertMeta("property", "og:description", branding.ogDescription ?? branding.metaDescription);
    upsertMeta("property", "og:site_name", branding.companyName);
    if (branding.ogImage) upsertMeta("property", "og:image", branding.ogImage);

    upsertMeta("name", "twitter:card", branding.twitterCardType ?? "summary_large_image");
    upsertMeta("name", "twitter:title", branding.twitterTitle ?? branding.metaTitle);
    upsertMeta("name", "twitter:description", branding.twitterDescription ?? branding.metaDescription);
    if (branding.ogImage) upsertMeta("name", "twitter:image", branding.generatedAssets.twitterCard ?? branding.ogImage);

    const favicon = branding.favicon ?? branding.generatedAssets.favicon32;
    if (favicon) {
      upsertLink("icon", favicon, { type: "image/png" });
    }

    const resolvedPortal = portal ?? detectPwaPortal(window.location.pathname);
    syncPwaHeadTags(branding, resolvedPortal);
    applyBrandingToSplash(branding);

    const existing = document.getElementById("brand-schema-org");
    if (existing) existing.remove();
    if (branding.schemaOrg && Object.keys(branding.schemaOrg).length > 0) {
      const script = document.createElement("script");
      script.id = "brand-schema-org";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify({
        "@context": "https://schema.org",
        ...branding.schemaOrg,
      });
      document.head.appendChild(script);
    }
  }, [branding, portal]);

  return <>{children}</>;
}
