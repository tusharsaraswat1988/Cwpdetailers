import { useEffect } from "react";
import { useBranding } from "./useBranding";
import { brandingManifestUrl } from "./api";

export function useBrandingPortal(portal: "admin" | "customer" | "staff" | "franchisee") {
  const branding = useBranding();

  useEffect(() => {
    let manifestLink = document.querySelector<HTMLLinkElement>("link[rel='manifest']");
    if (!manifestLink) {
      manifestLink = document.createElement("link");
      manifestLink.rel = "manifest";
      document.head.appendChild(manifestLink);
    }
    manifestLink.href = brandingManifestUrl(portal);

    let themeMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color']");
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = branding.primaryColor;
  }, [portal, branding.primaryColor, branding.version]);

  return branding;
}
