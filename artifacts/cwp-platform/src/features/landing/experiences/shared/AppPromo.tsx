import { Link } from "wouter";
import { ArrowRight, Bell, Camera, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingImages } from "../../assets";
import { LANDING_LAYOUT, LANDING_MEDIA } from "../../constants";
import { SectionHead } from "../../components/SectionHead";

/** Shared platform promo — photo reports, tracking, notifications. */
export function AppPromo() {
  return (
    <section className="bg-[color:var(--landing-surface-tint)]/30" data-testid="shared-app-promo">
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto grid gap-12 py-20 md:py-28 lg:grid-cols-2 lg:items-center`}
      >
        <div>
          <SectionHead
            eyebrow="Customer app"
            title="Track service like a product — not a phone call."
            desc="Live location, stage photos, plan management, and notifications — the same platform your ops team uses."
          />
          <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
              Live technician ETA
            </li>
            <li className="flex items-center gap-2">
              <Camera className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
              Photo reports after every job
            </li>
            <li className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[color:var(--landing-accent)]" aria-hidden />
              Push notifications for schedule & completion
            </li>
          </ul>
          <Link href="/register" className="mt-8 inline-flex">
            <Button size="lg" className="rounded-full bg-foreground text-background">
              Create free account
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Button>
          </Link>
        </div>
        <div className="relative overflow-hidden rounded-[32px] border border-border bg-muted shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)]">
          <img
            src={landingImages.appMockup}
            alt="CWP customer app showing service tracking and photo reports"
            width={LANDING_MEDIA.heroWidth}
            height={LANDING_MEDIA.heroHeight}
            loading="lazy"
            decoding="async"
            className="aspect-[4/5] w-full object-cover"
          />
        </div>
      </div>
    </section>
  );
}
