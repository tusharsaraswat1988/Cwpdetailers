import { MapPin, Phone } from "lucide-react";
import { useBranding } from "@/lib/branding";
import { LANDING_LAYOUT } from "../../constants";

/** Shared contact strip — branding-driven phones & address. */
export function Contact() {
  const branding = useBranding();
  const phone = branding.supportPhone || "87074 88250";
  const tel = phone.replace(/\s/g, "");

  return (
    <section className="border-t border-border bg-white" data-testid="shared-contact">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto flex flex-col items-start justify-between gap-4 py-10 md:flex-row md:items-center`}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--landing-accent)]">
            Contact
          </p>
          <p className="mt-2 font-display text-xl font-semibold">Talk to the Varanasi team</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Humans on the line · 7 AM – 10 PM · No IVR maze
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <a
            href={`tel:${tel}`}
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-medium transition hover:border-foreground/30"
          >
            <Phone className="h-3.5 w-3.5" aria-hidden />
            {phone}
          </a>
          {branding.address ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" aria-hidden />
              {branding.address}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 text-[color:var(--landing-accent)]" aria-hidden />
              Varanasi & surrounding areas
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
