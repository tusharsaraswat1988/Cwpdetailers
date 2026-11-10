/**
 * Customer Design System — consumer experience tokens.
 * Same CWP platform brand as Landing/Admin; density tuned for trust & simplicity.
 *
 * Rule: customer pages must not invent colors, radius, shadows, or spacing.
 * Use Customer* components + these tokens only. Prefer Platform shared primitives.
 */

/** Brand + semantic colors (aligned with Landing / Admin primary). */
export const CUSTOMER_COLORS = {
  primaryHex: "#1677FF",
  primaryHsl: "215 100% 54%",
  primaryForegroundHsl: "0 0% 100%",
  secondaryHex: "#0B1D36",
  secondaryHsl: "216 66% 13%",
  secondaryForegroundHsl: "0 0% 100%",
  foregroundHex: "#111827",
  foregroundHsl: "221 39% 11%",
  mutedForegroundHex: "#64748B",
  mutedForegroundHsl: "215 16% 47%",
  destructiveHex: "#DC2626",
  destructiveHsl: "0 72% 51%",
  successHex: "#16A34A",
  successHsl: "142 76% 36%",
  warningHex: "#D97706",
  warningHsl: "38 92% 44%",
  infoHex: "#1677FF",
  infoHsl: "215 100% 54%",
  progressHsl: "215 100% 54%",
} as const;

/** Surfaces — airy, trustworthy consumer chrome. */
export const CUSTOMER_SURFACE = {
  backgroundHex: "#F5F7FA",
  backgroundHsl: "216 33% 97%",
  cardHex: "#FFFFFF",
  cardHsl: "0 0% 100%",
  mutedHsl: "214 32% 95%",
  borderHex: "#E2E8F0",
  borderHsl: "214 32% 91%",
  surfaceTintHex: "#EBF3FF",
  surfaceTintHsl: "215 100% 96%",
  accentHsl: "215 100% 96%",
  accentForegroundHsl: "215 100% 40%",
  ringHsl: "215 100% 54%",
  heroGradient: "linear-gradient(135deg, #0B1D36 0%, #16325B 100%)",
  authBackgroundHsl: "216 66% 13%",
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

export const CUSTOMER_SHADOWS = {
  card: "0 2px 8px rgba(11, 29, 54, 0.04)",
  cardHover: "0 4px 14px rgba(11, 29, 54, 0.08)",
  navy: "0 8px 24px -4px rgba(11, 29, 54, 0.22), 0 2px 6px rgba(11, 29, 54, 0.12)",
  elevated: "0 4px 12px rgba(11, 29, 54, 0.05)",
} as const;

export const CUSTOMER_RADIUS = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
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
  "--brand-secondary": CUSTOMER_COLORS.secondaryHex,
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
  "--tone-info-fg": "215 100% 35%",
  "--tone-success": CUSTOMER_COLORS.successHsl,
  "--tone-success-fg": "142 76% 28%",
  "--tone-warning": CUSTOMER_COLORS.warningHsl,
  "--tone-warning-fg": "32 90% 32%",
  "--tone-destructive": CUSTOMER_COLORS.destructiveHsl,
  "--tone-destructive-fg": "0 72% 40%",
  "--tone-progress": CUSTOMER_COLORS.progressHsl,
  "--tone-progress-fg": "215 100% 35%",

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
  "--customer-icon-surface": "color-mix(in srgb, #1677FF 12%, white)",
  "--customer-navy": CUSTOMER_COLORS.secondaryHex,
  "--customer-radius": CUSTOMER_RADIUS.md,
  "--customer-radius-sm": CUSTOMER_RADIUS.sm,
  "--customer-radius-lg": CUSTOMER_RADIUS.lg,
  "--customer-radius-xl": CUSTOMER_RADIUS.xl,
  "--customer-space-page": CUSTOMER_SPACE_RAW.section,
  "--customer-space-stack": CUSTOMER_SPACE_RAW.stack,
  "--customer-control-h": CUSTOMER_SPACE_RAW.controlH,
  "--customer-tap-min": CUSTOMER_SPACE_RAW.tapMin,
  "--customer-focus-ring": CUSTOMER_SURFACE.ringHsl,
  "--customer-card-shadow": CUSTOMER_SHADOWS.card,
  "--customer-card-shadow-hover": CUSTOMER_SHADOWS.cardHover,
  "--customer-navy-shadow": CUSTOMER_SHADOWS.navy,
  "--customer-hero-shadow": "var(--shadow-md)",
  "--duration-fast": `${CUSTOMER_MOTION.fastMs}ms`,
  "--duration-base": `${CUSTOMER_MOTION.baseMs}ms`,
};
