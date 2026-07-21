import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { AppCallout } from "../shared/AppCallout";

const PLANS = [
  {
    id: "home",
    tag: "Home",
    title: "Residential rooftop",
    priceFrom: "₹1,299",
    period: "/visit",
    body: "Soft-brush RO wash with photo evidence for typical 1–10 kW homes.",
  },
  {
    id: "society",
    tag: "Society",
    title: "Apartment / society AMC",
    priceFrom: "₹4,999",
    period: "/month",
    body: "Scheduled cleans with shared reports your committee can download.",
  },
  {
    id: "plant",
    tag: "Plant",
    title: "Commercial / industrial",
    priceFrom: "Custom",
    period: " quote",
    body: "Site visit for larger arrays — jobs tracked in the ops platform.",
  },
] as const;

/** Unique question: “Which package fits my site, and from what price?” */
export function Packages() {
  return (
    <section id="packages" className="bg-white" data-testid="solar-packages">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Packages"
          title="Match the site. See a starting price."
          desc="You know the method. Pick the lane — final slabs confirmed in-app for your kW."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className="cwp-lift rounded-3xl border border-border bg-white p-6 md:p-7"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-accent)]">
                {plan.tag}
              </p>
              <h3 className="mt-2 font-display text-xl font-semibold">{plan.title}</h3>
              <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
                {plan.priceFrom === "Custom" ? "Custom" : `from ${plan.priceFrom}`}
                <span className="text-base font-medium text-muted-foreground">{plan.period}</span>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.body}</p>
            </article>
          ))}
        </div>
        <AppCallout message="Indicative starting prices for Varanasi — your calculator estimate travels with you into booking." />
      </div>
    </section>
  );
}
