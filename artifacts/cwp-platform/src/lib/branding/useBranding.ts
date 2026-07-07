import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPublicBranding } from "./api";
import { getBrandAsset, type BrandAssetKey } from "./brandAssets";
import { BRANDING_QUERY_KEY, DEFAULT_BRANDING, type PublicBranding } from "./types";

export function useBranding(): PublicBranding & {
  isLoading: boolean;
  isFetched: boolean;
  refetch: () => void;
  getAsset: (key: BrandAssetKey) => string | null;
} {
  const qc = useQueryClient();
  const { data, isLoading, isFetched } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: fetchPublicBranding,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: DEFAULT_BRANDING,
  });

  const branding = data ?? DEFAULT_BRANDING;

  return {
    ...branding,
    isLoading,
    isFetched,
    refetch: () => {
      void qc.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
    },
    getAsset: (key: BrandAssetKey) => getBrandAsset(branding, key),
  };
}

export type BrandLogoVariant =
  | "full"
  | "navbar"
  | "mobile"
  | "login"
  | "light"
  | "dark"
  | "white"
  | "transparent"
  | "square"
  | "icon"
  | "email"
  | "invoice"
  | "pdf"
  | "favicon"
  | "pwa"
  | "splash";

export function resolveLogoUrl(branding: PublicBranding, variant: BrandLogoVariant): string | null {
  const map: Record<BrandLogoVariant, string | null | undefined> = {
    full: branding.fullLogo,
    navbar: branding.navbarLogo,
    mobile: branding.mobileLogo,
    login: branding.loginLogo,
    light: branding.lightLogo,
    dark: branding.darkLogo,
    white: branding.logoWhite,
    transparent: branding.logoTransparent,
    square: branding.logoSquare,
    icon: branding.logoIcon,
    email: branding.emailLogo,
    invoice: branding.invoiceLogo,
    pdf: branding.pdfLogo,
    favicon: branding.favicon ?? branding.generatedAssets.favicon32,
    pwa: branding.pwaIcon ?? branding.generatedAssets.pwaIcon512,
    splash: branding.splashLogo,
  };
  return map[variant] ?? branding.fullLogo;
}
