import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { Reveal } from "../../lib/Reveal";

export type StoryCard = {
  id: string;
  title: string;
  body: string;
  meta?: string;
};

export type StoryScaffoldProps = {
  id?: string;
  eyebrow: string;
  title: string;
  desc?: string;
  cards: StoryCard[];
  columns?: "2" | "3";
  testId?: string;
};

/**
 * Coherent interim section for experiences still being enriched.
 * Real hierarchy + cards — not a “coming soon” hybrid with old Landing.
 */
export function StoryScaffold({
  id,
  eyebrow,
  title,
  desc,
  cards,
  columns = "3",
  testId,
}: StoryScaffoldProps) {
  return (
    <section id={id} className="bg-background" data-testid={testId}>
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead eyebrow={eyebrow} title={title} desc={desc} />
        <Reveal
          stagger
          className={`mt-12 grid gap-4 ${columns === "2" ? "md:grid-cols-2" : "md:grid-cols-3"}`}
        >
          {cards.map((card) => (
            <article
              key={card.id}
              className="cwp-lift rounded-3xl border border-border bg-white p-6 md:p-7"
            >
              {card.meta ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--landing-accent)]">
                  {card.meta}
                </p>
              ) : null}
              <h3 className="mt-2 font-display text-lg font-semibold tracking-tight">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{card.body}</p>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
