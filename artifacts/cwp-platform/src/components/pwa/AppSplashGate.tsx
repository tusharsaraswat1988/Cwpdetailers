import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useBranding } from "@/lib/branding";
import { applyBrandingToSplash, hideAppSplash } from "@/lib/pwa/splash";

/**
 * Hides the inline boot splash once auth + brand identity have initialized.
 * Also keeps splash visuals in sync when branding loads from the API.
 */
export function AppSplashGate() {
  const { isLoading: authLoading } = useAuth();
  const branding = useBranding();

  useEffect(() => {
    applyBrandingToSplash(branding);
  }, [branding.version]);

  useEffect(() => {
    if (!authLoading && branding.isFetched) {
      hideAppSplash();
    }
  }, [authLoading, branding.isFetched]);

  return null;
}
