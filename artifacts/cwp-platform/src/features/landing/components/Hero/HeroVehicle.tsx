import type { HeroJourneyContent } from "../../content/heroTypes";
import { HeroJourney } from "./HeroJourney";

export type HeroVehicleProps = {
  content: HeroJourneyContent;
  enterReady: boolean;
  className?: string;
};

/**
 * Independent vehicle hero journey.
 * No solar conditionals — evolve freely via the content bundle.
 */
export function HeroVehicle({
  content,
  enterReady,
  className,
}: HeroVehicleProps) {
  return (
    <HeroJourney
      content={content}
      enterReady={enterReady}
      testId="hero-vehicle"
      className={className}
    />
  );
}
