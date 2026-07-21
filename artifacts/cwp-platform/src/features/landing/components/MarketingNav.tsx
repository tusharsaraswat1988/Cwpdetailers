import { Link } from "wouter";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import { trackLandingEvent } from "../analytics";
import { LANDING_LAYOUT, LANDING_Z } from "../constants";

export type MarketingNavLink = {
  id: string;
  label: string;
  href: string;
};

export type MarketingNavProps = {
  links?: MarketingNavLink[];
  className?: string;
};

const DEFAULT_LINKS: MarketingNavLink[] = [
  { id: "services", label: "How it works", href: "#services" },
  { id: "packages", label: "Plans", href: "#packages" },
  { id: "results", label: "Results", href: "#work" },
  { id: "faq", label: "FAQs", href: "#faq" },
  { id: "book", label: "Book", href: "#book" },
];

/**
 * Public marketing chrome. Uses BrandLogo + BrandingProvider — no Lovable LogoMark.
 */
export function MarketingNav({
  links = DEFAULT_LINKS,
  className,
}: MarketingNavProps) {
  const branding = useBranding();
  const phone = branding.supportPhone?.replace(/\s/g, "") || "8707488250";
  const phoneDisplay = branding.supportPhone || "87074 88250";

  return (
    <header
      className={cn(
        "sticky top-0 border-b border-border/70 bg-white/80 backdrop-blur-xl",
        className,
      )}
      style={{ zIndex: LANDING_Z.nav }}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between",
          LANDING_LAYOUT.maxWidth,
          LANDING_LAYOUT.padX,
          LANDING_LAYOUT.navHeight,
        )}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo variant="navbar" lazy={false} />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">
              {branding.brandName}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {branding.tagline ?? branding.companyName}
            </div>
          </div>
        </Link>

        <nav
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
          aria-label="Marketing"
        >
          {links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className="transition hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={`tel:${phone}`}
            className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition hover:border-foreground/30 sm:inline-flex"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {phoneDisplay}
          </a>
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground sm:inline-flex"
              onClick={() =>
                trackLandingEvent("nav_cta_clicked", {
                  ctaId: "nav-login",
                  href: "/login",
                })
              }
            >
              Sign in
            </Button>
          </Link>
          <Link href="/register">
            <Button
              size="sm"
              className="rounded-full bg-foreground text-background hover:bg-foreground/90"
              onClick={() =>
                trackLandingEvent("nav_cta_clicked", {
                  ctaId: "nav-register",
                  href: "/register",
                })
              }
              data-testid="nav-book-cta"
            >
              Book service
              <ArrowRight className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
