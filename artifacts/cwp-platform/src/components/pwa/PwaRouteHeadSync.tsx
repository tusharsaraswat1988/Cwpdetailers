import { useEffect } from "react";
import { useLocation } from "wouter";
import { useBranding } from "@/lib/branding";
import { detectPwaPortal } from "@/lib/pwa/splash";
import { syncPwaHeadTags } from "@/lib/pwa/pwaHead";

/** Keeps dynamic PWA manifest + iOS splash meta aligned with the active route. */
export function PwaRouteHeadSync() {
  const [pathname] = useLocation();
  const branding = useBranding();

  useEffect(() => {
    syncPwaHeadTags(branding, detectPwaPortal(pathname));
  }, [pathname, branding.version, branding.primaryColor, branding.backgroundColor]);

  return null;
}
