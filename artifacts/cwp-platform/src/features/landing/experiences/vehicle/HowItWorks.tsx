import { LANDING_LAYOUT } from "../../constants";
import { landingImages } from "../../assets";
import { SectionHead } from "../../components/SectionHead";
import { AppCallout } from "../shared/AppCallout";

const STEPS = [
  {
    n: "01",
    title: "Book your car in the app",
    body: "Pick the vehicle, plan, and slot. Instant confirmation — no callbacks, no bargaining.",
    img: landingImages.appMockup,
    imgAlt: "CWP app booking screen",
  },
  {
    n: "02",
    title: "Team arrives at your gate",
    body: "Uniformed specialists with live ETA. You can stay inside — gate notes live on the job card.",
    img: landingImages.heroVehicle,
    imgAlt: "CWP technician at a customer gate",
  },
  {
    n: "03",
    title: "Scientific wash, not a hose",
    body: "Snow foam, dedicated mitts, RO rinse. Built to protect paint — not just make it wet.",
    img: landingImages.evidenceWater,
    imgAlt: "RO water and wash process",
  },
  {
    n: "04",
    title: "Signed report in your inbox",
    body: "Before/after photos and checklist sync to your dashboard the moment the job closes.",
    img: landingImages.beforeAfterCar,
    imgAlt: "Before and after car detailing result",
  },
] as const;

/**
 * Unique question: “How does the service actually work?”
 * Transitions from MorningStory desire → concrete process (app woven as step 01).
 */
export function HowItWorks() {
  return (
    <section id="services" className="bg-white" data-testid="vehicle-how-it-works">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-28`}
      >
        <SectionHead
          eyebrow="How it works"
          title="From booking to signed report — four honest steps."
          desc="You felt the morning. Here’s the system that makes it repeatable every week."
        />
        <ol className="mt-14 grid gap-6 md:grid-cols-2">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="cwp-lift overflow-hidden rounded-3xl border border-border bg-white"
            >
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={step.img}
                  alt={step.imgAlt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="p-6 md:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--landing-surface-tint)] font-display text-sm font-semibold text-[color:var(--landing-accent)]">
                    {step.n}
                  </span>
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <AppCallout message="Plans, ETAs, and photo reports live in one customer account — the same place you pause or reschedule." />
      </div>
    </section>
  );
}
