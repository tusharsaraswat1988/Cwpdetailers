import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_MOTION } from "../../constants";

export type BeforeAfterSliderProps = {
  src: string;
  alt: string;
  className?: string;
};

/** Interactive before/after compare — visual proof primitive. */
export function BeforeAfterSlider({ src, alt, className }: BeforeAfterSliderProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);

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
        setPos(30 + tri * 40);
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
        "group relative select-none overflow-hidden rounded-3xl border border-border bg-muted",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => {
        if (dragging) setFromClientX(e.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      role="slider"
      aria-label="Drag to compare before and after"
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
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={1400}
        height={900}
        draggable={false}
        className="pointer-events-none aspect-[7/4] w-full object-cover"
      />
      <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
        Before
      </div>
      <div className="absolute right-4 top-4 rounded-full bg-emerald-500/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
        After
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/80 shadow-[0_0_20px_rgba(255,255,255,0.55)]"
        style={{
          left: `${pos}%`,
          transition: dragging ? "none" : "left 220ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-foreground shadow-lg">
          <ArrowRight className="h-3.5 w-3.5 -mr-3" aria-hidden />
          <ArrowRight className="h-3.5 w-3.5 -ml-3 rotate-180" aria-hidden />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 rounded-xl bg-black/50 px-4 py-2 text-[11px] text-white/85 backdrop-blur">
        {touched ? "Same angle · same day · unfiltered" : "Drag the handle to compare"}
      </div>
    </div>
  );
}
