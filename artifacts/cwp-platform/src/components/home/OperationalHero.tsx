import { StatusBadge } from "@/components/shared/StatusBadge";
import type { HomeOperationalHero } from "@/lib/home-dashboard";
import { cn } from "@/lib/utils";

interface OperationalHeroProps {
  hero: HomeOperationalHero;
  className?: string;
}

/** Home operational hero — uses Customer DS hero surface tokens via CSS. */
export function OperationalHero({ hero, className }: OperationalHeroProps) {
  return (
    <div
      className={cn("customer-hero px-4 py-4 min-h-[5rem]", className)}
      data-testid="home-operational-hero"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
          {hero.eyebrow}
        </p>
        {hero.kind !== "clear" && hero.status !== "clear" && (
          <StatusBadge status={hero.status} pulse={hero.pulse} className="shrink-0" />
        )}
      </div>
      <p className="font-display font-bold text-lg leading-snug mt-1.5 capitalize">{hero.title}</p>
      {hero.subtitle && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{hero.subtitle}</p>
      )}
    </div>
  );
}

export default OperationalHero;
