import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { AppCallout } from "../shared/AppCallout";

/** Static indicative pricing — API wiring comes after journey polish. */
const PLANS = [
  {
    id: "daily",
    tag: "Most loved",
    title: "Daily Clean Plan",
    priceFrom: "₹1,999",
    period: "/month",
    body: "Doorstep exterior rhythm — your car ready before the day starts.",
    highlight: true,
  },
  {
    id: "detail",
    tag: "Deep care",
    title: "Interior + Exterior Detail",
    priceFrom: "₹1,499",
    period: "/visit",
    body: "Cabin refresh, foam wash, and protection top-up when you need a reset.",
    highlight: false,
  },
  {
    id: "ceramic",
    tag: "Protection",
    title: "Ceramic Coating",
    priceFrom: "₹8,999",
    period: " onwards",
    body: "Long-lasting gloss with maintenance visits scheduled in the app.",
    highlight: false,
  },
] as const;

/**
 * Unique question: “What do I buy, and roughly what does it cost?”
 * Soft CTA only — hard convert stays at final ExperienceCTA.
 */
export function Packages() {
  return (
    <section id="packages" className="bg-[color:var(--landing-surface-tint)]/35" data-testid="vehicle-packages">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Plans & rates"
          title="Pick a plan. See the number."
          desc="You know the process. Here’s what owners actually book — indicative starting prices for Varanasi."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={`cwp-lift flex flex-col rounded-3xl border bg-white p-6 md:p-7 ${
                plan.highlight
                  ? "border-[color:var(--landing-accent)] shadow-[0_20px_50px_-30px_rgba(15,23,42,0.25)]"
                  : "border-border"
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-accent)]">
                {plan.tag}
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold">{plan.title}</h3>
              <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
                from {plan.priceFrom}
                <span className="text-base font-medium text-muted-foreground">{plan.period}</span>
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{plan.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a href="#work">
            <Button variant="outline" size="lg" className="rounded-full">
              See real results
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </a>
          <Link href="/register">
            <Button size="lg" variant="ghost" className="rounded-full">
              Compare in the app
            </Button>
          </Link>
        </div>
        <AppCallout message="Final quote depends on car size and add-ons — the app shows your total before you confirm." />
      </div>
    </section>
  );
}
