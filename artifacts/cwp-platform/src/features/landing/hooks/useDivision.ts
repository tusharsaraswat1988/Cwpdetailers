import { useMemo, type CSSProperties } from "react";
import { DIVISION_COLORS } from "../constants";
import type { Division } from "../types";

/** Scoped CSS vars for the active division — never mutates global CWP tokens. */
export function getDivisionThemeStyle(division: Division): CSSProperties {
  const colors = DIVISION_COLORS[division];
  return {
    "--landing-accent": colors.accent,
    "--landing-ring": colors.ring,
    "--landing-surface-tint": colors.surfaceTint,
  } as CSSProperties;
}

/**
 * Derive theme style from a division value.
 * Persistence lives in HeroSelector — this hook is presentation-only.
 */
export function useDivisionTheme(division: Division) {
  return useMemo(() => getDivisionThemeStyle(division), [division]);
}
