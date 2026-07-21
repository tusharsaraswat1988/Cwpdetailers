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
    id: "q1",
    q: "Do I need to be home?",
    a: "No. Add gate notes in the app. Technicians are ID-badged and the job stays GPS-tracked until close.",
  },
  {
    id: "q2",
    q: "Can I pause or change cars?",
    a: "Yes — pause dates, swap vehicles, and manage slots from My Plans without calling support.",
  },
  {
    id: "q3",
    q: "What if I’m not satisfied?",
    a: "Raise it in-app within 24 hours. We re-do the service — free. No chatbot maze.",
  },
] as const;

/** Unique question: “What could go wrong?” — objections only, no feature replay. */
export function FAQ() {
  return (
    <section id="faq" className="bg-white" data-testid="vehicle-faq">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Before you book"
          title="Three questions that usually stop people."
          desc="Everything else can wait until you’re in the app."
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
