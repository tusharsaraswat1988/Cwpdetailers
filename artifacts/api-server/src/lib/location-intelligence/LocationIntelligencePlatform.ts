import type { Logger } from "pino";
import type { CoverageCheckOptions, CoverageRequest, CoverageResult } from "../coverage/CoverageTypes";
import { coverageValidators } from "../coverage/CoverageValidators";
import { bookingPolicy } from "./policies/BookingPolicy";
import { coveragePolicy } from "./policies/CoveragePolicy";
import { buildCoverageEngineOutput } from "./domain/CoverageResultBuilder";
import { coreToLegacyResult, emitLocationMetrics, buildLocationMetrics } from "./metrics/LocationMetrics";
import { locationDomainEventPublisher } from "./domain/events/EventPublisher";
import { baseEventFields } from "./domain/events/types";
import {
  beginAccessCollection,
  endAccessCollection,
  type CoverageCacheAccessEvent,
} from "../coverage/CoverageCache";
import { LOCATION_INTELLIGENCE_VERSION, COVERAGE_STRATEGY_VERSION } from "./versioning";

export type LocationIntelligenceOptions = CoverageCheckOptions & {
  traceId?: string;
};

/**
 * Location Intelligence Platform — permanent foundation for all location-related capabilities.
 */
export class LocationIntelligencePlatform {
  readonly version = LOCATION_INTELLIGENCE_VERSION;
  readonly coverageStrategy = COVERAGE_STRATEGY_VERSION;

  async validateCoverage(
    request: CoverageRequest,
    options: LocationIntelligenceOptions = {},
    logger?: Logger,
  ): Promise<CoverageResult> {
    const started = Date.now();
    const cacheEvents: CoverageCacheAccessEvent[] = [];
    beginAccessCollection(cacheEvents);

    try {
      const state = coverageValidators.createInitialState(request, options);
      const isBooking = (options.requestSource ?? "").includes("booking");
      const executor = isBooking ? bookingPolicy : coveragePolicy;
      const { state: finalState, halted } = await executor.execute(state);

      if (halted) {
        return this.finalize(
          finalState,
          buildCoverageEngineOutput(finalState, false, halted.status, halted.message),
          cacheEvents,
          started,
          logger,
          isBooking,
        );
      }

      return this.finalize(
        finalState,
        buildCoverageEngineOutput(
          finalState,
          true,
          finalState.request.serviceId ? "SERVICE_AVAILABLE" : "SUCCESS",
        ),
        cacheEvents,
        started,
        logger,
        isBooking,
      );
    } finally {
      endAccessCollection();
    }
  }

  private finalize(
    state: import("../coverage/validators/types").PipelineState,
    output: ReturnType<typeof buildCoverageEngineOutput>,
    cacheEvents: CoverageCacheAccessEvent[],
    started: number,
    logger: Logger | undefined,
    isBooking: boolean,
  ): CoverageResult {
    const result = coreToLegacyResult(output.core, output._catalog);
    const durationMs = Date.now() - started;
    const hits = cacheEvents.filter(e => e.hit).length;
    const misses = cacheEvents.filter(e => !e.hit).length;

    this.publishEvents(state, output.core, result, cacheEvents, isBooking, logger);
    emitLocationMetrics(
      logger,
      buildLocationMetrics(result, state, { durationMs, cacheHits: hits, cacheMisses: misses }),
    );

    return result;
  }

  private publishEvents(
    state: import("../coverage/validators/types").PipelineState,
    core: import("./domain/CoverageResultCore").CoverageResultCore,
    result: CoverageResult,
    cacheEvents: CoverageCacheAccessEvent[],
    isBooking: boolean,
    logger?: Logger,
  ): void {
    const base = baseEventFields(state.correlation, state.correlation.bookingId);
    const publisher = locationDomainEventPublisher;

    publisher.publish(
      { ...base, type: "LocationResolved", locationContext: core.locationContext },
      logger,
    );

    for (const evt of cacheEvents) {
      publisher.publish(
        {
          ...base,
          type: evt.hit ? "CoverageCacheHit" : "CoverageCacheMiss",
          cacheKey: evt.key,
          namespace: evt.namespace,
        },
        logger,
      );
    }

    if (result.success) {
      publisher.publish(
        {
          ...base,
          type: "CoverageValidated",
          locationContext: core.locationContext,
          confidenceScore: core.confidenceScore,
        },
        logger,
      );

      if (isBooking) {
        publisher.publish(
          {
            ...base,
            type: "BookingCoverageValidated",
            customerId: state.request.customerId,
            serviceId: state.request.serviceId ?? null,
            status: result.status,
          },
          logger,
        );
      }
    } else {
      publisher.publish(
        {
          ...base,
          type: "CoverageRejected",
          status: result.status,
          reason: result.message,
          locationContext: core.locationContext,
        },
        logger,
      );

      publisher.publish(
        {
          ...base,
          type: "CoverageDemandDetected",
          pincode: result.pincode ?? state.parsedAddress.postalCode ?? undefined,
          cityId: result.cityId ?? state.city?.id,
          serviceId: state.request.serviceId ?? null,
          reason: result.status,
        },
        logger,
      );

      if (isBooking) {
        publisher.publish(
          {
            ...base,
            type: "BookingCoverageRejected",
            customerId: state.request.customerId,
            serviceId: state.request.serviceId ?? null,
            status: result.status,
          },
          logger,
        );
      }
    }
  }
}

export const locationIntelligencePlatform = new LocationIntelligencePlatform();
