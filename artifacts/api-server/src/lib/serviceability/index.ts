/** @deprecated Import from `@/lib/coverage` — Phase 1 compatibility barrel. */
export {
  type ServiceabilityRequest,
  type ServiceabilityResult,
  type ServiceabilityStatus,
  type GoogleAddressComponent,
  type ParsedAddressComponents,
  SERVICEABILITY_MESSAGES,
  buildServiceabilityRequest,
  parseGoogleAddressComponents,
  extractPincodeFromText,
  ServiceabilityValidationError,
  assertServiceabilitySuccess,
  validateServiceability,
  validateServiceabilityForBooking,
  serviceabilityBlockedLogPayload,
  serviceabilityHttpBody,
  SERVICEABILITY_HTTP_STATUS,
} from "../coverage";
