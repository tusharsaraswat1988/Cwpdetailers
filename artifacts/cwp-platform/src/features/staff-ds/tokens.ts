/**
 * Staff Design System — field workforce experience tokens.
 * Same CWP platform brand as Landing / Admin / Customer; density tuned for
 * outdoor readability, one-handed mobile use, and fast task completion.
 *
 * Rule: staff pages must not invent colors, radius, shadows, or spacing.
 * Use Staff* components + these tokens only. Prefer Platform shared primitives.
 */

/** Brand + semantic colors (aligned with Landing / Admin / Customer primary). */
export const STAFF_COLORS = {
  primaryHex: "#0072f8",
  primaryHsl: "212 100% 49%",
  primaryForegroundHsl: "0 0% 100%",
  secondaryHsl: "220 18% 14%",
  secondaryForegroundHsl: "0 0% 100%",
  foregroundHsl: "220 40% 8%",
  mutedForegroundHsl: "215 14% 36%",
  destructiveHsl: "0 84% 55%",
  successHsl: "142 72% 36%",
  warningHsl: "38 95% 44%",
  infoHsl: "212 100% 49%",
  progressHsl: "262 60% 52%",
} as const;

/**
 * Surfaces — high-contrast field chrome.
 * Slightly cooler / brighter than customer for outdoor glare.
 */
export const STAFF_SURFACE = {
  backgroundHsl: "210 36% 97%",
  cardHsl: "0 0% 100%",
  mutedHsl: "214 22% 93%",
  borderHsl: "214 20% 86%",
  surfaceTintHex: "#e8f4ff",
  surfaceTintHsl: "205 100% 96%",
  accentHsl: "205 100% 92%",
  accentForegroundHsl: "212 100% 36%",
  ringHsl: "212 100% 49%",
  heroGradient:
    "linear-gradient(160deg, hsl(212 100% 49% / 0.12) 0%, hsl(0 0% 100%) 52%)",
  authBackgroundHsl: "220 18% 12%",
  actionWellHsl: "212 100% 49% / 0.08",
} as const;

/**
 * Job execution status → Platform tone keys.
 * Canonical field flow: Assigned → Accepted → Travelling → Arrived →
 * Checked In → In Progress → Paused → Completed → Verified | Cancelled
 */
export const STAFF_STATUS = {
  assigned: "info",
  accepted: "success",
  travelling: "warning",
  en_route: "warning",
  arrived: "info",
  checked_in: "info",
  in_progress: "progress",
  paused: "warning",
  completed: "success",
  verified: "success",
  cancelled: "destructive",
  offline: "neutral",
  sync_pending: "warning",
  uploading: "progress",
  upload_failed: "destructive",
} as const;

/** Progress / completion visual language for checklists & photo slots. */
export const STAFF_PROGRESS = {
  trackHsl: "214 22% 88%",
  fillHsl: STAFF_COLORS.primaryHsl,
  successHsl: STAFF_COLORS.successHsl,
  ringSizeSm: 44,
  ringSizeMd: 56,
  ringSizeLg: 72,
} as const;

/** Raw length tokens (CSS) — oversized for gloves / outdoor tap. */
export const STAFF_SPACE_RAW = {
  pageX: "1rem",
  pageY: "1rem",
  section: "1.5rem",
  stack: "0.875rem",
  cardPad: "1rem",
  controlH: "3.25rem",
  controlHSm: "2.875rem",
  tapMin: "3rem",
  icon: "20px",
  iconLg: "24px",
  bottomActionPad: "1rem",
  actionGap: "0.625rem",
} as const;

/** Tailwind class spacing for StaffPage / cards. */
export const STAFF_SPACE = {
  page: "space-y-4",
  section: "space-y-3",
  stack: "space-y-2.5",
  cardPad: "p-4",
  statePad: "px-5 py-14",
  tap: "min-h-12 min-w-12",
  gap: "gap-2.5",
} as const;

export const STAFF_RADIUS = {
  sm: "0.75rem",
  md: "1rem",
  lg: "1.125rem",
  xl: "1.375rem",
  full: "9999px",
  root: "1rem",
} as const;

export const STAFF_MOTION = {
  fastMs: 140,
  baseMs: 200,
  enterMs: 320,
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  fadeUp: "animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both",
  fadeIn: "animate-in fade-in duration-300 fill-mode-both",
  stagger:
    "[&>*]:animate-in [&>*]:fade-in [&>*]:slide-in-from-bottom-1 [&>*]:duration-[280ms] [&>*]:fill-mode-both",
} as const;

/** Full DS map (convenience). */
export const STAFF_DS = {
  colors: STAFF_COLORS,
  surface: STAFF_SURFACE,
  status: STAFF_STATUS,
  progress: STAFF_PROGRESS,
  space: STAFF_SPACE_RAW,
  radius: STAFF_RADIUS,
  motion: STAFF_MOTION,
} as const;

/**
 * Inline style overrides while staff portal is mounted.
 * Aligns with Landing brand; restores BrandingProvider on leave.
 */
export const STAFF_THEME_CSS_VARS: Record<string, string> = {
  "--brand-primary": STAFF_COLORS.primaryHex,
  "--brand-accent": STAFF_SURFACE.surfaceTintHex,
  "--brand-secondary": "#1a2030",
  "--primary": STAFF_COLORS.primaryHsl,
  "--primary-foreground": STAFF_COLORS.primaryForegroundHsl,
  "--ring": STAFF_SURFACE.ringHsl,
  "--accent": STAFF_SURFACE.accentHsl,
  "--accent-foreground": STAFF_SURFACE.accentForegroundHsl,
  "--background": STAFF_SURFACE.backgroundHsl,
  "--foreground": STAFF_COLORS.foregroundHsl,
  "--card": STAFF_SURFACE.cardHsl,
  "--border": STAFF_SURFACE.borderHsl,
  "--input": STAFF_SURFACE.borderHsl,
  "--muted": STAFF_SURFACE.mutedHsl,
  "--muted-foreground": STAFF_COLORS.mutedForegroundHsl,
  "--secondary": STAFF_COLORS.secondaryHsl,
  "--secondary-foreground": STAFF_COLORS.secondaryForegroundHsl,
  "--destructive": STAFF_COLORS.destructiveHsl,
  "--radius": STAFF_RADIUS.root,

  /* Semantic tones (StatusBadge, Timeline) */
  "--tone-info": STAFF_COLORS.infoHsl,
  "--tone-info-fg": "212 100% 32%",
  "--tone-success": STAFF_COLORS.successHsl,
  "--tone-success-fg": "142 72% 24%",
  "--tone-warning": STAFF_COLORS.warningHsl,
  "--tone-warning-fg": "32 92% 28%",
  "--tone-destructive": STAFF_COLORS.destructiveHsl,
  "--tone-destructive-fg": "0 72% 36%",
  "--tone-progress": STAFF_COLORS.progressHsl,
  "--tone-progress-fg": "262 55% 34%",

  /* Status aliases */
  "--status-in-progress": STAFF_COLORS.primaryHsl,
  "--status-scheduled": STAFF_COLORS.primaryHsl,
  "--status-open": STAFF_COLORS.primaryHsl,
  "--status-completed": STAFF_COLORS.successHsl,
  "--status-cancelled": STAFF_COLORS.destructiveHsl,
  "--status-pending": STAFF_COLORS.warningHsl,

  /* Staff component tokens */
  "--staff-accent": STAFF_COLORS.primaryHex,
  "--staff-surface-tint": STAFF_SURFACE.surfaceTintHex,
  "--staff-icon-surface": "color-mix(in srgb, #0072f8 14%, white)",
  "--staff-radius": STAFF_RADIUS.md,
  "--staff-radius-sm": STAFF_RADIUS.sm,
  "--staff-radius-lg": STAFF_RADIUS.lg,
  "--staff-radius-xl": STAFF_RADIUS.xl,
  "--staff-space-page": STAFF_SPACE_RAW.section,
  "--staff-space-stack": STAFF_SPACE_RAW.stack,
  "--staff-control-h": STAFF_SPACE_RAW.controlH,
  "--staff-tap-min": STAFF_SPACE_RAW.tapMin,
  "--staff-focus-ring": STAFF_SURFACE.ringHsl,
  "--staff-card-shadow": "var(--shadow-sm)",
  "--staff-hero-shadow": "var(--shadow-md)",
  "--staff-action-gap": STAFF_SPACE_RAW.actionGap,
  "--duration-fast": `${STAFF_MOTION.fastMs}ms`,
  "--duration-base": `${STAFF_MOTION.baseMs}ms`,
};
