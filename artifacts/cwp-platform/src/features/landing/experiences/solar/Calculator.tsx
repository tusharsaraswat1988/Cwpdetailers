import { useMemo, useState } from "react";
import { Building2, Factory, Home, MapPin, Sun, Users, Calendar } from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";
import { CalculatorResults } from "./CalculatorResults";
import {
  CITY_PROFILES,
  INSTALL_META,
  WINDOW_META,
  estimateSolarLoss,
  type CleaningWindow,
  type InstallType,
} from "./calculatorModel";

const INSTALL_ICONS = {
  home: Home,
  building: Building2,
  factory: Factory,
  users: Users,
} as const;

/**
 * SIGNATURE MOMENT (Solar): interactive client-side loss estimator.
 * Unique question: “What is *my* plant losing?”
 */
export function Calculator() {
  const [kw, setKw] = useState(10);
  const [installType, setInstallType] = useState<InstallType>("residential");
  const [cleaningWindow, setCleaningWindow] = useState<CleaningWindow>("60");
  const [cityKey, setCityKey] = useState("varanasi");
  const [interacted, setInteracted] = useState(false);

  const mark = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setInteracted(true);
  };

  const result = useMemo(
    () => estimateSolarLoss({ kw, installType, cleaningWindow, cityKey }),
    [kw, installType, cleaningWindow, cityKey],
  );

  return (
    <section id="calculator" className="bg-white" data-testid="solar-calculator">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <div className="overflow-hidden rounded-[36px] border border-border bg-gradient-to-br from-[color:var(--landing-surface-tint)]/70 to-white p-6 md:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-start">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[color:var(--landing-accent)]">
                Signature · Your number in 30 seconds
              </div>
              <h2 className="mt-2 font-display text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
                How much is <span className="text-[color:var(--landing-accent)]">your</span> plant
                losing?
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                You saw the science and the inverter gap. Adjust four inputs — we estimate dust,
                loss, recoverable kWh, and rupees at stake. Client-side only.
              </p>

              <div className="mt-8 space-y-7">
                <div>
                  <div className="flex items-center justify-between text-sm font-medium">
                    <label htmlFor="kw" className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                      Plant size
                    </label>
                    <span className="rounded-full bg-white px-3 py-1 text-[13px] font-semibold shadow-sm">
                      {kw} kW
                    </span>
                  </div>
                  <input
                    id="kw"
                    type="range"
                    min={2}
                    max={200}
                    step={1}
                    value={kw}
                    onChange={(e) => mark(setKw)(Number(e.target.value))}
                    className="mt-3 w-full accent-[color:var(--landing-accent)]"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>2 kW</span>
                    <span>200 kW</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                    Last cleaned?
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(WINDOW_META) as CleaningWindow[]).map((k) => {
                      const active = cleaningWindow === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => mark(setCleaningWindow)(k)}
                          className={`rounded-2xl border px-3 py-3 text-left text-[12px] transition ${
                            active
                              ? "border-[color:var(--landing-accent)] bg-[color:var(--landing-accent)]/10"
                              : "border-border bg-white hover:border-foreground/25"
                          }`}
                        >
                          <div className="font-semibold">{WINDOW_META[k].label}</div>
                          <div className="mt-1 text-muted-foreground">~{WINDOW_META[k].days}d</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                    Installation type
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.keys(INSTALL_META) as InstallType[]).map((k) => {
                      const meta = INSTALL_META[k];
                      const Icon = INSTALL_ICONS[meta.icon];
                      const active = installType === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => mark(setInstallType)(k)}
                          className={`rounded-2xl border px-3 py-3 text-left text-[12px] transition ${
                            active
                              ? "border-[color:var(--landing-accent)] bg-[color:var(--landing-accent)]/10"
                              : "border-border bg-white hover:border-foreground/25"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                          <div className="mt-1 font-semibold">{meta.label}</div>
                          <div className="mt-0.5 text-muted-foreground">{meta.sizeHint}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="city"
                    className="flex items-center gap-2 text-sm font-medium"
                  >
                    <MapPin className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
                    City
                  </label>
                  <select
                    id="city"
                    value={cityKey}
                    onChange={(e) => mark(setCityKey)(e.target.value)}
                    className="mt-3 w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm font-medium shadow-sm focus:border-[color:var(--landing-accent)] focus:outline-none"
                  >
                    {Object.entries(CITY_PROFILES).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <CalculatorResults
              interacted={interacted}
              cityLabel={result.city.label}
              windowLabel={result.win.label}
              installLabel={result.inst.label}
              kw={kw}
              dustGramsPerM2={result.dustGramsPerM2}
              efficiencyLossPct={result.efficiencyLossPct}
              recoverableMonthlyKWh={result.recoverableMonthlyKWh}
              annualBenefit={result.annualBenefit}
              recommendedDays={result.recommendedDays}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
