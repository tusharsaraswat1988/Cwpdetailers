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
  tone?: "light" | "dark";
};

export function AuthFooter({
  links = DEFAULT_LINKS,
  children,
  className,
  tone = "light",
}: AuthFooterProps) {
  const light = tone === "light";

  return (
    <div className={cn("mt-6 pt-4", light ? "border-t border-border/70" : "border-t border-white/[0.08]", className)}>
      {children}
      <nav
        className="flex flex-wrap justify-center gap-x-5 gap-y-1"
        aria-label="Legal and support links"
      >
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "text-[11px] transition-colors duration-200",
              light
                ? "text-muted-foreground hover:text-foreground"
                : "text-white/35 hover:text-white/60",
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
