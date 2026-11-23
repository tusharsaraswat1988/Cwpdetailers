/**
 * CWP Detailers — Universal Design System Foundation Tokens
 * DTCG 2025.10 Compliant
 * 
 * Canonical source of truth for design tokens across Admin, Staff, and Customer.
 * Do not introduce raw hex or ad-hoc measurements in feature code.
 */

/* ==========================================================================
   1. PRIMITIVE TOKENS
   ========================================================================== */

export const CWP_PRIMITIVE_COLORS = {
  // Brand Hues
  blue500: "#1677FF", // CWP Electric Blue (Primary Brand)
  blue600: "#0072F8", // Action Blue (High visibility)
  blue700: "#0958D9", // Primary Hover
  dark900: "#0B1D36", // Midnight Blue (Brand Hero / Secondary)
  teal400: "#00CCCC", // Vivid Accent Teal (Solar / Sparkle)
  
  // Neutrals (Slate / Zinc scale)
  neutral50: "#F8FAFC",  // Canvas background
  neutral100: "#F1F5F9", // Card surface tint / muted
  neutral200: "#E2E8F0", // Border subtle
  neutral300: "#CBD5E1", // Border strong / divider
  neutral400: "#94A3B8", // Inactive icon
  neutral500: "#64748B", // Muted text / helper
  neutral700: "#334155", // Text subtle
  neutral800: "#1E293B", // Text secondary / headings
  neutral900: "#0F172A", // Text primary (maximum readability)
  white: "#FFFFFF",
  black: "#000000",

  // Feedback Primitives
  green600: "#16A34A",  // Success / Completed
  green700: "#15803D",
  green50: "#F0FDF4",
  amber600: "#D97706",  // Warning / Pending / Syncing
  amber700: "#B45309",
  amber50: "#FFFBEB",
  red600: "#DC2626",    // Destructive / Cancelled / Error
  red700: "#B91C1C",
  red50: "#FEF2F2",
  sky600: "#0284C7",    // Scheduled / Info
  sky700: "#0369A1",
  sky50: "#F0F9FF",
  purple600: "#7C3AED", // In Progress / Route Active
  purple50: "#FAF5FF",
} as const;

export const CWP_FONTS = {
  sans: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
  display: "'Outfit', system-ui, -apple-system, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
} as const;

/* ==========================================================================
   2. SEMANTIC TOKENS
   ========================================================================== */

export const CWP_SEMANTIC = {
  color: {
    action: {
      primary: CWP_PRIMITIVE_COLORS.blue500,
      primaryHover: CWP_PRIMITIVE_COLORS.blue700,
      primaryForeground: CWP_PRIMITIVE_COLORS.white,
      secondary: CWP_PRIMITIVE_COLORS.dark900,
      secondaryForeground: CWP_PRIMITIVE_COLORS.white,
      destructive: CWP_PRIMITIVE_COLORS.red600,
      destructiveForeground: CWP_PRIMITIVE_COLORS.white,
    },
    surface: {
      canvas: CWP_PRIMITIVE_COLORS.neutral50,
      card: CWP_PRIMITIVE_COLORS.white,
      cardHover: CWP_PRIMITIVE_COLORS.neutral50,
      muted: CWP_PRIMITIVE_COLORS.neutral100,
      tint: "#EEF8FF",
    },
    border: {
      subtle: CWP_PRIMITIVE_COLORS.neutral200,
      strong: CWP_PRIMITIVE_COLORS.neutral300,
      focus: CWP_PRIMITIVE_COLORS.blue500,
    },
    text: {
      primary: CWP_PRIMITIVE_COLORS.neutral900,
      secondary: CWP_PRIMITIVE_COLORS.neutral800,
      muted: CWP_PRIMITIVE_COLORS.neutral500,
      inverse: CWP_PRIMITIVE_COLORS.white,
    },
    status: {
      completed: {
        text: CWP_PRIMITIVE_COLORS.green700,
        bg: CWP_PRIMITIVE_COLORS.green50,
        border: "#BBF7D0",
        icon: "check_circle",
      },
      inProgress: {
        text: CWP_PRIMITIVE_COLORS.blue600,
        bg: "#EFF6FF",
        border: "#BFDBFE",
        icon: "pending",
      },
      enRoute: {
        text: CWP_PRIMITIVE_COLORS.amber700,
        bg: CWP_PRIMITIVE_COLORS.amber50,
        border: "#FDE68A",
        icon: "directions_car",
      },
      scheduled: {
        text: CWP_PRIMITIVE_COLORS.sky700,
        bg: CWP_PRIMITIVE_COLORS.sky50,
        border: "#BAE6FD",
        icon: "calendar_today",
      },
      pending: {
        text: CWP_PRIMITIVE_COLORS.amber700,
        bg: CWP_PRIMITIVE_COLORS.amber50,
        border: "#FDE68A",
        icon: "schedule",
      },
      syncPending: {
        text: CWP_PRIMITIVE_COLORS.amber700,
        bg: CWP_PRIMITIVE_COLORS.amber50,
        border: "#FDE68A",
        icon: "sync",
      },
      cancelled: {
        text: CWP_PRIMITIVE_COLORS.red700,
        bg: CWP_PRIMITIVE_COLORS.red50,
        border: "#FECACA",
        icon: "cancel",
      },
      missed: {
        text: CWP_PRIMITIVE_COLORS.red700,
        bg: CWP_PRIMITIVE_COLORS.red50,
        border: "#FECACA",
        icon: "error",
      },
      draft: {
        text: CWP_PRIMITIVE_COLORS.neutral700,
        bg: CWP_PRIMITIVE_COLORS.neutral100,
        border: CWP_PRIMITIVE_COLORS.neutral200,
        icon: "drafts",
      },
    },
  },
} as const;

/* ==========================================================================
   3. MATERIAL DESIGN 3 ICON TOKENS
   ========================================================================== */

export const M3_ICON_SPECS = {
  family: "Material Symbols Outlined",
  weight: {
    regular: 400,
    medium: 500,
    bold: 600,
  },
  size: {
    xs: 16, // badges, micro tags
    sm: 18, // dense table icons
    base: 20, // buttons, input leading icons
    md: 24, // app bar, navigation, standard cards
    lg: 32, // stat card icons, quick action tiles
    xl: 48, // empty state illustrations
  },
} as const;

/* ==========================================================================
   4. ROLE-SPECIFIC SURFACE TOKENS
   ========================================================================== */

export const CWP_ROLE_SCALES = {
  admin: {
    controlHeight: "2.25rem", // 36px dense
    controlHeightSm: "2rem",  // 32px
    touchMin: "2rem",
    cardPadding: "p-4 sm:p-5",
    tableRowHeight: "h-11",
    fontSizeBody: "text-sm",  // 14px
    shadow: "shadow-sm",
    radius: "rounded-lg",
  },
  staff: {
    controlHeight: "3.25rem", // 52px touch-first
    controlHeightSm: "2.75rem", // 44px minimum
    touchMin: "3rem",        // 48px absolute minimum
    cardPadding: "p-4",
    fontSizeBody: "text-base", // 16px readable outdoors
    shadow: "shadow-sm",
    radius: "rounded-xl",
  },
  customer: {
    controlHeight: "3rem",    // 48px standard
    controlHeightSm: "2.5rem", // 40px
    touchMin: "2.75rem",     // 44px minimum
    cardPadding: "p-4 sm:p-5",
    fontSizeBody: "text-[15px]",
    shadow: "0 1px 3px 0 rgba(15, 23, 42, 0.04)",
    radius: "rounded-xl",
  },
} as const;
