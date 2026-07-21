import type { CSSProperties } from "react";
import { LANDING_MOTION } from "../constants";

export type HeroEnterKey = keyof typeof LANDING_MOTION.staggerMs;

/** CSS class + delay for hero-only enter motion (not page-level). */
export function heroEnter(
  key: HeroEnterKey,
  ready: boolean,
): { className: string; style: CSSProperties } {
  return {
    className: ready ? "hero-enter hero-enter-ready" : "hero-enter",
    style: {
      transitionDelay: `${LANDING_MOTION.staggerMs[key]}ms`,
    },
  };
}
