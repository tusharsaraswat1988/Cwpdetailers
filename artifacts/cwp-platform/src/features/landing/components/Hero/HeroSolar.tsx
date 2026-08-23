import type { HeroJourneyContent } from "../../content/heroTypes";
import { HeroJourney } from "./HeroJourney";

export type HeroSolarProps = {
  content: HeroJourneyContent;
  enterReady: boolean;
  className?: string;
};

/**
 * Independent solar hero journey.
 * No vehicle conditionals — evolve freely via the content bundle.
 */
export function HeroSolar({
  content,
  enterReady,
  className,
}: HeroSolarProps) {
  return (
    <HeroJourney
      content={content}
      enterReady={enterReady}
      testId="hero-solar"
      className={className}
    />
  );
}
