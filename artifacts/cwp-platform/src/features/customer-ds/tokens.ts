/**
 * Customer Design System — consumer experience tokens.
 * Same CWP platform brand as Landing/Admin; density tuned for trust & simplicity.
 *
 * Rule: customer pages must not invent colors, radius, shadows, or spacing.
 * Use Customer* components + these tokens only. Prefer Platform shared primitives.
 */

/** Brand + semantic colors (aligned with Landing / Admin primary). */
export const CUSTOMER_COLORS = {
  primaryHex: "#0072f8",
  primaryHsl: "212 100% 49%",
  primaryForegroundHsl: "0 0% 100%",
  secondaryHsl: "220 18% 14%",
  secondaryForegroundHsl: "0 0% 100%",
  foregroundHsl: "220 40% 10%",
  mutedForegroundHsl: "215 12% 42%",
  destructiveHsl: "0 84% 60%",
  successHsl: "142 71% 40%",
  warningHsl: "38 92% 50%",
  infoHsl: "212 100% 49%",
  progressHsl: "262 60% 55%",
} as const;

/** Surfaces — airy, trustworthy consumer chrome. */
export const CUSTOMER_SURFACE = {
  backgroundHsl: "210 40% 98%",
  cardHsl: "0 0% 100%",
  mutedHsl: "214 24% 95%",
  borderHsl: "214 24% 90%",
  surfaceTintHex: "#eef8ff",
  surfaceTintHsl: "205 100% 97%",
  accentHsl: "205 100% 94%",
  accentForegroundHsl: "212 100% 40%",
  ringHsl: "212 100% 49%",
  heroGradient: "linear-gradient(145deg, hsl(212 100% 49% / 0.08) 0%, hsl(0 0% 100%) 55%)",
  authBackgroundHsl: "220 18% 14%",
} as const;

/** Status chip tones — reuse Platform --tone-* when ThemeRoot is mounted. */
export const CUSTOMER_STATUS = {
  completed: "success",
  cancelled: "destructive",
  inProgress: "progress",
  scheduled: "info",
  pending: "warning",
  enRoute: "warning",
  offline: "neutral",
  clear: "neutral",
} as const;

/** Progress / completion visual language. */
export const CUSTOMER_PROGRESS = {
  trackHsl: "214 24% 90%",
  fillHsl: CUSTOMER_COLORS.primaryHsl,
  successHsl: CUSTOMER_COLORS.successHsl,
  ringSizeSm: 48,
  ringSizeMd: 56,
  ringSizeLg: 72,
} as const;

/** Raw length tokens (CSS). More whitespace than Admin. */
export const CUSTOMER_SPACE_RAW = {
  pageX: "1rem",
  pageY: "1.25rem",
  section: "1.75rem",
  stack: "1rem",
  cardPad: "1.125rem",
  controlH: "3rem",
  controlHSm: "2.75rem",
  tapMin: "2.75rem",
  icon: "18px",
  iconLg: "22px",
  bottomActionPad: "1rem",
} as const;

/** Tailwind class spacing for CustomerPage / cards. */
export const CUSTOMER_SPACE = {
  page: "space-y-6",
  section: "space-y-4",
  stack: "space-y-3",
  cardPad: "p-4 sm:p-5",
  statePad: "px-6 py-16",
  tap: "min-h-11 min-w-11",
  gap: "gap-3",
} as const;

export const CUSTOMER_RADIUS = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.25rem",
  xl: "1.5rem",
  full: "9999px",
  /** CSS var defaults */
  root: "1rem",
} as const;

/** Charts — rare on customer; same palette family as platform. */
export const CUSTOMER_CHART = {
  colors: [
    `hsl(${CUSTOMER_COLORS.primaryHsl})`,
    "hsl(220 40% 60%)",
    `hsl(${CUSTOMER_COLORS.successHsl})`,
    `hsl(${CUSTOMER_COLORS.warningHsl})`,
    `hsl(${CUSTOMER_COLORS.progressHsl})`,
  ],
  grid: `hsl(${CUSTOMER_SURFACE.borderHsl})`,
  axis: `hsl(${CUSTOMER_COLORS.mutedForegroundHsl})`,
} as const;

export const CUSTOMER_MOTION = {
  fastMs: 160,
  baseMs: 220,
  enterMs: 400,
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  fadeUp: "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both",
  fadeIn: "animate-in fade-in duration-400 fill-mode-both",
  stagger:
    "[&>*]:animate-in [&>*]:fade-in [&>*]:slide-in-from-bottom-1 [&>*]:duration-[400ms] [&>*]:fill-mode-both",
} as const;

/** Full DS map (convenience). */
export const CUSTOMER_DS = {
  colors: CUSTOMER_COLORS,
  surface: CUSTOMER_SURFACE,
  status: CUSTOMER_STATUS,
  progress: CUSTOMER_PROGRESS,
  space: CUSTOMER_SPACE_RAW,
  radius: CUSTOMER_RADIUS,
  chart: CUSTOMER_CHART,
  motion: CUSTOMER_MOTION,
} as const;

/**
 * Inline style overrides while customer portal is mounted.
 * Aligns with Landing brand; restores BrandingProvider on leave.
 */
export const CUSTOMER_THEME_CSS_VARS: Record<string, string> = {
  "--brand-primary": CUSTOMER_COLORS.primaryHex,
  "--brand-accent": CUSTOMER_SURFACE.surfaceTintHex,
  "--brand-secondary": "#1e2430",
  "--primary": CUSTOMER_COLORS.primaryHsl,
  "--primary-foreground": CUSTOMER_COLORS.primaryForegroundHsl,
  "--ring": CUSTOMER_SURFACE.ringHsl,
  "--accent": CUSTOMER_SURFACE.accentHsl,
  "--accent-foreground": CUSTOMER_SURFACE.accentForegroundHsl,
  "--background": CUSTOMER_SURFACE.backgroundHsl,
  "--foreground": CUSTOMER_COLORS.foregroundHsl,
  "--card": CUSTOMER_SURFACE.cardHsl,
  "--border": CUSTOMER_SURFACE.borderHsl,
  "--input": CUSTOMER_SURFACE.borderHsl,
  "--muted": CUSTOMER_SURFACE.mutedHsl,
  "--muted-foreground": CUSTOMER_COLORS.mutedForegroundHsl,
  "--secondary": CUSTOMER_COLORS.secondaryHsl,
  "--secondary-foreground": CUSTOMER_COLORS.secondaryForegroundHsl,
  "--destructive": CUSTOMER_COLORS.destructiveHsl,
  "--radius": CUSTOMER_RADIUS.root,

  /* Semantic tones (StatusBadge, Timeline) */
  "--tone-info": CUSTOMER_COLORS.infoHsl,
  "--tone-info-fg": "212 100% 35%",
  "--tone-success": CUSTOMER_COLORS.successHsl,
  "--tone-success-fg": "142 72% 28%",
  "--tone-warning": CUSTOMER_COLORS.warningHsl,
  "--tone-warning-fg": "32 90% 32%",
  "--tone-destructive": CUSTOMER_COLORS.destructiveHsl,
  "--tone-destructive-fg": "0 72% 40%",
  "--tone-progress": CUSTOMER_COLORS.progressHsl,
  "--tone-progress-fg": "262 55% 38%",

  /* Status aliases */
  "--status-in-progress": CUSTOMER_COLORS.primaryHsl,
  "--status-scheduled": CUSTOMER_COLORS.primaryHsl,
  "--status-open": CUSTOMER_COLORS.primaryHsl,
  "--status-completed": CUSTOMER_COLORS.successHsl,
  "--status-cancelled": CUSTOMER_COLORS.destructiveHsl,
  "--status-pending": CUSTOMER_COLORS.warningHsl,

  /* Customer component tokens */
  "--customer-accent": CUSTOMER_COLORS.primaryHex,
  "--customer-surface-tint": CUSTOMER_SURFACE.surfaceTintHex,
  "--customer-icon-surface": "color-mix(in srgb, #0072f8 12%, white)",
  "--customer-radius": CUSTOMER_RADIUS.md,
  "--customer-radius-sm": CUSTOMER_RADIUS.sm,
  "--customer-radius-lg": CUSTOMER_RADIUS.lg,
  "--customer-radius-xl": CUSTOMER_RADIUS.xl,
  "--customer-space-page": CUSTOMER_SPACE_RAW.section,
  "--customer-space-stack": CUSTOMER_SPACE_RAW.stack,
  "--customer-control-h": CUSTOMER_SPACE_RAW.controlH,
  "--customer-tap-min": CUSTOMER_SPACE_RAW.tapMin,
  "--customer-focus-ring": CUSTOMER_SURFACE.ringHsl,
  "--customer-card-shadow": "var(--shadow-sm)",
  "--customer-hero-shadow": "var(--shadow-md)",
  "--duration-fast": `${CUSTOMER_MOTION.fastMs}ms`,
  "--duration-base": `${CUSTOMER_MOTION.baseMs}ms`,
};
