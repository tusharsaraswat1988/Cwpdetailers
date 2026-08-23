import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";
import { defaultHeroContent } from "../../content/defaultHeroContent";
import type { HeroContentBundle } from "../../content/heroTypes";
import { useExperience } from "../../ExperienceProvider";
import { useHeroEnterReady } from "../../lib/useHeroEnterReady";
import { HeroSelector } from "./HeroSelector";
import { HeroSolar } from "./HeroSolar";
import { HeroVehicle } from "./HeroVehicle";

export type HeroProps = {
  /** CMS / A-B / locale bundle — defaults to static EN content */
  content?: HeroContentBundle;
  className?: string;
};

/**
 * Hero orchestrator — the Car / Solar toggle switches the entire first-viewport experience.
 * Division state comes exclusively from ExperienceProvider.
 */
export function Hero({ content = defaultHeroContent, className }: HeroProps) {
  const { division, setDivision, themeStyle } = useExperience();
  const selectorEnterReady = useHeroEnterReady();
  const journeyEnterReady = useHeroEnterReady(division);
  const journey = division === "vehicle" ? content.vehicle : content.solar;

  return (
    <section
      className={cn("relative overflow-hidden", className)}
      style={themeStyle}
      aria-label="Hero"
      data-testid="landing-hero"
      data-division={division}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-b transition-colors duration-500",
          journey.tintClass,
        )}
        aria-hidden
      />

      <div
        className={cn(
          "relative mx-auto",
          LANDING_LAYOUT.maxWidth,
          LANDING_LAYOUT.padX,
          LANDING_LAYOUT.heroPadY,
        )}
      >
        <HeroSelector
          content={content.selector}
          value={division}
          onChange={(next, meta) => setDivision(next, { method: meta?.method ?? "click" })}
          enterReady={selectorEnterReady}
        />

        <div className={LANDING_LAYOUT.heroAfterSelector}>
          {division === "vehicle" ? (
            <HeroVehicle
              key={content.vehicle.contentKey}
              content={content.vehicle}
              enterReady={journeyEnterReady}
            />
          ) : (
            <HeroSolar
              key={content.solar.contentKey}
              content={content.solar}
              enterReady={journeyEnterReady}
            />
          )}
        </div>
      </div>
    </section>
  );
}
