import { Star, ShieldCheck, Car, MapPin, CheckCircle2 } from "lucide-react";
import { LANDING_LAYOUT, SOCIAL_AVATAR_COLORS } from "../../constants";
import { SectionHead } from "../../components/SectionHead";
import { cn } from "@/lib/utils";

interface TestimonialItem {
  id: string;
  name: string;
  area: string;
  vehicle: string;
  plan: string;
  initials: string;
  avatarColor: string;
  rating: number;
  verified: boolean;
  quote: string;
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    id: "t1",
    name: "Ananya Mishra",
    area: "Sigra",
    vehicle: "Hyundai Creta SX",
    plan: "Daily Clean Member · 11 mos",
    initials: "AM",
    avatarColor: SOCIAL_AVATAR_COLORS[0],
    rating: 5,
    verified: true,
    quote:
      "With an Abyss Black Creta in Varanasi dust, ordinary colony washes left endless swirl circles. CWP’s zero-TDS RO water and 2-bucket microfiber technique completely ended swirl marks. My morning school run starts with a spotless, glossy car.",
  },
  {
    id: "t2",
    name: "Rohit Singhal",
    area: "Cantt",
    vehicle: "Honda City ZX",
    plan: "Ceramic + Care Plan · 2 yrs",
    initials: "RS",
    avatarColor: SOCIAL_AVATAR_COLORS[1],
    rating: 5,
    verified: true,
    quote:
      "I got their 9H nano-ceramic coating done last year. What keeps me renewing is their scheduled rhythm — they log every single visit with high-res photos and tire dressing logs in the app before I leave for court.",
  },
  {
    id: "t3",
    name: "Vikramaditya Pandey",
    area: "Ravindrapuri",
    vehicle: "Toyota Fortuner 4x4",
    plan: "Deep Detail + Weekly · 8 mos",
    initials: "VP",
    avatarColor: SOCIAL_AVATAR_COLORS[2],
    rating: 5,
    verified: true,
    quote:
      "Cleaning a full-size SUV properly used to eat up half my Sunday at local wash stations. Their self-powered mobile van pulls right into my driveway with pure RO water and electricity. Steam cleaning removed all the monsoon grime effortlessly.",
  },
];

const TRUST_STATS = [
  { label: "Varanasi Rating", value: "4.9 / 5" },
  { label: "Active Vehicles", value: "450+" },
  { label: "RO Water Wash", value: "100% Zero-TDS" },
  { label: "On-time Morning Arrival", value: "98.4%" },
];

/**
 * Social proof & verified testimonials section.
 * Real vehicle owners from Varanasi neighborhoods validating trust, reliability, and swirl-free results.
 */
export function Testimonials() {
  return (
    <section
      id="testimonials"
      className="scroll-mt-20 bg-[color:var(--landing-surface-tint)]/30"
      data-testid="vehicle-testimonials"
    >
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto py-20 md:py-24`}
      >
        <SectionHead
          eyebrow="Owners & Reviews"
          title="Loved by 450+ Varanasi car owners."
          desc="Real feedback from residents in Sigra, Cantt, Lanka, and Ravindrapuri who stopped worrying about daily car cleaning."
        />

        {/* Aggregate Trust Metrics Strip */}
        <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {TRUST_STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center rounded-2xl border border-border/70 bg-white/80 p-4 text-center backdrop-blur-sm"
            >
              <span className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {stat.value}
              </span>
              <span className="mt-1 text-[11px] font-medium text-muted-foreground sm:text-xs">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* Testimonials 3-Column Grid */}
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <article
              key={t.id}
              className="cwp-lift flex flex-col justify-between rounded-3xl border border-border bg-white p-6 shadow-sm md:p-7"
            >
              <div>
                {/* Header: Avatar, Name, Verified Pill, Stars */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: t.avatarColor }}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-foreground sm:text-base">
                          {t.name}
                        </h3>
                        {t.verified && (
                          <span
                            title="Verified CWP Customer"
                            className="inline-flex items-center text-emerald-600"
                          >
                            <CheckCircle2 className="h-4 w-4" aria-hidden />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3 text-muted-foreground/70" />
                        <span>{t.area}, Varanasi</span>
                      </div>
                    </div>
                  </div>

                  {/* 5-Star Indicator */}
                  <div className="flex items-center gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
                    ))}
                  </div>
                </div>

                {/* Vehicle & Subscription Badges */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-foreground">
                    <Car className="h-3 w-3 text-muted-foreground" />
                    {t.vehicle}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {t.plan}
                  </span>
                </div>

                {/* Customer Quote */}
                <p className="mt-4 text-xs leading-relaxed text-foreground/80 sm:text-sm">
                  “{t.quote}”
                </p>
              </div>

              {/* Bottom Card Footer */}
              <div className="mt-6 border-t border-border/50 pt-3 text-[11px] text-muted-foreground">
                <span>Verified Doorstep Service Record · Varanasi</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}