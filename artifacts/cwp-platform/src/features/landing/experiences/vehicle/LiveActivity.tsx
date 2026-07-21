import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { LANDING_LAYOUT, LANDING_MOTION } from "../../constants";
import { SectionHead } from "../../components/SectionHead";

const FEED = [
  { area: "Sigra", type: "Toyota Fortuner · Full detail", time: "8 min ago", tag: "Vehicle" },
  { area: "Ramnagar", type: "24 kW rooftop · Panel wash", time: "12 min ago", tag: "Solar" },
  { area: "Bhelupur", type: "Hyundai Creta · Interior deep clean", time: "27 min ago", tag: "Vehicle" },
  { area: "Sarnath", type: "8 kW residential · Panel wash", time: "42 min ago", tag: "Solar" },
  { area: "Cantt", type: "Mahindra XUV · Ceramic top-up", time: "1 hr ago", tag: "Vehicle" },
] as const;

/** Relatability beat — live Varanasi job feed (demo cadence). */
export function LiveActivity() {
  const feed = useMemo(() => FEED, []);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia?.(LANDING_MOTION.reducedMotion).matches) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 3000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="bg-white" data-testid="vehicle-live-activity">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <SectionHead
              eyebrow="Live from Varanasi"
              title="Real jobs, happening right now."
              desc="Every service is logged with GPS, time-stamped photos and technician IDs — refreshed as it happens."
            />
            <div className="mt-8 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                18 teams active today
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 font-medium">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Avg. arrival 32 min
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border bg-[color:var(--landing-surface-tint)]/50 p-3">
            <div className="flex items-center justify-between px-4 py-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="relative inline-flex h-2 w-2" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                LIVE ACTIVITY FEED
              </span>
              <span>Updated just now</span>
            </div>
            <ul className="space-y-2" aria-live="polite">
              {feed.map((item, i) => {
                const highlight = i === tick % feed.length;
                return (
                  <li
                    key={`${item.area}-${item.type}`}
                    className={`flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm transition ${
                      highlight ? "ring-2 ring-[color:var(--landing-ring)]/40" : ""
                    }`}
                  >
                    <div>
                      <div className="font-medium">{item.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.area} · {item.time}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[color:var(--landing-surface-tint)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--landing-accent)]">
                      {item.tag}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
