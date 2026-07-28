import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useLocation } from "wouter";
import { trackLandingEvent } from "./analytics";
import { getDivisionThemeStyle } from "./hooks/useDivision";
import {
  DIVISION_STORAGE_KEY,
  divisionFromPath,
  pathForDivision,
  type Division,
} from "./types";

export type ExperiencePersonalization = {
  /** Future CMS / A-B content variant key */
  contentVariant?: string;
  locale?: string;
};

export type ExperienceContextValue = {
  division: Division;
  isVehicle: boolean;
  setDivision: (
    next: Division,
    meta?: { method?: "click" | "keyboard" | "url" | "restore" },
  ) => void;
  themeStyle: CSSProperties;
  personalization: ExperiencePersonalization;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

function readStoredDivision(): Division | null {
  try {
    const saved = window.sessionStorage.getItem(DIVISION_STORAGE_KEY);
    if (saved === "vehicle" || saved === "solar") return saved;
  } catch {
    /* ignore */
  }
  return null;
}

function writeStoredDivision(division: Division) {
  try {
    window.sessionStorage.setItem(DIVISION_STORAGE_KEY, division);
  } catch {
    /* ignore */
  }
}

function readLegacyDivisionQuery(): Division | null {
  try {
    const param = new URLSearchParams(window.location.search).get("division");
    if (param === "vehicle" || param === "solar") return param;
  } catch {
    /* ignore */
  }
  return null;
}

function resolveInitialDivision(location: string, defaultDivision: Division): Division {
  return divisionFromPath(location) ?? readLegacyDivisionQuery() ?? readStoredDivision() ?? defaultDivision;
}

export type ExperienceProviderProps = {
  children: ReactNode;
  defaultDivision?: Division;
  persist?: boolean;
  /** Sync `/vehicle` and `/solar` via Wouter */
  syncUrl?: boolean;
  personalization?: ExperiencePersonalization;
};

/**
 * Owns marketing experience business logic:
 * division state, persistence, analytics, URL sync, future CMS personalization.
 */
export function ExperienceProvider({
  children,
  defaultDivision = "vehicle",
  persist = true,
  syncUrl = true,
  personalization = {},
}: ExperienceProviderProps) {
  const [location, setLocation] = useLocation();
  const [division, setDivisionState] = useState<Division>(() =>
    typeof window === "undefined"
      ? defaultDivision
      : resolveInitialDivision(location, defaultDivision),
  );
  const divisionRef = useRef(division);
  divisionRef.current = division;

  const setDivision = useCallback(
    (
      next: Division,
      meta: { method?: "click" | "keyboard" | "url" | "restore" } = {},
    ) => {
      const prev = divisionRef.current;
      if (prev === next) return;

      setDivisionState(next);
      if (persist) writeStoredDivision(next);
      if (syncUrl) setLocation(pathForDivision(next));

      const method = meta.method === "keyboard" ? "keyboard" : "click";
      trackLandingEvent("hero_division_selected", {
        division: next,
        from: prev,
        method,
      });
      if (meta.method === "keyboard") {
        trackLandingEvent("hero_selector_keyboard", { division: next, method });
      }
    },
    [persist, syncUrl, setLocation],
  );

  useEffect(() => {
    if (!syncUrl) return;
    const fromPath = divisionFromPath(location);
    if (fromPath && fromPath !== divisionRef.current) {
      setDivisionState(fromPath);
      if (persist) writeStoredDivision(fromPath);
    }
  }, [location, syncUrl, persist]);

  const value = useMemo<ExperienceContextValue>(
    () => ({
      division,
      isVehicle: division === "vehicle",
      setDivision,
      themeStyle: getDivisionThemeStyle(division),
      personalization,
    }),
    [division, setDivision, personalization],
  );

  return (
    <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>
  );
}

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error("useExperience must be used within ExperienceProvider");
  }
  return ctx;
}
