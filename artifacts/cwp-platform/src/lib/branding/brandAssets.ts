import type { PublicBranding } from "./types";

/** Semantic asset keys — request assets by key, not file path */
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

/** Resolve a brand asset URL by semantic key */
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
