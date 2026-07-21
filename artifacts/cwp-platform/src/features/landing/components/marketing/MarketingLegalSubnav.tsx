import { Link } from "wouter";
import { MARKETING_LEGAL_LINKS } from "./siteLinks";

export type MarketingLegalSubnavProps = {
  activeHref: string;
};

/** Shared legal/about/contact secondary nav — landing tokens only. */
export function MarketingLegalSubnav({ activeHref }: MarketingLegalSubnavProps) {
  return (
    <div className="border-b border-border bg-[color:var(--landing-surface-tint)]/50">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 py-2 md:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {MARKETING_LEGAL_LINKS.map((link) => {
          const active = link.href === activeHref;
          return (
            <Link
              key={link.id}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-[color:var(--landing-accent)] text-white"
                  : "text-muted-foreground hover:bg-white hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
