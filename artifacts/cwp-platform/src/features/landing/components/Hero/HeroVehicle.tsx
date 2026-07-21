import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";
import type { HeroJourneyContent } from "../../content/heroTypes";
import { HeroContent } from "./HeroContent";
import { HeroCTA } from "./HeroCTA";
import { HeroMedia } from "./HeroMedia";
import { HeroStats } from "./HeroStats";
import { HeroTrustBar } from "./HeroTrustBar";

export type HeroVehicleProps = {
  content: HeroJourneyContent;
  /** Injected by Hero — keeps selector logic out of this journey */
  selectorSlot: ReactNode;
  enterReady: boolean;
  className?: string;
};

/**
 * Independent vehicle hero journey.
 * No solar conditionals — evolve freely.
 */
export function HeroVehicle({
  content,
  selectorSlot,
  enterReady,
  className,
}: HeroVehicleProps) {
  return (
    <div
      className={cn(
        "relative mx-auto grid",
        LANDING_LAYOUT.maxWidth,
        LANDING_LAYOUT.padX,
        LANDING_LAYOUT.heroPadY,
        LANDING_LAYOUT.heroGap,
        LANDING_LAYOUT.heroGrid,
        className,
      )}
      data-testid="hero-vehicle"
      data-content-key={content.contentKey}
    >
      <div className="flex flex-col justify-center">
        <HeroContent
          locationLabel={content.locationLabel}
          headline={content.headline}
          subheading={content.subheading}
          socialProof={content.socialProof}
          enterReady={enterReady}
        />
        <HeroTrustBar pills={content.trustPills} enterReady={enterReady} />
        <HeroCTA ctas={content.ctas} enterReady={enterReady} />
        {selectorSlot}
      </div>

      <HeroMedia
        media={content.media}
        liveChip={content.liveChip}
        enterReady={enterReady}
        overlay={content.stats ? <HeroStats stats={content.stats} /> : undefined}
      />
    </div>
  );
}
