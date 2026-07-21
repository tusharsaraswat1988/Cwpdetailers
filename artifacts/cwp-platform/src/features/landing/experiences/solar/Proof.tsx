import { ClipboardCheck, TrendingDown } from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const EXPECTED = [42, 44, 43, 45, 44, 46, 45];
const ACTUAL = [34, 35, 33, 34, 33, 35, 34];

/**
 * Unique question: “How do I know this isn’t marketing math?”
 * Visual inverter chart — ₹ recovery belongs in the Calculator next.
 */
export function Proof() {
  const max = Math.max(...EXPECTED);
  const totalExpected = EXPECTED.reduce((a, b) => a + b, 0);
  const totalActual = ACTUAL.reduce((a, b) => a + b, 0);
  const lostKWh = totalExpected - totalActual;
  const lossPct = Math.round((lostKWh / totalExpected) * 100);

  return (
    <section id="proof" className="bg-white" data-testid="solar-proof">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">
              Evidence · From the inverter
            </div>
            <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold leading-[1.08] tracking-tight md:text-[44px]">
              Your inverter already knows
              <br className="hidden md:block" />
              <span className="text-[color:var(--landing-accent)]"> the gap.</span>
            </h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground">
              Expected vs actual generation is logged every day. We isolate the recoverable
              energy and print it on your visit report — then you can model your rooftop next.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-foreground/80">
              <li className="flex gap-3">
                <TrendingDown className="mt-0.5 h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                Sample week from a 25 kW Varanasi rooftop (illustrative).
              </li>
              <li className="flex gap-3">
                <ClipboardCheck className="mt-0.5 h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                After cleaning, the same chart is emailed into your customer account.
              </li>
            </ul>
          </div>

          <div
            className={`${LANDING_LAYOUT.sectionRadius} border border-border bg-[color:var(--landing-surface-tint)] p-6 md:p-8`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Weekly generation vs expected
                </div>
                <div className="mt-1 font-display text-lg font-semibold">Pre-clean sample</div>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-[color:var(--landing-accent)] shadow-sm">
                Inverter view
              </span>
            </div>

            <div className="mt-6 flex h-40 items-end gap-3" role="img" aria-label="Bar chart of expected versus actual kWh">
              {DAYS.map((d, i) => {
                const eH = (EXPECTED[i] / max) * 100;
                const aH = (ACTUAL[i] / max) * 100;
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1">
                    <div className="relative flex h-32 w-full items-end justify-center gap-1">
                      <div
                        className="w-2.5 rounded-t-md bg-muted-foreground/25"
                        style={{ height: `${eH}%` }}
                        title={`Expected ${EXPECTED[i]} kWh`}
                      />
                      <div
                        className="w-2.5 rounded-t-md"
                        style={{
                          height: `${aH}%`,
                          background: "var(--landing-accent)",
                        }}
                        title={`Actual ${ACTUAL[i]} kWh`}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground">{d}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> Expected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--landing-accent)" }}
                />{" "}
                Actual (soiled)
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
              <div>
                <div className="text-[11px] text-muted-foreground">Expected</div>
                <div className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {totalExpected} kWh
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Actual</div>
                <div className="mt-1 font-display text-xl font-semibold tabular-nums">
                  {totalActual} kWh
                </div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Gap</div>
                <div className="mt-1 font-display text-xl font-semibold tabular-nums text-[color:var(--landing-accent)]">
                  {lostKWh} · {lossPct}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
