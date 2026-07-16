import type { Logger } from "pino";
import type {
  CoverageCheckOptions,
  CoverageRequest,
  CoverageResult,
} from "./CoverageTypes";
import { coverageValidators } from "./CoverageValidators";
import { locationIntelligencePlatform } from "../location-intelligence/LocationIntelligencePlatform";
import { serviceCatalogTransformer } from "../location-intelligence/catalog/ServiceCatalogTransformer";

export class CoverageEngine {
  /**
   * Full coverage check — delegates to Location Intelligence Platform.
   */
  async check(
    request: CoverageRequest,
    options: CoverageCheckOptions = {},
    logger?: Logger,
  ): Promise<CoverageResult> {
    return locationIntelligencePlatform.validateCoverage(
      request,
      {
        ...options,
        includeServiceCatalog: options.includeServiceCatalog ?? true,
      },
      logger,
    );
  }

  /**
   * Booking gate — same pipeline, legacy-compatible result shape.
   */
  async validateForBooking(
    request: CoverageRequest,
    options: CoverageCheckOptions = {},
    logger?: Logger,
  ): Promise<CoverageResult> {
    return locationIntelligencePlatform.validateCoverage(
      request,
      {
        ...options,
        requestSource: options.requestSource ?? "booking",
        includeServiceCatalog: options.includeServiceCatalog ?? true,
      },
      logger,
    );
  }

  /** Direct pipeline access for tests — runs validators without platform events. */
  async runPipelineOnly(
    request: CoverageRequest,
    options: CoverageCheckOptions = {},
  ) {
    return coverageValidators.runPipeline(request, options);
  }
}

export const coverageEngine = new CoverageEngine();

/** @deprecated Phase 1 alias */
export async function validateServiceability(
  request: CoverageRequest,
  options?: CoverageCheckOptions,
  logger?: Logger,
): Promise<CoverageResult> {
  return coverageEngine.validateForBooking(request, options, logger);
}

/** @deprecated Phase 1 alias */
export async function validateServiceabilityForBooking(
  request: CoverageRequest,
  options?: CoverageCheckOptions,
  logger?: Logger,
): Promise<CoverageResult> {
  return coverageEngine.validateForBooking(request, options, logger);
}

export function toCoverageCheckResponse(result: CoverageResult) {
  return serviceCatalogTransformer.toCheckApiResponse(result);
}

export const SERVICEABILITY_HTTP_STATUS = 422;

export function serviceabilityHttpBody(result: CoverageResult) {
  return {
    success: false,
    status: result.legacyStatus,
    message: result.message,
    correlation: result.correlation,
  };
}
