import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";

const QUOTES = [
  {
    id: "t1",
    area: "Sigra",
    name: "Ananya M.",
    quote: "School run used to start with arguing about who washes the car. Now we just leave.",
  },
  {
    id: "t2",
    area: "Cantt",
    name: "Rohit S.",
    quote: "I bought ceramic once. The weekly plan is what keeps it looking new — and I can see every visit.",
  },
] as const;

/** Unique question: “Do people like me stick with this?” — peer emotion, not feature list. */
export function Testimonials() {
  return (
    <section id="testimonials" className="bg-[color:var(--landing-surface-tint)]/30" data-testid="vehicle-testimonials">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Owners"
          title="Two voices. Same relief."
          desc="After you’ve seen the work — here’s why people stay on a plan."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {QUOTES.map((q) => (
            <blockquote
              key={q.id}
              className="rounded-3xl border border-border bg-white p-7 md:p-8"
            >
              <p className="font-display text-xl font-semibold leading-snug tracking-tight">
                “{q.quote}”
              </p>
              <footer className="mt-6 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{q.name}</span>
                <span> · {q.area}</span>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
