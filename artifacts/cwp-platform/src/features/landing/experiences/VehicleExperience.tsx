import { lazy, Suspense } from "react";
import { MorningStory } from "./vehicle/MorningStory";
import { HowItWorks } from "./vehicle/HowItWorks";
import { ExperienceCTA } from "./shared/ExperienceCTA";

const Packages = lazy(() =>
  import("./vehicle/Packages").then((m) => ({ default: m.Packages })),
);
const Gallery = lazy(() =>
  import("./vehicle/Gallery").then((m) => ({ default: m.Gallery })),
);
const Testimonials = lazy(() =>
  import("./vehicle/Testimonials").then((m) => ({ default: m.Testimonials })),
);
const FAQ = lazy(() => import("./vehicle/FAQ").then((m) => ({ default: m.FAQ })));

function SectionFallback() {
  return <div className="min-h-[10rem] bg-background" aria-hidden />;
}

/**
 * Refined vehicle journey:
 * Emotion (signature) → How it works → Plans → Visual proof → Peers → Objections → CTA
 */
export function VehicleExperience() {
  return (
    <div data-testid="vehicle-experience">
      <MorningStory />
      <HowItWorks />
      <Suspense fallback={<SectionFallback />}>
        <Packages />
        <Gallery />
        <Testimonials />
        <FAQ />
      </Suspense>
      <ExperienceCTA />
    </div>
  );
}
