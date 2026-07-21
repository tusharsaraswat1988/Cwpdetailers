import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useBranding } from "@/lib/branding";
import { CUSTOMER_THEME_CSS_VARS } from "./tokens";
import "./styles/customer.css";

type CustomerThemeRootProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Applies CWP Platform brand palette to the customer session (including
 * portaled dialogs/sheets) without changing global CMS defaults for admin/staff.
 */
export function CustomerThemeRoot({ children, className }: CustomerThemeRootProps) {
  const branding = useBranding();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("customer-theme");
    const previous = new Map<string, string>();

    for (const [key, value] of Object.entries(CUSTOMER_THEME_CSS_VARS)) {
      previous.set(key, root.style.getPropertyValue(key));
      root.style.setProperty(key, value);
    }

    return () => {
      root.classList.remove("customer-theme");
      for (const [key, prev] of previous) {
        if (prev) root.style.setProperty(key, prev);
        else root.style.removeProperty(key);
      }
      for (const [key, value] of Object.entries(branding.cssVariables)) {
        root.style.setProperty(key, value);
      }
    };
  }, [branding.cssVariables, branding.version]);

  return (
    <div className={cn("customer-root h-full min-h-0", className)} data-customer-ds="cwp">
      {children}
    </div>
  );
}
