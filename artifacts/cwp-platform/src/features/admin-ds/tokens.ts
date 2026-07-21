/**
 * Admin Design System — full token map.
 * Aligned with Landing accent; density tuned for enterprise dashboards.
 *
 * Rule: pages must not invent colors, radius, shadows, or spacing.
 * Use Admin* components + these tokens only.
 */

export const ADMIN_DS = {
  primaryHex: "#0072f8",
  primaryHsl: "212 100% 49%",
  primaryForegroundHsl: "0 0% 100%",
  surfaceTintHex: "#eef8ff",
  surfaceTintHsl: "205 100% 97%",
  accentHsl: "205 100% 94%",
  accentForegroundHsl: "212 100% 40%",
  ringHsl: "212 100% 49%",
  backgroundHsl: "220 33% 97%",
  cardHsl: "0 0% 100%",
  borderHsl: "214 24% 90%",
  mutedHsl: "214 24% 93%",
  mutedForegroundHsl: "215 12% 42%",
  secondaryHsl: "220 18% 14%",
  secondaryForegroundHsl: "0 0% 100%",
  destructiveHsl: "0 84% 60%",
  successHsl: "142 71% 40%",
  successForegroundHsl: "142 72% 28%",
  warningHsl: "38 92% 50%",
  warningForegroundHsl: "32 90% 32%",
  infoHsl: "212 100% 49%",
  infoForegroundHsl: "212 100% 35%",
  progressHsl: "262 60% 55%",
  progressForegroundHsl: "262 55% 38%",
  radius: "0.75rem",
  radiusSm: "0.5rem",
  radiusLg: "1rem",
  motionFastMs: 120,
  motionBaseMs: 180,
  /** Dense page rhythm */
  space: {
    pageX: "1rem",
    pageXMd: "1.5rem",
    pageY: "1rem",
    section: "1.5rem",
    stack: "0.75rem",
    controlH: "2.25rem",
    controlHSm: "2rem",
    icon: "15px",
    iconSm: "14px",
  },
} as const;

/** Recharts / chart palette — always import from here, never hardcode. */
export const ADMIN_CHART_COLORS = [
  `hsl(${ADMIN_DS.primaryHsl})`,
  "hsl(220 40% 60%)",
  "hsl(40 100% 50%)",
  `hsl(${ADMIN_DS.destructiveHsl})`,
  `hsl(${ADMIN_DS.progressHsl})`,
  `hsl(${ADMIN_DS.successHsl})`,
] as const;

export const ADMIN_CHART = {
  colors: ADMIN_CHART_COLORS,
  primary: ADMIN_CHART_COLORS[0],
  grid: "hsl(214 24% 90%)",
  axis: "hsl(215 12% 42%)",
  tooltipBg: "hsl(0 0% 100%)",
  tooltipBorder: "hsl(214 24% 90%)",
  barRadius: [4, 4, 0, 0] as [number, number, number, number],
} as const;

/** Spacing class tokens for AdminSection / AdminPage density. */
export const ADMIN_SPACE = {
  page: "space-y-6",
  section: "space-y-3",
  stack: "space-y-2",
  toolbar: "gap-3",
  cardPad: "p-4 sm:p-5",
  statePad: "px-6 py-14",
} as const;

/** Inline style overrides while admin is mounted (beats BrandingProvider). */
export const ADMIN_THEME_CSS_VARS: Record<string, string> = {
  "--brand-primary": ADMIN_DS.primaryHex,
  "--brand-accent": ADMIN_DS.surfaceTintHex,
  "--brand-secondary": "#1e2430",
  "--primary": ADMIN_DS.primaryHsl,
  "--primary-foreground": ADMIN_DS.primaryForegroundHsl,
  "--ring": ADMIN_DS.ringHsl,
  "--accent": ADMIN_DS.accentHsl,
  "--accent-foreground": ADMIN_DS.accentForegroundHsl,
  "--background": ADMIN_DS.backgroundHsl,
  "--foreground": "220 40% 10%",
  "--card": ADMIN_DS.cardHsl,
  "--border": ADMIN_DS.borderHsl,
  "--input": ADMIN_DS.borderHsl,
  "--muted": ADMIN_DS.mutedHsl,
  "--muted-foreground": ADMIN_DS.mutedForegroundHsl,
  "--secondary": ADMIN_DS.secondaryHsl,
  "--secondary-foreground": ADMIN_DS.secondaryForegroundHsl,
  "--destructive": ADMIN_DS.destructiveHsl,
  "--radius": ADMIN_DS.radius,

  /* Semantic tones (StatusBadge, StatCard, Timeline) */
  "--tone-info": ADMIN_DS.infoHsl,
  "--tone-info-fg": ADMIN_DS.infoForegroundHsl,
  "--tone-success": ADMIN_DS.successHsl,
  "--tone-success-fg": ADMIN_DS.successForegroundHsl,
  "--tone-warning": ADMIN_DS.warningHsl,
  "--tone-warning-fg": ADMIN_DS.warningForegroundHsl,
  "--tone-destructive": ADMIN_DS.destructiveHsl,
  "--tone-destructive-fg": "0 72% 40%",
  "--tone-progress": ADMIN_DS.progressHsl,
  "--tone-progress-fg": ADMIN_DS.progressForegroundHsl,

  /* Status aliases */
  "--status-in-progress": ADMIN_DS.primaryHsl,
  "--status-scheduled": ADMIN_DS.primaryHsl,
  "--status-open": ADMIN_DS.primaryHsl,
  "--status-completed": ADMIN_DS.successHsl,
  "--status-cancelled": ADMIN_DS.destructiveHsl,
  "--status-pending": ADMIN_DS.warningHsl,

  /* Component tokens */
  "--admin-accent": ADMIN_DS.primaryHex,
  "--admin-surface-tint": ADMIN_DS.surfaceTintHex,
  "--admin-icon-surface": "color-mix(in srgb, #0072f8 12%, white)",
  "--admin-radius": ADMIN_DS.radius,
  "--admin-radius-sm": ADMIN_DS.radiusSm,
  "--admin-radius-lg": ADMIN_DS.radiusLg,
  "--admin-space-page": ADMIN_DS.space.section,
  "--admin-space-stack": ADMIN_DS.space.stack,
  "--admin-control-h": ADMIN_DS.space.controlH,
  "--admin-nav-active-bg": ADMIN_DS.primaryHsl,
  "--admin-nav-active-fg": ADMIN_DS.primaryForegroundHsl,
  "--admin-nav-hover": "0 0% 100% / 0.06",
  "--admin-table-row-hover": ADMIN_DS.surfaceTintHsl,
  "--admin-dialog-shadow": "var(--shadow-lg)",
  "--admin-focus-ring": ADMIN_DS.ringHsl,
  "--admin-chart-1": ADMIN_DS.primaryHsl,
  "--admin-chart-2": "220 40% 60%",
  "--admin-chart-3": "40 100% 50%",
  "--admin-chart-4": ADMIN_DS.destructiveHsl,
  "--admin-chart-5": ADMIN_DS.progressHsl,
  "--admin-chart-grid": ADMIN_DS.borderHsl,
  "--admin-chart-axis": ADMIN_DS.mutedForegroundHsl,
};
