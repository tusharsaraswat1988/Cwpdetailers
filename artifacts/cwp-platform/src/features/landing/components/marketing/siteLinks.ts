import type { MarketingNavLink } from "../MarketingNav";

/** Cross-page nav for public marketing site (not landing hash anchors). */
export const MARKETING_SITE_LINKS: MarketingNavLink[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "/about-us" },
  { id: "contact", label: "Contact", href: "/contact-us" },
  { id: "plans", label: "Plans", href: "/#packages" },
  { id: "privacy", label: "Privacy", href: "/privacy-policy" },
];

export const MARKETING_LEGAL_LINKS: MarketingNavLink[] = [
  { id: "about-us", label: "About Us", href: "/about-us" },
  { id: "contact-us", label: "Contact Us", href: "/contact-us" },
  { id: "privacy-policy", label: "Privacy Policy", href: "/privacy-policy" },
  { id: "terms-and-conditions", label: "Terms & Conditions", href: "/terms-and-conditions" },
  { id: "refund-policy", label: "Refund Policy", href: "/refund-policy" },
  { id: "data-deletion", label: "Data Deletion", href: "/data-deletion" },
];
