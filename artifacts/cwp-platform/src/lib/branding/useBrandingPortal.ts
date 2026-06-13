import { useEffect } from "react";
import { useBranding } from "./useBranding";
import { detectPwaPortal } from "@/lib/pwa/splash";
import { syncPwaHeadTags } from "@/lib/pwa/pwaHead";

export function useBrandingPortal(portal: "admin" | "customer" | "staff" | "franchisee") {
  const branding = useBranding();

  useEffect(() => {
    syncPwaHeadTags(branding, portal);
  }, [portal, branding.version, branding.primaryColor, branding.backgroundColor]);

  return branding;
}

/** Sets dynamic PWA manifest + iOS splash meta for the current route (main site or portal). */
export function usePwaBrandingHead() {
  const branding = useBranding();

  useEffect(() => {
    const portal = detectPwaPortal(window.location.pathname);
    syncPwaHeadTags(branding, portal);
  }, [branding.primaryColor, branding.backgroundColor, branding.version, branding.appleTouchIcon, branding.generatedAssets]);

  return branding;
}
