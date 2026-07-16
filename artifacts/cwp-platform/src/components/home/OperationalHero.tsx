import { StatusBadge } from "@/components/shared/StatusBadge";
import type { HomeOperationalHero } from "@/lib/home-dashboard";
import { cn } from "@/lib/utils";

interface OperationalHeroProps {
  hero: HomeOperationalHero;
  className?: string;
}

export function OperationalHero({ hero, className }: OperationalHeroProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card px-3.5 py-3 min-h-[4.5rem]",
        className,
      )}
      data-testid="home-operational-hero"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          {hero.eyebrow}
        </p>
        {hero.kind !== "clear" && hero.status !== "clear" && (
          <StatusBadge status={hero.status} pulse={hero.pulse} className="shrink-0 scale-90 origin-right" />
        )}
      </div>
      <p className="font-display font-bold text-base leading-snug mt-1 capitalize">{hero.title}</p>
      {hero.subtitle && (
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{hero.subtitle}</p>
      )}
    </div>
  );
}

export default OperationalHero;
