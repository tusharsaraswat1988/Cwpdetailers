import { IndianRupee, TrendingDown, Wind, Zap } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Reveal } from "../../lib/Reveal";

export type CalculatorResultsProps = {
  interacted: boolean;
  cityLabel: string;
  windowLabel: string;
  installLabel: string;
  kw: number;
  dustGramsPerM2: number;
  efficiencyLossPct: number;
  recoverableMonthlyKWh: number;
  annualBenefit: number;
  recommendedDays: number;
};

export function CalculatorResults({
  interacted,
  cityLabel,
  windowLabel,
  installLabel,
  kw,
  dustGramsPerM2,
  efficiencyLossPct,
  recoverableMonthlyKWh,
  annualBenefit,
  recommendedDays,
}: CalculatorResultsProps) {
  const steps = [
    {
      icon: Wind,
      label: "Estimated dust on your panels",
      value: `${dustGramsPerM2} g/m²`,
      sub: `${windowLabel} · ${cityLabel}`,
    },
    {
      icon: TrendingDown,
      label: "Efficiency you’re losing now",
      value: `${efficiencyLossPct}%`,
      sub: `${installLabel} · ${kw} kW plant`,
    },
    {
      icon: Zap,
      label: "Energy you can recover monthly",
      value: `${recoverableMonthlyKWh.toLocaleString("en-IN")} kWh`,
      sub: "Modeled from sun hours × soiling — verified on inverter after visits",
    },
    {
      icon: IndianRupee,
      label: "Approx. annual value at stake",
      value: `₹${annualBenefit.toLocaleString("en-IN")}`,
      sub: `At local tariff · clean every ~${recommendedDays} days`,
    },
  ];

  if (!interacted) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-white/70 p-8 text-center">
        <p className="font-display text-xl font-semibold">Your numbers appear as you adjust</p>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Move the plant size or pick when you last cleaned — this is a client-side estimate, not
          a bill.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <Reveal key={step.label} delay={i * 70} className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--landing-surface-tint)] text-[color:var(--landing-accent)]">
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div>
                <div className="text-[12px] text-muted-foreground">{step.label}</div>
                <div className="mt-0.5 font-display text-2xl font-semibold tabular-nums">
                  {step.value}
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">{step.sub}</div>
              </div>
            </div>
          </Reveal>
        );
      })}
      <div className="pt-2">
        <Link href="/register">
          <Button size="lg" className="w-full rounded-full bg-foreground text-background">
            Book a clean with this estimate
          </Button>
        </Link>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Next: see how we clean safely — then pick a package.
        </p>
      </div>
    </div>
  );
}
