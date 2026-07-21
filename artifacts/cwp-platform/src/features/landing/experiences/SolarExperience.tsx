import { lazy, Suspense } from "react";
import { Education } from "./solar/Education";
import { ExperienceCTA } from "./shared/ExperienceCTA";

const Proof = lazy(() => import("./solar/Proof").then((m) => ({ default: m.Proof })));
const Calculator = lazy(() =>
  import("./solar/Calculator").then((m) => ({ default: m.Calculator })),
);
const HowWeClean = lazy(() =>
  import("./solar/HowWeClean").then((m) => ({ default: m.HowWeClean })),
);
const Packages = lazy(() =>
  import("./solar/Packages").then((m) => ({ default: m.Packages })),
);
const Gallery = lazy(() =>
  import("./solar/Gallery").then((m) => ({ default: m.Gallery })),
);
const Testimonials = lazy(() =>
  import("./solar/Testimonials").then((m) => ({ default: m.Testimonials })),
);
const FAQ = lazy(() => import("./solar/FAQ").then((m) => ({ default: m.FAQ })));

function SectionFallback() {
  return <div className="min-h-[10rem] bg-background" aria-hidden />;
}

/**
 * Refined solar journey:
 * Science → Inverter proof → Signature calculator → Method → Packages → Visuals → Peers → FAQ → CTA
 */
export function SolarExperience() {
  return (
    <div data-testid="solar-experience">
      <Education />
      <Suspense fallback={<SectionFallback />}>
        <Proof />
        <Calculator />
        <HowWeClean />
        <Packages />
        <Gallery />
        <Testimonials />
        <FAQ />
      </Suspense>
      <ExperienceCTA />
    </div>
  );
}
