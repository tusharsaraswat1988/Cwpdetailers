import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";

const ITEMS = [
  {
    id: "sq1",
    q: "Will cleaning scratch panels?",
    a: "We don’t walk on modules and we don’t pressure-wash coated glass. Soft brush + RO only.",
  },
  {
    id: "sq2",
    q: "How often should I clean in Varanasi?",
    a: "Most rooftops benefit every 30–45 days; dusty industrial sites tighter. Your calculator recommends a cadence.",
  },
  {
    id: "sq3",
    q: "Can a society book once for everyone?",
    a: "Yes — one account, multiple sites, shared invoices and downloadable visit reports.",
  },
] as const;

/** Unique question: “What are the risks / logistics?” */
export function FAQ() {
  return (
    <section id="faq" className="bg-[color:var(--landing-surface-tint)]/20" data-testid="solar-faq">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Before you book"
          title="Safety and logistics — briefly."
          desc="No more science. Just the objections that matter."
        />
        <Accordion type="single" collapsible className="mt-10 max-w-2xl">
          {ITEMS.map((item) => (
            <AccordionItem key={item.id} value={item.id}>
              <AccordionTrigger className="text-left text-base font-semibold">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
