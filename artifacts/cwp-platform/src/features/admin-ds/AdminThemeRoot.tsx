import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";
import { ADMIN_THEME_CSS_VARS } from "./tokens";
import "./styles/admin.css";

type AdminThemeRootProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Applies CWP Landing brand palette to the admin session (including portaled
 * dialogs/sheets) without changing global CMS defaults for other portals.
 */
export function AdminThemeRoot({ children, className }: AdminThemeRootProps) {
  const branding = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("admin-theme");
    const previous = new Map<string, string>();

    for (const [key, value] of Object.entries(ADMIN_THEME_CSS_VARS)) {
      previous.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, value);
    }

    return () => {
      root.classList.remove("admin-theme");
      for (const [key, prev] of previous) {
        if (prev) root.style.setProperty(key, prev);
        else root.style.removeProperty(key);
      }
      // Restore CMS branding for customer/staff after leaving admin
      for (const [key, value] of Object.entries(branding.cssVariables)) {
        root.style.setProperty(key, value);
      }
    };
  }, [branding.cssVariables, branding.version]);

  return (
    <div className={cn("admin-root h-full min-h-0", className)} data-admin-ds="cwp">
      {children}
    </div>
  );
}
