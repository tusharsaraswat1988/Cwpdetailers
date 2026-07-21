import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";

const QUOTES = [
  {
    id: "s1",
    name: "Vikram T.",
    area: "Ramnagar · 8 kW",
    quote: "The first clean paid for itself on the bill. Now the AMC just runs in the app.",
  },
  {
    id: "s2",
    name: "Society secretary",
    area: "Bhelupur",
    quote: "Committee needed downloadable reports. Photo + checklist exports closed the argument.",
  },
] as const;

/** Unique question: “Did recovery happen for owners like me?” */
export function Testimonials() {
  return (
    <section className="bg-white" data-testid="solar-testimonials">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Owners"
          title="Recovery stories — not feature lists."
          desc="You’ve seen the glass. Here’s why people keep the schedule."
        />
        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {QUOTES.map((q) => (
            <blockquote
              key={q.id}
              className="rounded-3xl border border-border bg-[color:var(--landing-surface-tint)]/40 p-7"
            >
              <p className="font-display text-xl font-semibold leading-snug">“{q.quote}”</p>
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
