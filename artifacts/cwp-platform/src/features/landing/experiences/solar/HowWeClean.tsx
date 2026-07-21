import { LANDING_LAYOUT } from "../../constants";
import { landingImages } from "../../assets";
import { SectionHead } from "../../components/SectionHead";
import { AppCallout } from "../shared/AppCallout";

const STEPS = [
  {
    n: "01",
    title: "Safe access, soft tools",
    body: "No walking on modules. Soft brushes only — built to avoid micro-cracks.",
    img: landingImages.heroSolar,
  },
  {
    n: "02",
    title: "RO water rinse",
    body: "Controlled TDS so mineral spots don’t bake into the glass.",
    img: landingImages.evidenceWater,
  },
  {
    n: "03",
    title: "Photo + inverter note",
    body: "Evidence and recovery notes sync to your customer account after the visit.",
    img: landingImages.appMockup,
  },
] as const;

/** Unique question: “Will you scratch my panels / how do you work?” */
export function HowWeClean() {
  return (
    <section id="services" className="bg-[color:var(--landing-surface-tint)]/30" data-testid="solar-how-we-clean">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="How we clean"
          title="Your estimate is personal. The method is disciplined."
          desc="You’ve got a rupee figure. Here’s the process that protects glass and proves recovery."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step) => (
            <article
              key={step.n}
              className="cwp-lift overflow-hidden rounded-3xl border border-border bg-white"
            >
              <img
                src={step.img}
                alt=""
                loading="lazy"
                className="aspect-[16/10] w-full object-cover"
              />
              <div className="p-6">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-accent)]">
                  Step {step.n}
                </span>
                <h3 className="mt-2 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </article>
          ))}
        </div>
        <AppCallout message="AMC schedules and visit reports live in the same app you use for vehicle care — one login." />
      </div>
    </section>
  );
}
