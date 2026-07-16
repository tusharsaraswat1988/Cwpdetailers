/**
 * Location Intelligence Platform — version markers.
 * New strategies can implement V2+ without replacing V1 consumers.
 */

export const LOCATION_INTELLIGENCE_VERSION = "LocationIntelligenceV1" as const;
export const COVERAGE_STRATEGY_VERSION = "CoverageStrategyV1" as const;

export type LocationIntelligenceVersion = typeof LOCATION_INTELLIGENCE_VERSION;
export type CoverageStrategyVersion = typeof COVERAGE_STRATEGY_VERSION;
