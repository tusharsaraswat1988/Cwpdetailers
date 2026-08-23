/** Shared tokens for auth chrome. Controls live in portal DS primitives. */

import { CUSTOMER_MOTION, CUSTOMER_RADIUS } from "@/features/customer-ds";

/** Links on customer auth — same accent as the homepage. */
export const authLinkClass =
  "font-semibold text-[color:var(--landing-accent)] hover:underline transition-colors duration-200";

export const authMutedLinkClass =
  "text-muted-foreground hover:text-foreground transition-colors duration-200";

/** Links on dark staff/admin auth shells. */
export const authDarkMutedLinkClass =
  "text-white/50 hover:text-white/75 transition-colors duration-200";

export const authFadeIn = CUSTOMER_MOTION.fadeIn;

export const authFadeUp = CUSTOMER_MOTION.fadeUp;

export const authFormStagger = CUSTOMER_MOTION.stagger;

export const authTrustLineClass = "text-center text-white/40 text-[11px] leading-relaxed mt-3";

/** Control sizing shared across auth forms. */
export const authControlClass =
  "h-12 min-h-12 rounded-xl text-base";

/** Focus ring on marketing (home) auth — landing accent, not app teal. */
export const authLandingRingClass =
  "focus-visible:ring-[color:var(--landing-ring)]";

/** @deprecated prefer CSS vars from CustomerThemeRoot */
export const authRadius = CUSTOMER_RADIUS.sm;
