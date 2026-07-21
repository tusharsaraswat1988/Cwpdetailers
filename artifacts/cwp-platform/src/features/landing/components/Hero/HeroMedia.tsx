import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  HERO_SHADOW,
  LANDING_LAYOUT,
  LANDING_MEDIA,
  LANDING_MOTION,
} from "../../constants";
import type { HeroMediaSource } from "../../content/heroTypes";
import { heroEnter } from "../../lib/heroEnter";
import { useParallax } from "../../lib/useParallax";

export type HeroMediaProps = {
  media: HeroMediaSource;
  liveChip?: string;
  /** Overlay slot (typically HeroStats) */
  overlay?: ReactNode;
  enterReady: boolean;
  className?: string;
};

/**
 * Future-ready hero media: image | looping video | animation placeholder.
 * Swap cinematic footage later without changing HeroVehicle / HeroSolar.
 */
export function HeroMedia({
  media,
  liveChip,
  overlay,
  enterReady,
  className,
}: HeroMediaProps) {
  const enter = heroEnter("media", enterReady);
  const { ref, y } = useParallax<HTMLDivElement>(LANDING_MOTION.parallaxStrength);
  const [mediaLoaded, setMediaLoaded] = useState(media.kind !== "image");

  return (
    <div
      ref={ref}
      style={enter.style}
      className={cn(enter.className, "relative", className)}
      data-testid="hero-media"
    >
      <div
        className={cn(
          "relative overflow-hidden border border-border bg-muted",
          HERO_SHADOW.media,
          LANDING_LAYOUT.mediaRadius,
          !mediaLoaded && "cwp-skeleton",
        )}
        style={{
          transform: `translate3d(0, ${y}px, 0)`,
          transition: `transform ${LANDING_MOTION.parallaxFollowMs}ms linear`,
        }}
      >
        <MediaSurface media={media} onReady={() => setMediaLoaded(true)} />

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"
          aria-hidden
        />

        {liveChip ? (
          <div
            className={cn(
              "absolute left-5 top-5 z-[var(--hero-overlay,10)] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 font-medium shadow-md backdrop-blur",
              LANDING_TYPE_CHIP,
            )}
          >
            <span className="relative inline-flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs">{liveChip}</span>
          </div>
        ) : null}

        {overlay ? (
          <div className="absolute bottom-5 right-5 z-[var(--hero-overlay,10)]">{overlay}</div>
        ) : null}
      </div>
    </div>
  );
}

const LANDING_TYPE_CHIP = "text-xs";

function MediaSurface({
  media,
  onReady,
}: {
  media: HeroMediaSource;
  onReady: () => void;
}) {
  const surfaceClass = cn(
    "h-full w-full object-cover",
    LANDING_MEDIA.heroAspect,
    media.kind === "image" && "cwp-kenburns",
  );

  if (media.kind === "video") {
    return (
      <video
        className={surfaceClass}
        src={media.src}
        poster={media.poster}
        loop={media.loop ?? true}
        muted={media.muted ?? true}
        autoPlay={media.autoPlay ?? true}
        playsInline
        aria-label={media.alt}
        onLoadedData={onReady}
      />
    );
  }

  if (media.kind === "animation") {
    return (
      <div
        className={cn(surfaceClass, "flex items-center justify-center bg-muted")}
        role="img"
        aria-label={media.alt}
        data-animation-src={media.src}
      >
        {/* Lottie/Rive adapter plugs in here without changing callers */}
        <span className="text-sm text-muted-foreground">Animation media ready</span>
      </div>
    );
  }

  return (
    <img
      key={media.src}
      src={media.src}
      alt={media.alt}
      width={media.width ?? LANDING_MEDIA.heroWidth}
      height={media.height ?? LANDING_MEDIA.heroHeight}
      className={cn(surfaceClass, "transition-opacity")}
      style={{ transitionDuration: `${LANDING_MOTION.mediaFadeMs}ms` }}
      fetchPriority="high"
      decoding="async"
      onLoad={onReady}
    />
  );
}
