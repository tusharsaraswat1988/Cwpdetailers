import { Link } from "wouter";
import { BrandLogo } from "@/components/shared/BrandLogo";
import { useBranding } from "@/lib/branding";
import { LANDING_LAYOUT } from "../../constants";

const LEGAL = [
  { href: "/about-us", label: "About Us" },
  { href: "/contact-us", label: "Contact Us" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-and-conditions", label: "Terms & Conditions" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/data-deletion", label: "Data Deletion" },
] as const;

/** Shared marketing footer — BrandLogo + real legal routes. */
export function MarketingFooter() {
  const branding = useBranding();

  return (
    <footer className="bg-foreground text-white/70" data-testid="marketing-footer">
      <div className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-16`}>
        <div className="grid gap-10 border-t border-white/10 pt-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="full" lazy />
              <div className="text-white">
                <div className="text-sm font-semibold">{branding.brandName}</div>
                <div className="text-[11px] text-white/60">
                  {branding.tagline ?? branding.companyName}
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm">
              Doorstep vehicle care and professional solar care — built in Varanasi, engineered for
              trust, connected to your CWP app.
            </p>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white">Explore</div>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#packages" className="transition hover:text-white">
                  Packages
                </a>
              </li>
              <li>
                <a href="#book" className="transition hover:text-white">
                  Book service
                </a>
              </li>
              <li>
                <Link href="/register" className="transition hover:text-white">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/login" className="transition hover:text-white">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white">Legal</div>
            <ul className="mt-4 space-y-2 text-sm">
              {LEGAL.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50">
          <div>
            © {new Date().getFullYear()} {branding.brandName}. Varanasi, India.
          </div>
          <div>GST verified · Connected platform · Photo reports</div>
        </div>
      </div>
    </footer>
  );
}
