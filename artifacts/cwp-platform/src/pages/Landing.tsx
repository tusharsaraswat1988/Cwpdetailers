import { lazy, Suspense, type ReactNode } from "react";
import { usePageSeo } from "@/lib/branding";
import {
  ExperienceProvider,
  LandingShell,
  MarketingNav,
  Hero,
  useExperience,
} from "@/features/landing";
import { Contact } from "@/features/landing/experiences/shared/Contact";
import { MarketingFooter } from "@/features/landing/experiences/shared/MarketingFooter";

const VehicleExperience = lazy(() =>
  import("@/features/landing/experiences/VehicleExperience").then((m) => ({
    default: m.VehicleExperience,
  })),
);
const SolarExperience = lazy(() =>
  import("@/features/landing/experiences/SolarExperience").then((m) => ({
    default: m.SolarExperience,
  })),
);

function ThemedFrame({ children }: { children: ReactNode }) {
  const { themeStyle } = useExperience();
  return <div style={themeStyle}>{children}</div>;
}

function ExperienceSwitch() {
  const { division } = useExperience();

  return (
    <div key={division} className="cwp-swap" data-testid="experience-switch">
      <Suspense fallback={<div className="min-h-[40vh] bg-background" aria-hidden />}>
        {division === "vehicle" ? <VehicleExperience /> : <SolarExperience />}
      </Suspense>
    </div>
  );
}

/**
 * Marketing homepage orchestrator — refined journey, no hybrid legacy sections.
 * App story is woven inside experiences; Stats strip removed to cut trust repetition.
 */
export default function Landing() {
  usePageSeo({
    title: "Smart Asset Care for Vehicles & Solar, Varanasi",
    description:
      "Doorstep vehicle detailing and solar panel cleaning in Varanasi. Background-verified technicians, RO water, live photo updates and reports after every service.",
  });

  return (
    <LandingShell>
      <ExperienceProvider>
        <ThemedFrame>
          <MarketingNav />
          <Hero />
          <ExperienceSwitch />
          <Contact />
          <MarketingFooter />
        </ThemedFrame>
      </ExperienceProvider>
    </LandingShell>
  );
}
