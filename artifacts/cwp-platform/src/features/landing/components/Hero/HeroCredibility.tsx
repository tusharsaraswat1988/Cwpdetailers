import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOCIAL_AVATAR_COLORS } from "../../constants";
import type { HeroCredibilityItem, HeroSocialProof } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";

export type HeroCredibilityProps = {
  items?: HeroCredibilityItem[];
  socialProof?: HeroSocialProof;
  enterReady: boolean;
  className?: string;
};

/**
 * Immediate proof strip under the hero composition.
 * Uses only content already supplied by the hero bundle — no invented metrics.
 */
export function HeroCredibility({
  items = [],
  socialProof,
  enterReady,
  className,
}: HeroCredibilityProps) {
  const enter = heroEnter("credibility", enterReady);
  if (!items.length && !socialProof) return null;

  return (
    <div
      style={enter.style}
      className={cn(
        enter.className,
        "flex flex-col gap-3 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pt-6",
        className,
      )}
      data-testid="hero-credibility"
      aria-label="Trust and credibility"
    >
      {socialProof ? (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden>
            {socialProof.avatarInitials.map((initial, i) => (
              <div
                key={`${initial}-${i}`}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white shadow-sm"
                style={{
                  background: SOCIAL_AVATAR_COLORS[i % SOCIAL_AVATAR_COLORS.length],
                }}
              >
                {initial}
              </div>
            ))}
          </div>
          <div className="text-[13px] leading-tight">
            <div className="flex items-center gap-1 font-semibold">
              <span className="flex text-amber-500" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-current" />
                ))}
              </span>
              <span>{socialProof.ratingLabel}</span>
            </div>
            <div className="text-[11px] text-muted-foreground">{socialProof.ownersLabel}</div>
          </div>
        </div>
      ) : null}

      {items.length ? (
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-[12px] font-medium text-muted-foreground sm:justify-end">
          {items.map((item) => (
            <li key={item.id} className="inline-flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[color:var(--landing-accent)]"
                aria-hidden
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
