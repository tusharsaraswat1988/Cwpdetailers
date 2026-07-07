import type { PublicBranding } from "@/lib/branding/types";

export type PwaPortal = "main" | "admin" | "customer" | "staff" | "franchisee";

export const SPLASH_ELEMENT_ID = "cwp-app-splash";
export const SPLASH_LOGO_ID = "cwp-splash-logo";

/** Resolve logo for boot / splash screens */
export function resolveSplashLogoUrl(branding: PublicBranding): string | null {
  return (
    branding.splashLogo ??
    branding.loginLogo ??
    branding.fullLogo ??
    branding.pwaIcon ??
    branding.generatedAssets.pwaIcon512 ??
    branding.generatedAssets.androidChrome512 ??
    null
  );
}

export function detectPwaPortal(pathname: string): PwaPortal {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/staff")) return "staff";
  if (pathname.startsWith("/franchisee")) return "franchisee";
  return "main";
}

export function applyBrandingToSplash(branding: PublicBranding): void {
  const splash = document.getElementById(SPLASH_ELEMENT_ID);
  if (!splash) return;

  splash.style.backgroundColor = branding.loaderBackground ?? branding.backgroundColor;

  const logo = resolveSplashLogoUrl(branding);
  const img = document.getElementById(SPLASH_LOGO_ID) as HTMLImageElement | null;
  if (img && logo) {
    img.src = logo;
    img.alt = branding.brandName;
  }

  const accent = splash.querySelector<HTMLElement>(".cwp-splash-accent");
  if (accent) accent.style.backgroundColor = branding.primaryColor;
}

export function hideAppSplash(): void {
  const el = document.getElementById(SPLASH_ELEMENT_ID);
  if (!el || el.classList.contains("cwp-app-splash--hide")) return;

  el.classList.add("cwp-app-splash--hide");
  document.documentElement.classList.remove("cwp-splash-active");

  const remove = () => {
    el.remove();
  };

  el.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 350);
}
