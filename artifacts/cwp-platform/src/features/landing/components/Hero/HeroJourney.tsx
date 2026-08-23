import { cn } from "@/lib/utils";
import { LANDING_LAYOUT } from "../../constants";
import type { HeroJourneyContent } from "../../content/heroTypes";
import { HeroContent } from "./HeroContent";
import { HeroCredibility } from "./HeroCredibility";
import { HeroCTA } from "./HeroCTA";
import { HeroMedia } from "./HeroMedia";
import { HeroStats } from "./HeroStats";
import { HeroTrustBar } from "./HeroTrustBar";

export type HeroJourneyProps = {
  content: HeroJourneyContent;
  enterReady: boolean;
  testId: string;
  className?: string;
};

/**
 * Shared first-viewport composition for Car Care and Solar Care.
 * Journey-specific copy, media, CTAs and proof stay in the content bundle.
 */
export function HeroJourney({
  content,
  enterReady,
  testId,
  className,
}: HeroJourneyProps) {
  return (
    <div
      className={cn("relative", className)}
      data-testid={testId}
      data-content-key={content.contentKey}
    >
      <div
        className={cn(
          "grid",
          LANDING_LAYOUT.heroGap,
          LANDING_LAYOUT.heroGrid,
        )}
      >
        <div className="flex flex-col">
          <HeroContent
            locationLabel={content.locationLabel}
            headline={content.headline}
            subheading={content.subheading}
            enterReady={enterReady}
          />
          <HeroTrustBar
            pills={content.trustPills}
            enterReady={enterReady}
            className="hidden min-[1400px]:flex"
          />
          <HeroCTA ctas={content.ctas} enterReady={enterReady} />
        </div>

        <HeroMedia
          media={content.media}
          liveChip={content.liveChip}
          enterReady={enterReady}
          overlay={content.stats ? <HeroStats stats={content.stats} /> : undefined}
        />
      </div>

      <HeroCredibility
        items={content.credibility}
        socialProof={content.socialProof}
        enterReady={enterReady}
        className="mt-6 lg:mt-8"
      />
    </div>
  );
}
