import { CheckCircle2 } from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";

const POINTS = [
  "Dust scatters light — cells get weaker photons, not fewer sunny days.",
  "Loss builds daily, so the drop feels ‘normal’ before panels look dirty.",
  "Hotspots from droppings can permanently damage cells.",
] as const;

const BARS = [
  { label: "Clean panel · day 1", pct: 100, tone: "oklch(0.72 0.18 65)" },
  { label: "After 15 days of dust", pct: 88, tone: "oklch(0.75 0.14 70)" },
  { label: "After 30 days (unwashed)", pct: 78, tone: "oklch(0.7 0.16 40)" },
  { label: "After 60 days + bird droppings", pct: 64, tone: "oklch(0.6 0.19 30)" },
] as const;

/**
 * Unique question: “Why don’t I notice the loss?”
 * Hands off to Proof for inverter evidence (no ₹ / +22% replay here).
 */
export function Education() {
  return (
    <section
      id="science"
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.975 0.03 78) 0%, oklch(0.995 0.002 250) 100%)",
      }}
      data-testid="solar-education"
    >
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto pt-16 pb-14 md:pt-24 md:pb-20`}
      >
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">
              The science · Silent soiling
            </div>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-tight md:text-[46px]">
              Most plants don&apos;t need more sunlight.
              <br className="hidden md:block" />
              <span className="text-muted-foreground"> They need </span>
              <span className="text-[color:var(--landing-accent)]">less dust</span>.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              Fine dust blocks light before it reaches the cell. Next, we&apos;ll show how your
              inverter already records that gap — then you can estimate your own number.
            </p>
            <ul className="mt-6 space-y-3 text-[14px]">
              {POINTS.map((point) => (
                <li key={point} className="flex gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--landing-accent)]"
                    aria-hidden
                  />
                  <span className="text-foreground/80">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`${LANDING_LAYOUT.sectionRadius} border border-border bg-white p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] md:p-8`}
          >
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Light reaching the cell
            </div>
            <div className="mt-5 space-y-5">
              {BARS.map((row) => (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-foreground/80">{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.pct}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.pct}%`, background: row.tone }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
