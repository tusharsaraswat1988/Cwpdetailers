/**
 * Experience Contract — frozen presentation shapes for the marketing homepage.
 *
 * Rules:
 * - Section components accept ONLY these view-models (or static defaults that match them).
 * - API / CMS responses MUST be mapped by adapters → these types.
 * - Adapters never leak raw API DTOs into experience components.
 * - Loading / empty / error / skeleton are UI states around the same props shape.
 *
 * See EXPERIENCE_CONTRACT.md for ownership, states, and adapter notes.
 */

import type { Division } from "../types";
import type { HeroContentBundle, HeroMediaSource } from "./heroTypes";

/** Shared async UI envelope — does not alter section props structure. */
export type ExperienceLoadState = "idle" | "loading" | "success" | "empty" | "error";

export type ExperienceSectionState<T> = {
  status: ExperienceLoadState;
  data: T | null;
  errorMessage?: string;
};

export type SectionCopy = {
  eyebrow: string;
  title: string;
  desc?: string;
};

export type AppCalloutView = {
  message: string;
  href?: string;
  ctaLabel?: string;
};

export type MediaAssetView = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
};

export type ProcessStepView = {
  id: string;
  n: string;
  title: string;
  body: string;
  media: MediaAssetView;
};

export type PlanCardView = {
  id: string;
  tag: string;
  title: string;
  /** Pre-formatted display, e.g. "₹1,999" or "Custom" */
  priceFrom: string;
  period: string;
  body: string;
  highlight?: boolean;
  /** Optional deep-link into app booking */
  href?: string;
};

export type TestimonialView = {
  id: string;
  name: string;
  area: string;
  quote: string;
  rating?: number;
  avatarUrl?: string;
};

export type FaqItemView = {
  id: string;
  question: string;
  answer: string;
};

export type TimelineStepView = {
  id: string;
  time: string;
  title: string;
  body: string;
  icon: "mapPin" | "clock" | "camera" | "sparkles";
};

export type MorningStoryView = {
  copy: SectionCopy & { signatureLabel: string };
  benefits: string[];
  timeline: TimelineStepView[];
  effortLabel: string;
  effortValue: string;
  appCallout: AppCalloutView;
};

export type HowItWorksView = {
  copy: SectionCopy;
  steps: ProcessStepView[];
  appCallout: AppCalloutView;
};

export type PackagesView = {
  copy: SectionCopy;
  plans: PlanCardView[];
  appCallout?: AppCalloutView;
  secondaryCta?: { label: string; href: string };
};

export type GalleryView = {
  copy: SectionCopy;
  beforeAfter: MediaAssetView;
  tiles: Array<MediaAssetView & { tag: string }>;
};

export type TestimonialsView = {
  copy: SectionCopy;
  items: TestimonialView[];
};

export type FaqView = {
  copy: SectionCopy;
  items: FaqItemView[];
};

export type ExperienceCtaView = {
  eyebrow: string;
  headline: string;
  sub: string;
  primary: { id: string; label: string; href: string };
  secondary: { id: string; label: string; href: string };
  whatsappEnabled?: boolean;
};

export type EducationBarView = {
  id: string;
  label: string;
  pct: number;
  /** CSS color token or oklch string */
  tone: string;
};

export type EducationView = {
  copy: SectionCopy;
  points: string[];
  bars: EducationBarView[];
};

export type ProofChartDayView = {
  day: string;
  expectedKwh: number;
  actualKwh: number;
};

export type ProofView = {
  copy: SectionCopy;
  bullets: string[];
  chart: {
    caption: string;
    badge: string;
    days: ProofChartDayView[];
  };
  totals: {
    expectedLabel: string;
    expectedValue: string;
    actualLabel: string;
    actualValue: string;
    gapLabel: string;
    gapValue: string;
  };
};

export type CalculatorCityView = {
  key: string;
  label: string;
  /** ₹/kWh — may later come from config API */
  tariff: number;
  sunHours: number;
  dustIndex: number;
};

export type CalculatorConfigView = {
  copy: SectionCopy;
  cities: CalculatorCityView[];
  defaultCityKey: string;
  defaultKw: number;
  kwMin: number;
  kwMax: number;
  /** When true, results panel shows progressive reveal */
  requireInteraction: boolean;
};

export type CalculatorResultView = {
  dustGramsPerM2: number;
  efficiencyLossPct: number;
  recoverableMonthlyKWh: number;
  annualBenefit: number;
  recommendedDays: number;
  cityLabel: string;
  windowLabel: string;
  installLabel: string;
};

export type HowWeCleanView = {
  copy: SectionCopy;
  steps: ProcessStepView[];
  appCallout: AppCalloutView;
};

export type ContactView = {
  eyebrow: string;
  title: string;
  subtitle: string;
  phoneDisplay: string;
  phoneTel: string;
  addressLine: string;
};

export type FooterLinkView = {
  href: string;
  label: string;
};

export type MarketingFooterView = {
  blurb: string;
  explore: FooterLinkView[];
  legal: FooterLinkView[];
};

export type NavLinkView = {
  id: string;
  label: string;
  href: string;
};

export type MarketingNavView = {
  links: NavLinkView[];
};

/** Full frozen contract for one division experience + shared chrome. */
export type VehicleExperienceContract = {
  division: "vehicle";
  morningStory: MorningStoryView;
  howItWorks: HowItWorksView;
  packages: PackagesView;
  gallery: GalleryView;
  testimonials: TestimonialsView;
  faq: FaqView;
  cta: ExperienceCtaView;
};

export type SolarExperienceContract = {
  division: "solar";
  education: EducationView;
  proof: ProofView;
  calculator: CalculatorConfigView;
  howWeClean: HowWeCleanView;
  packages: PackagesView;
  gallery: GalleryView;
  testimonials: TestimonialsView;
  faq: FaqView;
  cta: ExperienceCtaView;
};

export type LandingExperienceContract = {
  hero: HeroContentBundle;
  nav: MarketingNavView;
  contact: ContactView;
  footer: MarketingFooterView;
  vehicle: VehicleExperienceContract;
  solar: SolarExperienceContract;
};

/** Adapter boundary marker — raw API types must not cross this. */
export type ExperienceAdapterResult<T> = ExperienceSectionState<T>;

export type { Division, HeroContentBundle, HeroMediaSource };
