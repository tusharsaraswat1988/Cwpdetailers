import { useEffect } from "react";
import { useBranding } from "./useBranding";

export type PageSeoOptions = {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
};

function upsertMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}='${key}']`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel='${rel}']`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Per-page SEO — appends | Brand Name to custom titles automatically */
export function usePageSeo(options: PageSeoOptions = {}) {
  const branding = useBranding();

  useEffect(() => {
    const brandName = branding.brandName;
    const pageTitle = options.title
      ? options.title.includes(brandName)
        ? options.title
        : `${options.title} | ${brandName}`
      : branding.metaTitle;

    const description = options.description ?? branding.metaDescription;
    const ogImage = options.ogImage ?? branding.ogImage ?? branding.twitterImage;
    const canonical = options.canonical ?? branding.website ?? window.location.href;

    document.title = pageTitle;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", description);

    if (ogImage) {
      upsertMeta("property", "og:image", ogImage);
      upsertMeta("name", "twitter:image", ogImage);
    }

    if (options.canonical || branding.website) {
      upsertLink("canonical", canonical);
    }

    if (branding.seoKeywords) {
      upsertMeta("name", "keywords", branding.seoKeywords);
    }
    if (branding.seoAuthor) {
      upsertMeta("name", "author", branding.seoAuthor);
    }

    if (options.noIndex) {
      upsertMeta("name", "robots", "noindex, nofollow");
    }
  }, [branding, options.title, options.description, options.canonical, options.ogImage, options.noIndex]);
}
