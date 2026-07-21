export type { Division } from "./types";
export { DIVISION_STORAGE_KEY } from "./types";
export { landingImages } from "./assets";

export {
  LANDING_LAYOUT,
  LANDING_SPACE,
  LANDING_TYPE,
  LANDING_MOTION,
  LANDING_OPACITY,
  LANDING_Z,
  LANDING_MEDIA,
  DIVISION_COLORS,
} from "./constants";

export {
  trackLandingEvent,
  onLandingEvent,
  type LandingAnalyticsEvent,
  type LandingEventPayload,
} from "./analytics";

export type {
  HeroContentBundle,
  HeroJourneyContent,
  HeroCta,
  HeroHeadline,
  HeroMediaSource,
  HeroSelectorContent,
  HeroStat,
  HeroTrustPill,
  HeroSocialProof,
} from "./content/heroTypes";
export { defaultHeroContent } from "./content/defaultHeroContent";
export type {
  ExperienceLoadState,
  ExperienceSectionState,
  LandingExperienceContract,
  VehicleExperienceContract,
  SolarExperienceContract,
  MorningStoryView,
  HowItWorksView,
  PackagesView,
  PlanCardView,
  GalleryView,
  TestimonialsView,
  FaqView,
  ExperienceCtaView,
  EducationView,
  ProofView,
  CalculatorConfigView,
  CalculatorResultView,
  HowWeCleanView,
  ContactView,
  MarketingFooterView,
  MarketingNavView,
  AppCalloutView,
} from "./content/experienceContract";

export {
  ExperienceProvider,
  useExperience,
  type ExperienceProviderProps,
  type ExperiencePersonalization,
  type ExperienceContextValue,
} from "./ExperienceProvider";

export { getDivisionThemeStyle, useDivisionTheme } from "./hooks/useDivision";

export { useInView } from "./lib/useInView";
export { useParallax } from "./lib/useParallax";
export { Reveal } from "./lib/Reveal";
export { CountUp } from "./lib/CountUp";
export { useHeroEnterReady } from "./lib/useHeroEnterReady";

export { SectionHead } from "./components/SectionHead";
export { LandingShell } from "./components/LandingShell";
export { MarketingNav } from "./components/MarketingNav";
export type { MarketingNavProps, MarketingNavLink } from "./components/MarketingNav";

export {
  Hero,
  HeroVehicle,
  HeroSolar,
  HeroContent,
  HeroMedia,
  HeroCTA,
  HeroSelector,
  HeroTrustBar,
  HeroStats,
} from "./components/Hero";
export type {
  HeroProps,
  HeroVehicleProps,
  HeroSolarProps,
  HeroContentProps,
  HeroMediaProps,
  HeroCTAProps,
  HeroSelectorProps,
  HeroTrustBarProps,
  HeroStatsProps,
} from "./components/Hero";

export { VehicleExperience } from "./experiences/VehicleExperience";
export { SolarExperience } from "./experiences/SolarExperience";
