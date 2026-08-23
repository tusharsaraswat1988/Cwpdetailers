import { MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_TYPE, SOCIAL_AVATAR_COLORS } from "../../constants";
import type { HeroHeadline, HeroSocialProof } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";

export type HeroContentProps = {
  locationLabel?: string;
  headline: HeroHeadline;
  subheading: string;
  socialProof?: HeroSocialProof;
  enterReady: boolean;
  className?: string;
};

export function HeroContent({
  locationLabel,
  headline,
  subheading,
  socialProof,
  enterReady,
  className,
}: HeroContentProps) {
  const eyebrowEnter = heroEnter("eyebrow", enterReady);
  const headlineEnter = heroEnter("headline", enterReady);
  const subEnter = heroEnter("subheading", enterReady);

  return (
    <div className={cn("flex flex-col", className)}>
      {locationLabel ? (
        <div
          style={eyebrowEnter.style}
          className={cn(
            eyebrowEnter.className,
            "hidden w-fit items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur 2xl:inline-flex",
          )}
        >
          <MapPin className="h-3 w-3" aria-hidden />
          {locationLabel}
        </div>
      ) : null}

      {headline.eyebrow ? (
        <p
          style={eyebrowEnter.style}
          className={cn(
            eyebrowEnter.className,
            "text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)] transition-colors duration-300",
            locationLabel && "2xl:mt-2",
          )}
        >
          {headline.eyebrow}
        </p>
      ) : null}

      <h1
        style={headlineEnter.style}
        className={cn(
          headlineEnter.className,
          "mt-1.5 font-display font-semibold tracking-tight md:mt-2",
          LANDING_TYPE.heroMobile,
          LANDING_TYPE.heroDesktop,
          LANDING_TYPE.heroLeading,
        )}
      >
        {headline.before}
        <br />
        <span className="text-[color:var(--landing-accent)] transition-colors duration-300">
          {headline.emphasis}
        </span>
        {headline.after ?? ""}
      </h1>

      <p
        style={subEnter.style}
        className={cn(
          subEnter.className,
          "mt-2.5 max-w-xl leading-relaxed text-muted-foreground md:mt-3",
          LANDING_TYPE.sub,
        )}
      >
        {subheading}
      </p>

      {socialProof ? (
        <div className="mt-7 flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden>
            {socialProof.avatarInitials.map((initial, i) => (
              <div
                key={`${initial}-${i}`}
                className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-sm"
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
    </div>
  );
}
