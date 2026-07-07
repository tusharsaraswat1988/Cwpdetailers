import { Link } from "wouter";
import { cn } from "@/lib/utils";

const DEFAULT_LINKS = [
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-and-conditions", label: "Terms" },
  { href: "/contact-us", label: "Contact" },
] as const;

type AuthFooterProps = {
  links?: readonly { href: string; label: string }[];
  children?: React.ReactNode;
  className?: string;
};

export function AuthFooter({ links = DEFAULT_LINKS, children, className }: AuthFooterProps) {
  return (
    <div className={cn("mt-4 pt-3 border-t border-white/[0.04]", className)}>
      {children}
      <nav
        className="flex flex-wrap justify-center gap-x-5 gap-y-1"
        aria-label="Legal and support links"
      >
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="text-white/20 hover:text-white/38 text-[11px] transition-colors duration-200"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
