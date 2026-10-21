import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Menu, Phone } from "lucide-react";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { trackLandingEvent } from "../analytics";
import { LANDING_LAYOUT, LANDING_Z } from "../constants";
import { MarketingButton } from "./marketing/MarketingButton";

export type MarketingNavLink = {
  id: string;
  label: string;
  href: string;
};

export type MarketingNavProps = {
  links?: MarketingNavLink[];
  className?: string;
  /** Highlight matching href (e.g. current legal page) */
  activeHref?: string;
  /** Logo target — defaults to vehicle landing */
  homeHref?: string;
};

const DEFAULT_LINKS: MarketingNavLink[] = [
  { id: "services", label: "How it works", href: "#services" },
  { id: "packages", label: "Plans", href: "#packages" },
  { id: "results", label: "Results", href: "#work" },
  { id: "faq", label: "FAQs", href: "#faq" },
];

function scrollToTarget(href: string) {
  if (href.startsWith("#")) {
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      try {
        history.pushState(null, "", href);
      } catch {
        /* noop */
      }
      return true;
    }
  }
  return false;
}

function NavAnchor({
  link,
  active,
}: {
  link: MarketingNavLink;
  active: boolean;
}) {
  const className = cn(
    "cursor-pointer transition hover:text-foreground",
    active && "font-semibold text-[color:var(--landing-accent)]",
  );

  if (link.href.startsWith("#")) {
    return (
      <a
        href={link.href}
        className={className}
        onClick={(e) => {
          if (scrollToTarget(link.href)) {
            e.preventDefault();
          }
        }}
      >
        {link.label}
      </a>
    );
  }

  return (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

/**
 * Public marketing chrome with responsive layout and mobile drawer.
 * Uses BrandLogo + BrandingProvider.
 */
export function MarketingNav({
  links = DEFAULT_LINKS,
  className,
  activeHref,
  homeHref = "/vehicle",
}: MarketingNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const branding = useBranding();
  const phone = branding.supportPhone?.replace(/\s/g, "") || "8707488250";
  const phoneDisplay = branding.supportPhone || "87074 88250";

  const handleMobileNavClick = (href: string) => {
    setMobileOpen(false);
    if (href.startsWith("#")) {
      setTimeout(() => {
        scrollToTarget(href);
      }, 100);
    }
  };

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
          "mx-auto flex items-center justify-between gap-2 px-3 sm:px-5 md:px-8",
          LANDING_LAYOUT.maxWidth,
          LANDING_LAYOUT.navHeight,
        )}
      >
        {/* Brand identity: icon + name (tagline hidden on small screens to guarantee fit) */}
        <Link href={homeHref} className="flex min-w-0 shrink items-center gap-2">
          <BrandLogo variant="navbar" lazy={false} className="shrink-0" />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold tracking-tight sm:text-[15px]">
              {branding.brandName}
            </div>
            <div className="hidden truncate text-[11px] text-muted-foreground sm:block">
              {branding.tagline ?? branding.companyName}
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
          aria-label="Marketing"
        >
          {links.map((link) => (
            <NavAnchor
              key={link.id}
              link={link}
              active={!!activeHref && link.href === activeHref}
            />
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <a
            href={`tel:${phone}`}
            className="hidden cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition hover:border-foreground/30 md:inline-flex lg:text-sm lg:px-4 lg:py-2"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {phoneDisplay}
          </a>
          <MarketingButton
            href="/login"
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
            onClick={() =>
              trackLandingEvent("nav_cta_clicked", {
                ctaId: "nav-login",
                href: "/login",
              })
            }
          >
            Sign in
          </MarketingButton>
          <MarketingButton
            href="/register"
            variant="primary"
            size="sm"
            data-testid="nav-book-cta"
            className="h-8 px-2.5 text-xs sm:h-9 sm:px-3 sm:text-sm"
            onClick={() =>
              trackLandingEvent("nav_cta_clicked", {
                ctaId: "nav-register",
                href: "/register",
              })
            }
          >
            <span>Book</span>
            <span className="hidden sm:inline">&nbsp;service</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </MarketingButton>

          {/* Mobile Drawer Trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition hover:bg-muted md:hidden"
                aria-label="Toggle navigation menu"
                data-testid="mobile-nav-toggle"
              >
                <Menu className="h-4 w-4" aria-hidden />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-[85vw] max-w-sm flex-col p-6">
              <SheetHeader className="text-left border-b border-border pb-4">
                <div className="flex items-center gap-2.5">
                  <BrandLogo variant="navbar" lazy={false} />
                  <div className="leading-tight">
                    <SheetTitle className="text-base font-semibold tracking-tight">
                      {branding.brandName}
                    </SheetTitle>
                    <div className="text-[11px] text-muted-foreground">
                      {branding.tagline ?? branding.companyName}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="flex flex-1 flex-col justify-between py-6">
                <nav className="flex flex-col space-y-3" aria-label="Mobile navigation links">
                  {links.map((link) => (
                    <a
                      key={link.id}
                      href={link.href}
                      onClick={(e) => {
                        if (link.href.startsWith("#")) {
                          e.preventDefault();
                          handleMobileNavClick(link.href);
                        } else {
                          setMobileOpen(false);
                        }
                      }}
                      className={cn(
                        "flex items-center justify-between rounded-xl px-3 py-2 text-base font-medium transition hover:bg-muted",
                        activeHref === link.href
                          ? "font-semibold text-[color:var(--landing-accent)] bg-[color:var(--landing-surface-tint)]"
                          : "text-foreground/90",
                      )}
                    >
                      <span>{link.label}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground/60" />
                    </a>
                  ))}
                </nav>

                <div className="flex flex-col gap-2.5 pt-6 border-t border-border">
                  <a
                    href={`tel:${phone}`}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium transition hover:border-foreground/30"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Phone className="h-4 w-4 text-[color:var(--landing-accent)]" />
                    <span>{phoneDisplay}</span>
                  </a>

                  <Link
                    href="/login"
                    onClick={() => {
                      setMobileOpen(false);
                      trackLandingEvent("nav_cta_clicked", {
                        ctaId: "nav-login-mobile",
                        href: "/login",
                      });
                    }}
                    className="inline-flex w-full items-center justify-center rounded-full border border-border bg-muted/40 px-4 py-2.5 text-sm font-medium transition hover:bg-muted"
                  >
                    Sign in
                  </Link>

                  <Link
                    href="/register"
                    onClick={() => {
                      setMobileOpen(false);
                      trackLandingEvent("nav_cta_clicked", {
                        ctaId: "nav-register-mobile",
                        href: "/register",
                      });
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--landing-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-95"
                  >
                    <span>Book service</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
