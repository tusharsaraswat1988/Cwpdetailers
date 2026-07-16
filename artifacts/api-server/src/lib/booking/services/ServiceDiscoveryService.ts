import type { Logger } from "pino";
import { validateServiceabilityForBooking, buildCoverageRequest } from "../../coverage";
import type { CoverageResult } from "../../coverage/CoverageTypes";
import { buildBookingTraceContext } from "../correlation/BookingTraceContext";
import { flattenCoverageServices } from "./coverageServiceMapper";

export type ServiceAvailability = "AVAILABLE" | "UNAVAILABLE" | "COMING_SOON" | "TEMPORARILY_UNAVAILABLE";

export type DiscoveredService = {
  serviceId: number;
  serviceName: string;
  availability: ServiceAvailability;
  serviceType?: string;
  message?: string;
};

export type ServiceDiscoveryInput = {
  customerId?: number;
  address?: string;
  locationLat?: number;
  locationLng?: number;
  placeId?: string;
  cityId?: number;
  citySlug?: string;
  serviceId?: number;
};

export type ServiceDiscoveryResult = {
  valid: boolean;
  coverage: CoverageResult;
  services: DiscoveredService[];
  traceId: string;
  validationId?: string;
};

/** Dynamic service discovery via Location Intelligence — booking cannot proceed for unavailable services. */
export class ServiceDiscoveryService {
  async discover(input: ServiceDiscoveryInput, logger?: Logger): Promise<ServiceDiscoveryResult> {
    const trace = buildBookingTraceContext({ customerId: input.customerId });

    const coverage = await validateServiceabilityForBooking(
      buildCoverageRequest({
        customerId: input.customerId,
        address: input.address,
        locationLat: input.locationLat,
        locationLng: input.locationLng,
        placeId: input.placeId,
        cityId: input.cityId,
        citySlug: input.citySlug,
        serviceId: input.serviceId,
      }),
      {
        requestSource: "service_discovery",
        requestId: trace.requestId,
        traceId: trace.traceId,
        includeServiceCatalog: true,
      },
      logger,
    );

    const services = flattenCoverageServices(coverage);

    logger?.info(
      {
        traceId: trace.traceId,
        validationId: coverage.correlation.coverageValidationId,
        serviceCount: services.length,
        availableCount: services.filter((s) => s.availability === "AVAILABLE").length,
      },
      "service discovery completed",
    );

    return {
      valid: coverage.success,
      coverage,
      services,
      traceId: trace.traceId,
      validationId: coverage.correlation.coverageValidationId,
    };
  }

  isServiceBookable(services: DiscoveredService[], serviceId: number): boolean {
    const svc = services.find((s) => s.serviceId === serviceId);
    return svc?.availability === "AVAILABLE";
  }
}

export const serviceDiscoveryService = new ServiceDiscoveryService();
