import { Link } from "wouter";
import { ArrowRight, Phone } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { trackLandingEvent } from "../../analytics";
import { LANDING_LAYOUT } from "../../constants";
import { useExperience } from "../../ExperienceProvider";

/**
 * Final convert — one hard ask. No trust-pill replay.
 * Vehicle: book care · Solar: book inspection (calc already owned the ₹ story).
 */
export function ExperienceCTA() {
  const { isVehicle } = useExperience();
  const branding = useBranding();
  const phone = branding.supportPhone?.replace(/\s/g, "") || "8707488250";

  const cfg = isVehicle
    ? {
        eyebrow: "Ready when you are",
        headline: "Start your first week of effortless clean.",
        sub: "Create an account, add your car, and pick a slot. The morning story becomes your calendar.",
        primary: { id: "cta-vehicle-register", label: "Create account & book", href: "/register" },
        secondary: { id: "cta-vehicle-login", label: "I already have an account", href: "/login" },
      }
    : {
        eyebrow: "Ready when you are",
        headline: "Book the clean. Bring your estimate.",
        sub: "You’ve modeled the loss. Next step is a scheduled visit — reports land in the same app.",
        primary: { id: "cta-solar-register", label: "Book solar cleaning", href: "/register" },
        secondary: { id: "cta-solar-login", label: "Open my account", href: "/login" },
      };

  return (
    <section
      id="book"
      className="relative overflow-hidden bg-foreground text-white"
      data-testid="experience-cta"
    >
      <div
        className={`relative ${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-28`}
      >
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">
            {cfg.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-4xl leading-tight tracking-tight md:text-5xl">
            {cfg.headline}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">{cfg.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={cfg.primary.href}>
              <Button
                size="lg"
                className="rounded-full bg-white text-foreground hover:bg-white/95"
                onClick={() =>
                  trackLandingEvent("hero_cta_clicked", {
                    ctaId: cfg.primary.id,
                    href: cfg.primary.href,
                  })
                }
              >
                {cfg.primary.label}
                <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href={cfg.secondary.href}>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10"
                onClick={() =>
                  trackLandingEvent("hero_cta_clicked", {
                    ctaId: cfg.secondary.id,
                    href: cfg.secondary.href,
                  })
                }
              >
                {cfg.secondary.label}
              </Button>
            </Link>
            <a
              href={`https://wa.me/91${phone.replace(/^91/, "")}`}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/10"
            >
              <Phone className="h-4 w-4" aria-hidden />
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
