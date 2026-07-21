import type { ReactNode } from "react";
import { LandingShell } from "../LandingShell";
import { MarketingNav, type MarketingNavLink } from "../MarketingNav";
import { MarketingFooter } from "../../experiences/shared/MarketingFooter";
import { MARKETING_SITE_LINKS } from "./siteLinks";

export type MarketingPageShellProps = {
  children: ReactNode;
  /** Defaults to cross-page site links (not landing hash anchors). */
  navLinks?: MarketingNavLink[];
  activeHref?: string;
  showFooter?: boolean;
  className?: string;
};

/**
 * Standard public marketing page chrome.
 * Scoped landing tokens only — never touches global app theme.
 */
export function MarketingPageShell({
  children,
  navLinks = MARKETING_SITE_LINKS,
  activeHref,
  showFooter = true,
  className,
}: MarketingPageShellProps) {
  return (
    <LandingShell className={className}>
      <MarketingNav links={navLinks} activeHref={activeHref} />
      {children}
      {showFooter ? <MarketingFooter /> : null}
    </LandingShell>
  );
}
