import { cn } from "@/lib/utils";
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
 * Hero orchestrator — no knowledge of sections below.
 * Division state comes exclusively from ExperienceProvider.
 */
export function Hero({ content = defaultHeroContent, className }: HeroProps) {
  const { division, setDivision, themeStyle } = useExperience();
  const enterReady = useHeroEnterReady(division);
  const journey = division === "vehicle" ? content.vehicle : content.solar;

  const selectorSlot = (
    <HeroSelector
      content={content.selector}
      value={division}
      onChange={(next, meta) => setDivision(next, { method: meta?.method ?? "click" })}
      enterReady={enterReady}
    />
  );

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
          "pointer-events-none absolute inset-0 bg-gradient-to-b transition-colors duration-700",
          journey.tintClass,
        )}
        aria-hidden
      />

      <div className="relative">
        {division === "vehicle" ? (
          <HeroVehicle
            key={content.vehicle.contentKey}
            content={content.vehicle}
            selectorSlot={selectorSlot}
            enterReady={enterReady}
          />
        ) : (
          <HeroSolar
            key={content.solar.contentKey}
            content={content.solar}
            selectorSlot={selectorSlot}
            enterReady={enterReady}
          />
        )}
      </div>
    </section>
  );
}
