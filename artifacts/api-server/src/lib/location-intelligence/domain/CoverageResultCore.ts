import type { LocationContext } from "../LocationContext";
import type { CoverageStatusCode, CoverageStatusLabel, ServiceSummary, ServiceabilityStatus } from "../../coverage/CoverageTypes";
import type { TraceContext } from "../correlation/TraceContext";
import { LOCATION_INTELLIGENCE_VERSION } from "../versioning";

/** Service availability slice — no catalog lists (catalog is a separate layer). */
export type ServiceAvailabilitySnapshot = {
  serviceId?: number;
  available: boolean;
  cityId?: number;
};

/**
 * Core coverage outcome — Coverage Engine responsibility ends here.
 * Catalog transformation is applied by ServiceCatalogTransformer.
 */
export type CoverageResultCore = {
  success: boolean;
  status: CoverageStatusCode;
  legacyStatus: ServiceabilityStatus;
  message: string;
  coverageStatus: CoverageStatusLabel;
  correlation: TraceContext;
  locationContext: LocationContext;
  serviceAvailability?: ServiceAvailabilitySnapshot;
  confidenceScore: number;
  resolvedCityId?: number;
  version: typeof LOCATION_INTELLIGENCE_VERSION;
};

export type CoverageEngineOutput = {
  core: CoverageResultCore;
  /** Internal catalog snapshot — transformed by catalog layer for API responses. */
  _catalog?: {
    availableServices: ServiceSummary[];
    comingSoonServices: ServiceSummary[];
    unavailableServices: ServiceSummary[];
  };
};
