import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "anon";
  try {
    let sid = localStorage.getItem("cwp_ux_session_id");
    if (!sid) {
      sid = "sess_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem("cwp_ux_session_id", sid);
    }
    return sid;
  } catch {
    return "anon";
  }
}

export interface ExperimentVariant {
  variantId: string;
  variantName: string;
  config: Record<string, unknown>;
  inExperiment: boolean;
}

export interface ActiveExperiment {
  experimentId: number;
  key: string;
  name: string;
  targetScreen: string;
  primaryMetric: string;
  variant: ExperimentVariant;
}

interface UseUxExperimentOptions {
  targetScreen?: string;
  cityId?: number | null;
  branchId?: number | null;
  customerId?: number | null;
}

export function useUxExperiment(options: UseUxExperimentOptions = {}) {
  const { targetScreen = "homepage", cityId, branchId, customerId } = options;
  const sessionId = useMemo(() => getOrCreateSessionId(), []);
  const exposedSet = useRef<Set<number>>(new Set());

  const { data } = useQuery<{ success: boolean; experiments: ActiveExperiment[] }>({
    queryKey: ["ux-experiments", targetScreen, cityId || "all", branchId || "all", sessionId],
    queryFn: async () => {
      const params = new URLSearchParams({
        targetScreen,
        sessionId,
      });
      if (cityId) params.set("cityId", String(cityId));
      if (branchId) params.set("branchId", String(branchId));
      if (customerId) params.set("customerId", String(customerId));

      const res = await fetch(`/api/ux/experiments/active?${params.toString()}`);
      if (!res.ok) return { success: false, experiments: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
  });

  const experiments = data?.experiments || [];

  const experimentMap = useMemo(() => {
    const map = new Map<string, ActiveExperiment>();
    for (const exp of experiments) {
      map.set(exp.key, exp);
    }
    return map;
  }, [experiments]);

  // Helper to log exposure to the server once per experiment
  const logExposure = (exp: ActiveExperiment) => {
    if (exposedSet.current.has(exp.experimentId)) return;
    exposedSet.current.add(exp.experimentId);

    fetch("/api/ux/experiments/exposure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        experimentId: exp.experimentId,
        variantId: exp.variant.variantId,
        sessionId,
        customerId,
        cityId,
        deviceType: window.innerWidth < 768 ? "mobile" : "desktop",
      }),
    }).catch(() => {});
  };

  /**
   * Resolves the assigned variant for a specific experiment key.
   * Auto-logs exposure when invoked.
   */
  const getVariant = (experimentKey: string, fallbackVariantId = "control"): string => {
    const exp = experimentMap.get(experimentKey);
    if (!exp) return fallbackVariantId;
    logExposure(exp);
    return exp.variant.variantId || fallbackVariantId;
  };

  /**
   * Returns whether a variant is currently active for the given key.
   */
  const isVariant = (experimentKey: string, variantId: string): boolean => {
    return getVariant(experimentKey) === variantId;
  };

  /**
   * Returns variant configuration parameters.
   */
  const getConfig = <T = Record<string, unknown>>(experimentKey: string, fallback: T = {} as T): T => {
    const exp = experimentMap.get(experimentKey);
    if (!exp) return fallback;
    logExposure(exp);
    return (exp.variant.config as T) || fallback;
  };

  /**
   * Helper to trigger conversion telemetry
   */
  const trackConversion = (eventName: string, value?: number) => {
    fetch("/api/ux/experiments/conversion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        customerId,
        eventName,
        conversionValue: value,
      }),
    }).catch(() => {});
  };

  return {
    sessionId,
    experiments,
    getVariant,
    isVariant,
    getConfig,
    trackConversion,
  };
}
