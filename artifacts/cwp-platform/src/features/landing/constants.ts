/**
 * Shared landing design tokens (no magic numbers in components).
 * Scoped to marketing UI — does not replace global CWP theme tokens.
 */

export const LANDING_LAYOUT = {
  maxWidth: "max-w-7xl",
  padX: "px-5 md:px-8",
  heroPadY: "pt-4 pb-8 md:pt-5 md:pb-12 lg:pt-6 lg:pb-14",
  /** Space between the in-hero switcher and the journey composition */
  heroAfterSelector: "mt-2.5 md:mt-3",
  heroGap: "gap-6 lg:gap-10",
  heroGrid: "lg:grid-cols-[1.05fr_0.95fr] lg:items-start",
  navHeight: "h-16",
  sectionRadius: "rounded-[28px]",
  mediaRadius: "rounded-[28px]",
  cardRadius: "rounded-2xl",
  pillRadius: "rounded-full",
} as const;

export const LANDING_SPACE = {
  xs: "0.375rem",
  sm: "0.625rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "1.75rem",
  "2xl": "2.5rem",
} as const;

export const LANDING_TYPE = {
  heroMobile: "text-[34px] sm:text-[40px]",
  heroDesktop: "md:text-[48px] lg:text-[56px] xl:text-[64px]",
  heroLeading: "leading-[1.08]",
  sub: "text-[16px] md:text-[17px]",
  eyebrow: "text-xs",
  selectorTitle: "text-[14px] sm:text-[15px] md:text-base",
  selectorLabel: "text-[10px] sm:text-[11px]",
  trust: "text-xs",
  statValue: "text-3xl",
  chip: "text-xs",
} as const;

export const LANDING_MOTION = {
  /** Hero enter (headline, sub, CTA, media, selector, trust) */
  enterDurationMs: 560,
  enterEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  enterDistancePx: 14,
  staggerMs: {
    selector: 0,
    eyebrow: 80,
    headline: 140,
    subheading: 200,
    trust: 260,
    cta: 300,
    media: 180,
    credibility: 340,
  },
  selectorTransitionMs: 220,
  mediaFadeMs: 500,
  kenburnsDurationS: 18,
  parallaxStrength: 0.06,
  parallaxFollowMs: 120,
  reducedMotion: "(prefers-reduced-motion: reduce)",
} as const;

export const LANDING_OPACITY = {
  muted: 0.6,
  overlayBottom: 0.25,
  chipBg: 0.95,
  selectionRing: 0.08,
} as const;

export const LANDING_Z = {
  nav: 50,
  heroOverlay: 10,
} as const;

export const LANDING_MEDIA = {
  heroAspect: "aspect-[5/4] lg:aspect-[5/4] xl:aspect-[4/5]",
  heroWidth: 1600,
  heroHeight: 1200,
} as const;

export const DIVISION_COLORS = {
  vehicle: {
    accent: "oklch(0.58 0.22 258)",
    ring: "oklch(0.58 0.22 258)",
    surfaceTint: "oklch(0.975 0.018 250)",
    tintClass: "from-[oklch(0.96_0.02_255)] via-transparent to-transparent",
  },
  solar: {
    accent: "oklch(0.68 0.18 62)",
    ring: "oklch(0.68 0.18 62)",
    surfaceTint: "oklch(0.982 0.022 78)",
    tintClass: "from-[oklch(0.97_0.03_75)] via-transparent to-transparent",
  },
} as const;

export const SOCIAL_AVATAR_COLORS = [
  "oklch(0.62 0.19 255)",
  "oklch(0.7 0.18 65)",
  "oklch(0.55 0.2 25)",
  "oklch(0.6 0.15 170)",
  "oklch(0.5 0.18 300)",
] as const;

export const HERO_SHADOW = {
  media: "shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)]",
  selector: "shadow-[0_12px_40px_-28px_rgba(15,23,42,0.12)]",
  optionActive: "shadow-none",
} as const;
