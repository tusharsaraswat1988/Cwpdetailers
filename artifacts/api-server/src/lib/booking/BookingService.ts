import type { Logger } from "pino";
import type { Booking } from "@workspace/db";
import { addressCapability } from "../address";
import { bookingRepository } from "./repositories/BookingRepository";
import { bookingValidationPolicy } from "./policies/BookingValidationPolicy";
import { bookingCreationPolicy } from "./policies/BookingCreationPolicy";
import { schedulingPolicy } from "./policies/BookingPolicies";
import { bookingSnapshotService } from "./snapshots/BookingSnapshotService";
import { bookingTimelineService } from "./timeline/BookingTimelineService";
import { bookingDomainEventPublisher } from "./domain/events/EventPublisher";
import { baseBookingEventFields } from "./domain/events/types";
import { buildBookingContext } from "./BookingContext";
import { buildBookingTraceContext } from "./correlation/BookingTraceContext";
import { buildBookingMetrics, emitBookingMetrics } from "./metrics/BookingMetrics";
import {
  validateLegacyTransition,
  mapLegacyTransitionToPlatform,
  resolvePlatformStatus,
  resolveLegacyStatus,
  LEGACY_TO_PLATFORM,
} from "./domain/stateMachine";
import type { CreateBookingInput, CreateBookingResult, TransitionBookingInput } from "./types";
import { BookingCoverageError, BookingValidationError } from "./types";
import type { CoverageResult } from "../coverage/CoverageTypes";

export type BookingServiceOptions = {
  traceId?: string;
  requestId?: string;
  requestSource?: string;
  logger?: Logger;
};

/** Internal orchestrator — routes should use BookingCapability. */
export class BookingService {
  private trace(opts?: BookingServiceOptions, extra?: { bookingId?: number; customerId?: number }) {
    return buildBookingTraceContext({
      traceId: opts?.traceId,
      requestId: opts?.requestId,
      bookingId: extra?.bookingId,
      customerId: extra?.customerId,
    });
  }

  async create(input: CreateBookingInput, opts?: BookingServiceOptions): Promise<CreateBookingResult> {
    const started = Date.now();
    const trace = this.trace(opts, { customerId: input.customerId });

    await schedulingPolicy.execute(
      { scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime, recurrenceRule: input.recurrenceRule },
      { trace, logger: opts?.logger },
    ).then((r) => {
      if (!r.success) throw new BookingValidationError(r.error ?? "Scheduling validation failed");
    });

    let coverage: CoverageResult | undefined;
    const validationCache = new Map<string, CoverageResult>();

    const coverageKey = `${input.customerId}:${input.locationLat}:${input.locationLng}:${input.serviceId}`;
    if (!validationCache.has(coverageKey)) {
      const validationResult = await bookingValidationPolicy.execute(
        {
          customerId: input.customerId,
          serviceId: input.serviceId,
          address: input.address,
          locationLat: input.locationLat,
          locationLng: input.locationLng,
          placeId: input.placeId,
          cityId: input.cityId,
          citySlug: input.citySlug,
          cityName: input.cityName ?? input.area,
          addressComponents: input.addressComponents,
          postalCode: input.postalCode,
          requestSource: opts?.requestSource ?? "booking_create",
        },
        { trace, logger: opts?.logger },
      );
      if (!validationResult.success || !validationResult.data) {
        emitBookingMetrics(opts?.logger, buildBookingMetrics("create", trace, {
          success: false,
          durationMs: Date.now() - started,
          coverageFailure: true,
          failureReason: validationResult.error,
        }));
        throw new BookingCoverageError(
          validationResult.error ?? "Coverage validation failed",
          validationResult.data ?? { success: false, status: "INVALID_ADDRESS", legacyStatus: "INVALID_ADDRESS", message: validationResult.error ?? "Coverage validation failed", coverageStatus: "INVALID", correlation: { coverageValidationId: trace.bookingOperationId, requestId: trace.requestId, traceId: trace.traceId } },
        );
      }
      coverage = validationResult.data;
      validationCache.set(coverageKey, coverage);
    } else {
      coverage = validationCache.get(coverageKey);
    }

    const coverageStatus = coverage?.coverageStatus ?? coverage?.locationContext?.coverageStatus;
    trace.coverageValidationId = coverage?.correlation.coverageValidationId;

    const creationResult = await bookingCreationPolicy.execute(
      {
        ...input,
        coverageStatus: typeof coverageStatus === "string" ? coverageStatus : undefined,
        amount: input.amount,
      },
      { trace, logger: opts?.logger },
    );
    if (!creationResult.success) {
      emitBookingMetrics(opts?.logger, buildBookingMetrics("create", trace, {
        success: false,
        durationMs: Date.now() - started,
        businessRuleFailure: true,
        failureReason: creationResult.error,
      }));
      throw new BookingValidationError(creationResult.error ?? "Booking creation rules failed", "BUSINESS_RULE_FAILED", creationResult.metadata);
    }

    const initialLegacy = input.status ?? "scheduled";
    const initialPlatform = input.initialPlatformStatus
      ?? input.platformStatus
      ?? LEGACY_TO_PLATFORM[initialLegacy]
      ?? "VALIDATED";

    const resolvedCityId = input.cityId ?? coverage?.resolvedCityId ?? null;
    const confidenceScore = coverage?.locationContext?.confidenceScore ?? null;

    const insertValues = {
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      solarSiteId: input.solarSiteId,
      subscriptionId: input.subscriptionId,
      serviceId: input.serviceId,
      staffId: input.staffId,
      branchId: input.branchId,
      companyId: input.companyId,
      franchiseeId: input.franchiseeId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      serviceType: input.serviceType as never,
      address: input.address,
      area: input.area,
      locationLat: input.locationLat,
      locationLng: input.locationLng,
      placeId: input.placeId,
      savedLocationId: input.savedLocationId,
      addressId: input.addressId,
      notes: input.notes,
      amount: input.amount,
      recurrenceRule: input.recurrenceRule,
      entitlementId: input.entitlementId,
      addonIds: input.addonIds ?? [],
      cityId: resolvedCityId,
      status: initialLegacy as never,
      platformStatus: initialPlatform,
      coverageStatus: typeof coverageStatus === "string" ? coverageStatus : null,
      coverageValidationId: coverage?.correlation.coverageValidationId ?? null,
      confidenceScore,
      locationContextSnapshot: coverage?.locationContext as Record<string, unknown> | undefined,
    };

    const booking = await bookingRepository.create(insertValues);
    trace.bookingId = booking.id;

    let addressSnapshotId: number | undefined;
    let addressIdentityId: number | undefined;

    if (input.addressId) {
      const snapshotBundle = await bookingSnapshotService.createAddressSnapshot(
        booking.id,
        input.addressId,
        trace,
        opts?.logger,
      );
      addressSnapshotId = snapshotBundle.addressSnapshotId;
      addressIdentityId = snapshotBundle.addressIdentityId;
      trace.addressSnapshotId = addressSnapshotId;
      trace.addressIdentityId = addressIdentityId;

      if (addressSnapshotId || addressIdentityId) {
        await bookingRepository.update(booking.id, {
          addressSnapshotId: addressSnapshotId ?? null,
          addressIdentityId: addressIdentityId ?? null,
          addressId: input.addressId,
        });
      }

      await bookingTimelineService.record({
        bookingId: booking.id,
        eventType: "ADDRESS_SNAPSHOT_CREATED",
        trace,
        metadata: { addressSnapshotId, addressIdentityId, addressId: input.addressId },
      }, opts?.logger);
    }

    if (coverage?.locationContext) {
      await bookingSnapshotService.createLocationSnapshot(
        booking.id,
        coverage.locationContext,
        trace,
      );
    }

    if (coverage) {
      await bookingSnapshotService.createCoverageSnapshot(booking.id, coverage, trace);
      await bookingTimelineService.record({
        bookingId: booking.id,
        eventType: "COVERAGE_VALIDATED",
        trace,
        metadata: { coverageStatus, validationId: coverage.correlation.coverageValidationId },
      }, opts?.logger);
    }

    if (input.amount) {
      await bookingSnapshotService.createPriceSnapshot(booking.id, {
        amount: input.amount,
        addonIds: input.addonIds,
        entitlementId: input.entitlementId,
      }, trace);
      await bookingTimelineService.record({
        bookingId: booking.id,
        eventType: "PRICE_CALCULATED",
        trace,
        metadata: { amount: input.amount },
      }, opts?.logger);
    }

    await bookingTimelineService.record({
      bookingId: booking.id,
      eventType: "BOOKING_CREATED",
      toPlatformStatus: initialPlatform,
      trace,
    }, opts?.logger);

    const updatedBooking = await bookingRepository.findById(booking.id) ?? booking;
    const ctx = buildBookingContext({
      booking: updatedBooking,
      correlation: trace,
      coverageResult: coverage,
      locationContext: coverage?.locationContext,
    });

    bookingDomainEventPublisher.publish(
      { ...baseBookingEventFields(trace), type: "BookingCreated", bookingContext: ctx },
      opts?.logger,
    );

    emitBookingMetrics(opts?.logger, buildBookingMetrics("create", trace, {
      success: true,
      durationMs: Date.now() - started,
      platformStatus: initialPlatform,
      legacyStatus: initialLegacy,
    }));

    return {
      booking: updatedBooking,
      coverage,
      addressSnapshotId,
      addressIdentityId,
      coverageValidationId: coverage?.correlation.coverageValidationId,
      confidenceScore: confidenceScore ?? undefined,
    };
  }

  async transition(input: TransitionBookingInput, opts?: BookingServiceOptions): Promise<Booking> {
    const started = Date.now();
    const existing = await bookingRepository.findById(input.bookingId);
    if (!existing) throw new BookingValidationError("Booking not found");

    validateLegacyTransition(existing.status, input.toLegacyStatus);

    const fromPlatform = resolvePlatformStatus(existing.status, existing.platformStatus ?? undefined);
    const toPlatform = mapLegacyTransitionToPlatform(input.toLegacyStatus);
    const toLegacy = resolveLegacyStatus(toPlatform, input.toLegacyStatus);

    const trace = this.trace(opts, {
      bookingId: existing.id,
      customerId: existing.customerId,
      addressIdentityId: existing.addressIdentityId ?? undefined,
      addressSnapshotId: existing.addressSnapshotId ?? undefined,
      coverageValidationId: existing.coverageValidationId ?? undefined,
    });

    const updateData: Record<string, unknown> = {
      status: toLegacy,
      platformStatus: toPlatform,
      updatedAt: new Date(),
    };
    if (input.toLegacyStatus === "in_progress") updateData.startedAt = new Date();
    if (input.toLegacyStatus === "completed") updateData.completedAt = new Date();

    const booking = await bookingRepository.update(existing.id, updateData as never);
    if (!booking) throw new BookingValidationError("Failed to update booking");

    await bookingTimelineService.recordTransition(
      booking.id,
      trace,
      fromPlatform,
      toPlatform,
      { actorId: input.actorId, actorName: input.actorName, description: input.reason },
      opts?.logger,
    );

    const ctx = buildBookingContext({ booking, correlation: trace });
    const eventTypeMap: Record<string, "BookingConfirmed" | "BookingStarted" | "BookingCompleted" | "BookingCancelled"> = {
      confirmed: "BookingConfirmed",
      in_progress: "BookingStarted",
      completed: "BookingCompleted",
      cancelled: "BookingCancelled",
    };
    const eventType = eventTypeMap[input.toLegacyStatus];
    if (eventType) {
      bookingDomainEventPublisher.publish(
        { ...baseBookingEventFields(trace), type: eventType, bookingContext: ctx },
        opts?.logger,
      );
    }

    emitBookingMetrics(opts?.logger, buildBookingMetrics("transition", trace, {
      success: true,
      durationMs: Date.now() - started,
      platformStatus: toPlatform,
      legacyStatus: toLegacy,
    }));

    return booking;
  }

  async getContext(bookingId: number, opts?: BookingServiceOptions) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return null;
    const trace = this.trace(opts, {
      bookingId: booking.id,
      customerId: booking.customerId,
      addressIdentityId: booking.addressIdentityId ?? undefined,
      addressSnapshotId: booking.addressSnapshotId ?? undefined,
      coverageValidationId: booking.coverageValidationId ?? undefined,
    });
    const timeline = await bookingTimelineService.getTimeline(bookingId);
    return buildBookingContext({
      booking,
      correlation: trace,
      locationContext: booking.locationContextSnapshot,
      timeline: timeline.map((t) => ({
        id: t.id,
        eventType: t.eventType,
        title: t.title,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  }
}

export const bookingService = new BookingService();
