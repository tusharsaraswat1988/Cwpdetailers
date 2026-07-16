/** @deprecated Use `lib/coverage/CoverageEngine` — Phase 1 compatibility re-export. */
export {
  validateServiceability,
  validateServiceabilityForBooking,
  serviceabilityBlockedLogPayload,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "../coverage/CoverageEngine";

export type { ServiceabilityLogContext } from "../coverage/CoverageMetrics";
