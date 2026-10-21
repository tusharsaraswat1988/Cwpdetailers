import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_MOTION } from "../../constants";

export type BeforeAfterSliderProps = {
  /** Single composite fallback image */
  src?: string;
  /** Full-frame 'before' condition image */
  beforeSrc?: string;
  /** Full-frame 'after' condition image */
  afterSrc?: string;
  alt: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
};

/**
 * Enhanced interactive before/after visual proof slider.
 * Supports genuine dual-layer clipping (via clip-path) or high-contrast split comparison.
 */
export function BeforeAfterSlider({
  src,
  beforeSrc,
  afterSrc,
  alt,
  beforeLabel = "Before",
  afterLabel = "After",
  className,
}: BeforeAfterSliderProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);

  // Fallback to src if dual images aren't individually provided
  const primaryAfter = afterSrc || src || "";
  const primaryBefore = beforeSrc || src || "";
  const isDualLayer = Boolean(beforeSrc && afterSrc);

  useEffect(() => {
    if (touched) return;
    if (window.matchMedia?.(LANDING_MOTION.reducedMotion).matches) return;
    let raf = 0;
    const start = performance.now();
    const loop = (t: number) => {
      const el = wrapRef.current;
      const rect = el?.getBoundingClientRect();
      const visible =
        rect != null && rect.top < window.innerHeight && rect.bottom > 0;
      if (visible) {
        const p = ((t - start) / 4200) % 2;
        const tri = p < 1 ? p : 2 - p;
        setPos(32 + tri * 36);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [touched]);

  const setFromClientX = (clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(2, Math.min(98, pct)));
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setTouched(true);
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };

  return (
    <div
      ref={wrapRef}
      className={cn(
        "group relative select-none overflow-hidden rounded-3xl border border-border bg-slate-950 shadow-2xl",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (dragging) setFromClientX(e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      role="slider"
      aria-label="Drag to compare before and after detailing results"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") {
          setTouched(true);
          setPos((p) => Math.max(0, p - 4));
        }
        if (e.key === "ArrowRight") {
          setTouched(true);
          setPos((p) => Math.min(100, p + 4));
        }
      }}
      style={{ cursor: dragging ? "grabbing" : "grab" }}
      data-testid="before-after-slider"
    >
      <div className="relative aspect-[16/10] sm:aspect-[7/4] w-full overflow-hidden">
        {/* Layer 1: "After" Image (Clean, glossy, detailed result) */}
        <img
          src={primaryAfter}
          alt={`After: ${alt}`}
          loading="lazy"
          width={1400}
          height={900}
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Layer 2: "Before" Image (Clipped dynamically based on pos%) */}
        <div
          className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
          style={{
            clipPath: `inset(0 ${100 - pos}% 0 0)`,
            transition: dragging ? "none" : "clip-path 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <img
            src={primaryBefore}
            alt={`Before: ${alt}`}
            loading="lazy"
            width={1400}
            height={900}
            draggable={false}
            className={cn(
              "pointer-events-none absolute inset-0 h-full w-full object-cover",
              !isDualLayer && "brightness-90 contrast-95 saturate-[0.85] sepia-[0.12]",
            )}
          />
        </div>

        {/* Badges */}
        <div className="absolute left-4 top-4 rounded-full bg-black/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur shadow-sm">
          {beforeLabel}
        </div>
        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-emerald-600/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm backdrop-blur">
          <Sparkles className="h-3 w-3" />
          <span>{afterLabel}</span>
        </div>

        {/* Divider line & handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-[2px] bg-white shadow-[0_0_15px_rgba(255,255,255,0.85)]"
          style={{
            left: `${pos}%`,
            transition: dragging ? "none" : "left 220ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-2xl ring-2 ring-black/15 transition-transform group-hover:scale-105">
            <ArrowRight className="h-3.5 w-3.5 -mr-2.5 text-foreground" aria-hidden />
            <ArrowRight className="h-3.5 w-3.5 -ml-2.5 rotate-180 text-foreground" aria-hidden />
          </div>
        </div>

        {/* Subtitle / Bottom Indicator Strip */}
        <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between rounded-xl bg-black/60 px-4 py-2 text-[11px] text-white/90 backdrop-blur">
          <span>
            {touched ? "Real customer vehicles · Same day · Varanasi" : "Drag slider left & right to inspect results"}
          </span>
          <span className="font-mono text-[10px] text-white/70">{Math.round(pos)}%</span>
        </div>
      </div>
    </div>
  );
}
