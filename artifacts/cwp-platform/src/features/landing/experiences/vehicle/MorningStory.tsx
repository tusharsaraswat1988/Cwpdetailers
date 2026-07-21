import { Camera, CheckCircle2, Clock, MapPin, Sparkles } from "lucide-react";
import { LANDING_LAYOUT } from "../../constants";
import { AppCallout } from "../shared/AppCallout";

const BENEFITS = [
  "No daily effort",
  "No remembering",
  "No missed days",
  "No local-cleaner drama",
  "Professional consistency",
  "More time for yourself",
] as const;

const TIMELINE = [
  {
    time: "6:42",
    title: "Technician dispatched from Sigra hub",
    body: "Live ETA on your phone — no calls, no waiting at the gate.",
    icon: MapPin,
  },
  {
    time: "6:58",
    title: "Arrived silently",
    body: "Uniformed, ID-badged, kit ready. Household undisturbed.",
    icon: Clock,
  },
  {
    time: "7:12",
    title: "Car cleaned. Photos taken.",
    body: "Before + after land in your app with a signed checklist.",
    icon: Camera,
  },
  {
    time: "8:30",
    title: "You open the front door.",
    body: "Clean car waiting. Unlock, sit down, drive.",
    icon: Sparkles,
  },
] as const;

/**
 * SIGNATURE MOMENT (Vehicle): “0 minutes of owner effort.”
 * Unique question: “What does this feel like in my morning?”
 */
export function MorningStory() {
  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, oklch(0.97 0.02 255) 0%, oklch(0.995 0.002 250) 100%)",
      }}
      data-testid="vehicle-morning-story"
      aria-label="Signature moment: a CWP morning"
    >
      <div
        className={`${LANDING_LAYOUT.maxWidth} ${LANDING_LAYOUT.padX} mx-auto pt-16 pb-14 md:pt-24 md:pb-20`}
      >
        <div className="grid gap-12 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--landing-accent)]">
              Signature · The CWP morning
            </div>
            <h2 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-[1.08] tracking-tight md:text-[46px]">
              Every morning feels better
              <br className="hidden md:block" />
              <span className="text-muted-foreground"> when your car is </span>
              <span className="text-[color:var(--landing-accent)]">already clean</span>.
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
              You don&apos;t want another chore. You want to step out and drive. This is the
              feeling we sell — then we show you how the system delivers it.
            </p>
            <ul className="mt-6 grid gap-3 text-[14px] sm:grid-cols-2">
              {BENEFITS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-foreground/80">
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-[color:var(--landing-accent)]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <AppCallout
              className="mt-6"
              message="ETAs and photo reports arrive in the CWP app while you’re still having chai."
              ctaLabel="Get the app experience"
            />
          </div>

          <div
            className={`${LANDING_LAYOUT.sectionRadius} border border-border bg-white p-6 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.35)] md:p-8`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  A typical CWP morning
                </div>
                <div className="mt-1 font-display text-lg font-semibold">
                  Tuesday · Bhelupur · 7:12 am
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-[color:var(--landing-surface-tint)] px-3 py-1 text-[11px] font-semibold text-[color:var(--landing-accent)]">
                Weekly plan
              </span>
            </div>

            <ol className="mt-6 space-y-5">
              {TIMELINE.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.time} className="relative flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-white"
                        style={{ background: "var(--landing-accent)" }}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      {i < TIMELINE.length - 1 ? (
                        <div className="mt-1 w-px flex-1 bg-border" aria-hidden />
                      ) : null}
                    </div>
                    <div className="pb-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-sm font-semibold tabular-nums">
                          {step.time}
                          <span className="text-muted-foreground"> am</span>
                        </span>
                        <span className="text-[13px] font-medium">{step.title}</span>
                      </div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex items-center justify-between rounded-2xl bg-[color:var(--landing-surface-tint)] px-4 py-3 text-[12.5px]">
              <span className="text-foreground/80">Total owner effort today</span>
              <span className="font-display text-base font-semibold text-[color:var(--landing-accent)]">
                0 minutes
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
