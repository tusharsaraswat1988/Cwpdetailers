/**
 * Shared landing design tokens (no magic numbers in components).
 * Scoped to marketing UI — does not replace global CWP theme tokens.
 */

export const LANDING_LAYOUT = {
  maxWidth: "max-w-7xl",
  padX: "px-5 md:px-8",
  heroPadY: "pt-14 pb-24 md:pt-20 md:pb-28",
  heroGap: "gap-12 lg:gap-16",
  heroGrid: "lg:grid-cols-[1.05fr_1fr]",
  navHeight: "h-16",
  sectionRadius: "rounded-[28px]",
  mediaRadius: "rounded-[32px]",
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
  heroMobile: "text-[44px]",
  heroDesktop: "md:text-[64px]",
  heroLeading: "leading-[1.05]",
  sub: "text-[17px]",
  eyebrow: "text-xs",
  selectorTitle: "text-2xl md:text-[26px]",
  selectorLabel: "text-[11px]",
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
    eyebrow: 0,
    headline: 60,
    subheading: 120,
    trust: 180,
    cta: 220,
    selector: 260,
    media: 100,
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
  heroAspect: "aspect-[4/5]",
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
  selector: "shadow-[0_20px_60px_-30px_rgba(15,23,42,0.15)]",
  optionActive: "shadow-[0_10px_30px_-15px_rgba(15,23,42,0.25)]",
} as const;
