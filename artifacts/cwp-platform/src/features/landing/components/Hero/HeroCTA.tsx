import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackLandingEvent } from "../../analytics";
import type { HeroCta } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";

export type HeroCTAProps = {
  ctas: HeroCta[];
  enterReady: boolean;
  className?: string;
};

function isAppRoute(href: string) {
  return href.startsWith("/") && !href.startsWith("//");
}

export function HeroCTA({ ctas, enterReady, className }: HeroCTAProps) {
  const enter = heroEnter("cta", enterReady);
  if (!ctas.length) return null;

  return (
    <div
      style={enter.style}
      className={cn(enter.className, "mt-8 flex flex-wrap gap-3", className)}
      data-testid="hero-cta-group"
    >
      {ctas.map((cta) => {
        const variant =
          cta.variant === "secondary"
            ? "outline"
            : cta.variant === "ghost"
              ? "ghost"
              : "default";

        const onClick = () => {
          trackLandingEvent("hero_cta_clicked", {
            ctaId: cta.id,
            href: cta.href,
          });
        };

        const inner = (
          <Button
            size="lg"
            variant={variant}
            className={cn(
              cta.variant !== "secondary" &&
                cta.variant !== "ghost" &&
                "bg-foreground text-background hover:bg-foreground/90",
            )}
            onClick={onClick}
            data-testid={`hero-cta-${cta.id}`}
          >
            {cta.label}
            {cta.variant !== "secondary" && cta.variant !== "ghost" ? (
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            ) : null}
          </Button>
        );

        if (cta.external || cta.href.startsWith("http") || cta.href.startsWith("tel:")) {
          return (
            <a key={cta.id} href={cta.href} target={cta.external ? "_blank" : undefined} rel={cta.external ? "noreferrer" : undefined}>
              {inner}
            </a>
          );
        }

        if (isAppRoute(cta.href)) {
          return (
            <Link key={cta.id} href={cta.href}>
              {inner}
            </Link>
          );
        }

        return (
          <a key={cta.id} href={cta.href}>
            {inner}
          </a>
        );
      })}
    </div>
  );
}
