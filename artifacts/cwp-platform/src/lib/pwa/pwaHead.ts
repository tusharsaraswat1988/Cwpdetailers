import { brandingManifestUrl } from "@/lib/branding/api";
import type { PublicBranding } from "@/lib/branding/types";
import type { PwaPortal } from "./splash";

const IOS_STARTUP_SPECS: { assetKey: keyof PublicBranding["generatedAssets"]; media: string }[] = [
  {
    assetKey: "iosSplash2048x2732",
    media:
      "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    assetKey: "iosSplash1284x2778",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    assetKey: "iosSplash1170x2532",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    assetKey: "iosSplash750x1334",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
];

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
  const selector = attrs?.media
    ? `link[rel='${rel}'][media='${attrs.media}']`
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

function syncIosStartupImages(branding: PublicBranding) {
  document.querySelectorAll("link[rel='apple-touch-startup-image']").forEach(node => node.remove());

  for (const { assetKey, media } of IOS_STARTUP_SPECS) {
    const href = branding.generatedAssets[assetKey];
    if (!href) continue;
    const link = document.createElement("link");
    link.rel = "apple-touch-startup-image";
    link.href = href;
    link.media = media;
    document.head.appendChild(link);
  }
}

function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 1;
  const channels = [m[1], m[2], m[3]].map(v => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Sync manifest link, theme colors, and iOS PWA splash meta from brand identity. */
export function syncPwaHeadTags(branding: PublicBranding, portal: PwaPortal) {
  upsertLink("manifest", brandingManifestUrl(portal));
  upsertMeta("name", "theme-color", branding.primaryColor);
  upsertMeta("name", "mobile-web-app-capable", "yes");
  upsertMeta("name", "apple-mobile-web-app-capable", "yes");
  upsertMeta("name", "apple-mobile-web-app-title", branding.brandName);

  const statusBarStyle = luminance(branding.backgroundColor) < 0.4 ? "black-translucent" : "default";
  upsertMeta("name", "apple-mobile-web-app-status-bar-style", statusBarStyle);

  const apple = branding.appleTouchIcon ?? branding.generatedAssets.appleTouchIcon;
  if (apple) {
    upsertLink("apple-touch-icon", apple);
  }

  syncIosStartupImages(branding);
}
