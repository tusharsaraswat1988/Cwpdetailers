/**
 * Booking Platform — public API (Phase 5.2 schedule-only).
 * Future modules must consume BookingCapability, not BookingService.
 */

export type {
  CreateBookingInput,
  CreateBookingResult,
  TransitionBookingInput,
  RescheduleBookingInput,
  CancelBookingInput,
} from "./types";

export {
  bookingToPublicResponse,
  BookingValidationError,
  BookingCoverageError,
} from "./types";

export {
  BookingCapability,
  bookingCapability,
} from "./capability/BookingCapability";
export type { BookingCapabilityOptions } from "./capability/BookingCapability";

export type {
  BookingContext,
  BookingRecordSummary,
  BookingScheduleContext,
  BookingTimelineEntry,
} from "./BookingContext";
export { buildBookingContext } from "./BookingContext";

export { BOOKING_DOMAIN_VERSION, BOOKING_CAPABILITY_VERSION } from "./versioning";

export type { BookingTraceContext } from "./correlation/BookingTraceContext";
export {
  buildBookingTraceContext,
  resolveBookingTraceId,
  createBookingOperationId,
} from "./correlation/BookingTraceContext";

export type { BookingDomainEvent, BookingDomainEventType } from "./domain/events/types";
export { bookingDomainEventPublisher, BookingDomainEventPublisher } from "./domain/events/EventPublisher";

export {
  BOOKING_STATUSES,
  BOOKING_TRANSITIONS,
  SLOT_OCCUPYING_STATUSES,
  validateTransition,
  canTransition,
  isTerminalStatus,
  isActiveScheduleStatus,
  BookingStateMachineError,
} from "./domain/stateMachine";

export type { BookingPolicy, BookingPolicyContext, PolicyResult } from "./policies/types";
export { bookingValidationPolicy } from "./policies/BookingValidationPolicy";
export { bookingCreationPolicy } from "./policies/BookingCreationPolicy";
export {
  assignmentPolicy,
  schedulingPolicy,
  cancellationPolicy,
  completionPolicy,
  reviewPolicy,
  paymentPolicy,
} from "./policies/BookingPolicies";

export {
  BusinessRulesEngine,
  businessRulesEngine,
} from "./businessRules/BusinessRulesEngine";
export type {
  BusinessRule,
  RuleCategory,
  RuleEvaluationInput,
  RuleEvaluationResult,
  BusinessRulesEngineResult,
} from "./businessRules/BusinessRulesEngine";
export { defaultBookingRules, registerDefaultBookingRules } from "./businessRules/rules";

export type { BookingSearchCriteria, BookingSearchResult, BookingSearchProvider } from "./search/types";
export { repositoryBookingSearchProvider } from "./search/RepositorySearchProvider";

export type { BookingExtensionRegistry } from "./extensions/interfaces";
export { bookingExtensionRegistry } from "./extensions/interfaces";

export { buildBookingMetrics, emitBookingMetrics } from "./metrics/BookingMetrics";

export { bookingTimelineService, BookingTimelineService } from "./timeline/BookingTimelineService";
export { bookingSnapshotService, BookingSnapshotService } from "./snapshots/BookingSnapshotService";

export { addressSelectionService, AddressSelectionService } from "./services/AddressSelectionService";
export type {
  AddressSelectionOption,
  AddressSelectionResponse,
  ValidateAddressSelectionInput,
  ValidateAddressSelectionResult,
} from "./services/AddressSelectionService";

export { serviceDiscoveryService, ServiceDiscoveryService } from "./services/ServiceDiscoveryService";
export type {
  ServiceAvailability,
  DiscoveredService,
  ServiceDiscoveryInput,
  ServiceDiscoveryResult,
} from "./services/ServiceDiscoveryService";

export {
  schedulingDomainService,
  SchedulingDomainService,
  validateSchedule,
  detectConflicts,
  assertNoDuplicateBooking,
  getAvailableSlots,
  BOOKING_TIME_SLOTS,
  checkSlotCapacity,
  getCapacityProvider,
  setCapacityProvider,
  resetCapacityProvider,
  DefaultCapacityProvider,
  resolveTimeWindow,
  windowsOverlap,
  generateCandidateStarts,
  DOMAIN_DEFAULT_DURATION_MINUTES,
  bookingScheduleProvider,
  bookingSlotProvider,
} from "./scheduling";
export type {
  CapacityProvider,
  CapacityContext,
  SlotQuery,
  AvailableSlot,
  TimeWindowInput,
  ResolvedTimeWindow,
  ValidateScheduleInput,
  ValidateScheduleResult,
} from "./scheduling";

export {
  BOOKING_SCHEDULE_DOMAIN_EVENTS,
} from "./domain/events/types";
export type { BookingScheduleDomainEventType } from "./domain/events/types";


/** @deprecated Use bookingCapability — internal implementation */
export { BookingService, bookingService } from "./BookingService";

/** @deprecated Use bookingCapability */
export { bookingRepository } from "./repositories/BookingRepository";
export { bookingTimelineRepository } from "./repositories/BookingTimelineRepository";
export { bookingSnapshotRepository } from "./repositories/BookingSnapshotRepository";
