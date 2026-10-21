import { useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, Car, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { AppCallout } from "../shared/AppCallout";
import { cn } from "@/lib/utils";

export type VehicleCategory = "hatchback" | "sedan" | "compact_suv" | "full_suv";

interface CategoryMeta {
  id: VehicleCategory;
  name: string;
  tagline: string;
  examples: string;
}

const VEHICLE_CATEGORIES: CategoryMeta[] = [
  {
    id: "hatchback",
    name: "Hatchback",
    tagline: "Compact City",
    examples: "Swift, Baleno, i20, Tiago, Altroz",
  },
  {
    id: "sedan",
    name: "Sedan",
    tagline: "Executive / Mid-Size",
    examples: "City, Verna, Ciaz, Slavia, Virtus, Dzire",
  },
  {
    id: "compact_suv",
    name: "Compact SUV",
    tagline: "Sub-4m & Crossovers",
    examples: "Creta, Seltos, Brezza, Nexon, Venue, Grand Vitara",
  },
  {
    id: "full_suv",
    name: "Full SUV / Luxury",
    tagline: "7-Seaters & Premium",
    examples: "Fortuner, XUV700, Safari, Scorpio-N, BMW, Audi",
  },
];

interface PlanTier {
  id: string;
  tag: string;
  title: string;
  popular?: boolean;
  period: string;
  body: string;
  prices: Record<VehicleCategory, string>;
  features: string[];
}

const PLANS: PlanTier[] = [
  {
    id: "daily",
    tag: "Most Loved",
    title: "Daily Clean Plan",
    popular: true,
    period: "/month",
    body: "Doorstep exterior rhythm — pure RO wash before your morning commute starts.",
    prices: {
      hatchback: "₹1,799",
      sedan: "₹1,999",
      compact_suv: "₹2,299",
      full_suv: "₹2,799",
    },
    features: [
      "26 Doorstep washes per month",
      "100% De-mineralized RO water (Zero TDS)",
      "Scratch-free 2-bucket microfiber technique",
      "Tire dressing & exterior glass polish",
      "Dedicated morning slot assignment",
    ],
  },
  {
    id: "detail",
    tag: "Deep Care",
    title: "Interior + Exterior Detail",
    period: "/visit",
    body: "Cabin refresh, deep steam sanitization, snow foam bathe, and protection top-up.",
    prices: {
      hatchback: "₹1,299",
      sedan: "₹1,499",
      compact_suv: "₹1,799",
      full_suv: "₹2,299",
    },
    features: [
      "Deep cabin steam & AC disinfectant",
      "Upholstery stain extraction & leather care",
      "High-pressure snow foam hand wash",
      "Dashboard & vinyl UV conditioning",
      "Complete engine bay cleaning & dressing",
    ],
  },
  {
    id: "ceramic",
    tag: "Protection",
    title: "Ceramic Coating",
    period: " onwards",
    body: "Long-lasting 9H/10H nano-shield with deep mirror gloss, extreme hydrophobicity, and swirl defense.",
    prices: {
      hatchback: "₹7,999",
      sedan: "₹8,999",
      compact_suv: "₹10,999",
      full_suv: "₹13,999",
    },
    features: [
      "3-Stage machine paint correction",
      "Elimination of 90%+ swirls & oxidation",
      "Multi-year hydrophobic water-beading",
      "App-tracked warranty & maintenance visits",
      "Scratch & UV oxidation resistance",
    ],
  },
];

/**
 * Plans & Rates section with dynamic vehicle category selection.
 */
export function Packages() {
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("compact_suv");

  const currentCategory =
    VEHICLE_CATEGORIES.find((c) => c.id === selectedCategory) ?? VEHICLE_CATEGORIES[2];

  return (
    <section
      id="packages"
      className="scroll-mt-20 bg-[color:var(--landing-surface-tint)]/35"
      data-testid="vehicle-packages"
    >
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Plans & rates"
          title="Pick your car size. See exact rates."
          desc="Transparent, indicative rates tailored to your vehicle category in Varanasi. No hidden surprises."
        />

        {/* Vehicle Category Selector Tabs */}
        <div className="mt-10 flex flex-col items-center">
          <div
            role="tablist"
            aria-label="Select vehicle category"
            className="inline-flex w-full max-w-3xl flex-wrap items-center justify-center gap-1.5 rounded-2xl bg-white p-1.5 shadow-sm border border-border sm:gap-2 sm:rounded-full"
          >
            {VEHICLE_CATEGORIES.map((cat) => {
              const active = cat.id === selectedCategory;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all sm:rounded-full sm:text-sm",
                    active
                      ? "bg-foreground text-white shadow-sm"
                      : "text-muted-foreground hover:bg-slate-100 hover:text-foreground",
                  )}
                >
                  <Car className={cn("h-4 w-4", active ? "text-white" : "text-muted-foreground")} />
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Category Meta / Examples */}
          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-center text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{currentCategory.tagline}:</span>
            <span className="rounded-md bg-white/80 px-2 py-0.5 border border-border/60">
              {currentCategory.examples}
            </span>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "cwp-lift relative flex flex-col justify-between rounded-3xl border bg-white p-6 md:p-7 shadow-sm transition-all",
                plan.popular
                  ? "border-[color:var(--landing-accent)] shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)] ring-1 ring-[color:var(--landing-accent)]"
                  : "border-border hover:border-slate-300",
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 right-6 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-md">
                  <Sparkles className="h-3 w-3" />
                  <span>{plan.tag}</span>
                </div>
              )}

              <div>
                {!plan.popular && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-accent)]">
                    {plan.tag}
                  </p>
                )}
                <h3 className={cn("font-display text-xl font-bold text-foreground", !plan.popular && "mt-1")}>
                  {plan.title}
                </h3>

                {/* Price Display */}
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-sm font-medium text-muted-foreground">from</span>
                  <span className="font-display text-3xl font-extrabold tracking-tight text-foreground transition-all">
                    {plan.prices[selectedCategory]}
                  </span>
                  <span className="text-sm font-medium text-muted-foreground">{plan.period}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{plan.body}</p>

                {/* Feature Checklist */}
                <ul className="mt-6 space-y-2.5 border-t border-border/60 pt-5 text-xs text-foreground/80">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                        <Check className="h-3 w-3 stroke-[2.5]" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-2">
                <Link href="/register">
                  <Button
                    className={cn(
                      "w-full rounded-full font-medium transition-all",
                      plan.popular
                        ? "bg-foreground text-white hover:bg-slate-800"
                        : "bg-slate-100 text-foreground hover:bg-slate-200",
                    )}
                  >
                    <span>Book for {currentCategory.name}</span>
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                  </Button>
                </Link>
              </div>
            </article>
          ))}
        </div>

        {/* Secondary Links & Callout */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <a href="#work">
            <Button variant="outline" size="lg" className="rounded-full shadow-sm">
              See real results
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </a>
          <Link href="/register">
            <Button size="lg" variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground">
              Compare in the app
            </Button>
          </Link>
        </div>

        <AppCallout message="Exact quote calculated dynamically by vehicle make & model — your total is confirmed before slot booking." />
      </div>
    </section>
  );
}