import {
  BadgeCheck,
  Camera,
  ClipboardCheck,
  Droplets,
  Headphones,
  Shield,
} from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { Reveal } from "../../lib/Reveal";

const ITEMS = [
  {
    icon: BadgeCheck,
    title: "Background-verified technicians",
    body: "Every specialist is police-verified, uniformed and trained on a 42-point CWP protocol.",
  },
  {
    icon: Camera,
    title: "Real-time updates on the app",
    body: "Live GPS, photos at every stage, and a full report you can share with your family.",
  },
  {
    icon: Droplets,
    title: "RO purified water & pH-balanced chemicals",
    body: "TDS below 20 ppm to prevent water spots. Biodegradable, paint-safe cleaners only.",
  },
  {
    icon: ClipboardCheck,
    title: "Reports after every service",
    body: "Before/after photos, checklist status, and technician notes archived for you.",
  },
  {
    icon: Shield,
    title: "Satisfaction guarantee",
    body: "Not happy? We come back within 24 hours and re-do the service — free.",
  },
  {
    icon: Headphones,
    title: "Human support, not chatbots",
    body: "Call or WhatsApp our Varanasi team any day between 7 AM and 10 PM.",
  },
] as const;

/** Trust / differentiation grid — platform-connected promises. */
export function WhyCWP() {
  return (
    <section id="why" className="bg-[color:var(--landing-surface-tint)]/40" data-testid="why-cwp">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-28`}
      >
        <SectionHead
          eyebrow="Why owners choose CWP"
          title="Six reasons your assets are safer with us."
          desc="No jargon. No shortcuts. Just visible, measurable care — service after service."
        />
        <Reveal stagger className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-border bg-border md:grid-cols-3">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="cwp-lift bg-white p-7 md:p-8">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--landing-surface-tint)] text-[color:var(--landing-accent)]">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="mt-5 text-[17px] font-semibold tracking-tight">{item.title}</div>
                <div className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                  {item.body}
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
