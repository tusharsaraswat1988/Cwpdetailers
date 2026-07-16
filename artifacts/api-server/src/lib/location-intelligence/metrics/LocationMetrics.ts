import type { Logger } from "pino";
import type { CoverageResultCore } from "../domain/CoverageResultCore";
import type { PipelineState } from "../../coverage/validators/types";
import type { TraceContext } from "../correlation/TraceContext";
import {
  buildCoverageMetricsPayload,
  buildDemandSignalPayload,
  emitCoverageMetrics,
  emitDemandSignal,
} from "../../coverage/CoverageMetrics";
import type { CoverageResult } from "../../coverage/CoverageTypes";
import { serviceCatalogTransformer } from "../catalog/ServiceCatalogTransformer";

export type LocationMetricsBundle = {
  coverage: ReturnType<typeof buildCoverageMetricsPayload>;
  demand?: ReturnType<typeof buildDemandSignalPayload>;
  resolution: {
    event: "location_resolution";
    timestamp: string;
    traceId: string;
    confidenceScore: number;
    resolvedBy: string;
    latencyMs?: number;
  };
  cache: {
    hits: number;
    misses: number;
  };
  performance: {
    event: "location_validation_performance";
    timestamp: string;
    traceId: string;
    durationMs: number;
    success: boolean;
  };
};

export function buildLocationMetrics(
  result: CoverageResult,
  state: PipelineState,
  opts: { durationMs: number; cacheHits: number; cacheMisses: number },
): LocationMetricsBundle {
  return {
    coverage: buildCoverageMetricsPayload(result, state),
    demand: result.success ? undefined : buildDemandSignalPayload(result, state),
    resolution: {
      event: "location_resolution",
      timestamp: new Date().toISOString(),
      traceId: state.correlation.traceId,
      confidenceScore: result.confidenceScore ?? result.locationContext?.confidenceScore ?? 0,
      resolvedBy: result.locationContext?.resolvedBy ?? "unknown",
      latencyMs: opts.durationMs,
    },
    cache: { hits: opts.cacheHits, misses: opts.cacheMisses },
    performance: {
      event: "location_validation_performance",
      timestamp: new Date().toISOString(),
      traceId: state.correlation.traceId,
      durationMs: opts.durationMs,
      success: result.success,
    },
  };
}

export function emitLocationMetrics(
  logger: Logger | undefined,
  bundle: LocationMetricsBundle,
): void {
  emitCoverageMetrics(logger, {
    ...bundle.coverage,
    traceId: bundle.resolution.traceId,
    confidenceScore: bundle.resolution.confidenceScore,
    cacheHits: bundle.cache.hits,
    cacheMisses: bundle.cache.misses,
    durationMs: bundle.performance.durationMs,
  });

  logger?.info(bundle.resolution, "location resolution metrics");
  logger?.info(bundle.performance, "location validation performance");
  logger?.info(
    { event: "location_cache_metrics", ...bundle.cache, traceId: bundle.resolution.traceId },
    "location cache metrics",
  );

  if (bundle.demand) {
    emitDemandSignal(logger, bundle.demand);
  }
}

export function coreToLegacyResult(
  core: CoverageResultCore,
  catalog?: {
    availableServices: CoverageResult["availableServices"];
    comingSoonServices: CoverageResult["comingSoonServices"];
    unavailableServices: CoverageResult["unavailableServices"];
  },
): CoverageResult {
  return serviceCatalogTransformer.attachCatalog(core, catalog);
}

export type { TraceContext };
