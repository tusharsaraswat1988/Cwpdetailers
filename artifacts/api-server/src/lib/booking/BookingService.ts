import type { Logger } from "pino";
import type { Booking, BookingStatus } from "@workspace/db";
import { bookingRepository } from "./repositories/BookingRepository";
import { bookingValidationPolicy } from "./policies/BookingValidationPolicy";
import { bookingCreationPolicy } from "./policies/BookingCreationPolicy";
import { schedulingPolicy, cancellationPolicy } from "./policies/BookingPolicies";
import { bookingSnapshotService } from "./snapshots/BookingSnapshotService";
import { bookingTimelineService } from "./timeline/BookingTimelineService";
import { bookingDomainEventPublisher } from "./domain/events/EventPublisher";
import { baseBookingEventFields } from "./domain/events/types";
import { buildBookingContext } from "./BookingContext";
import { buildBookingTraceContext } from "./correlation/BookingTraceContext";
import { buildBookingMetrics, emitBookingMetrics } from "./metrics/BookingMetrics";
import { validateTransition } from "./domain/stateMachine";
import { schedulingDomainService } from "./scheduling";
import type {
  CreateBookingInput,
  CreateBookingResult,
  TransitionBookingInput,
  RescheduleBookingInput,
  CancelBookingInput,
} from "./types";
import { BookingCoverageError, BookingValidationError } from "./types";
import type { CoverageResult } from "../coverage/CoverageTypes";

export type BookingServiceOptions = {
  traceId?: string;
  requestId?: string;
  requestSource?: string;
  logger?: Logger;
};

/**
 * Booking Domain Service — single orchestrator for create / confirm / reschedule / cancel.
 * All scheduling (conflict, capacity, slots, time windows) goes through SchedulingDomainService.
 */
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
      { scheduledDate: input.scheduledDate, scheduledTime: input.scheduledTime },
      { trace, logger: opts?.logger },
    ).then((r) => {
      if (!r.success) throw new BookingValidationError(r.error ?? "Scheduling validation failed");
    });

    const scheduleCheck = await schedulingDomainService.validate({
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      durationMinutes: input.durationMinutes,
      customerId: input.customerId,
      assetId: input.assetId,
      serviceLocationId: input.serviceLocationId,
      branchId: input.branchId,
      cityId: input.cityId,
    });
    if (!scheduleCheck.valid || !scheduleCheck.window) {
      throw new BookingValidationError(scheduleCheck.error ?? "Schedule validation failed", "SCHEDULE_CONFLICT");
    }
    const window = scheduleCheck.window;

    let coverage: CoverageResult | undefined;
    if (!input.skipCoverageValidation && input.locationLat != null && input.locationLng != null) {
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
          validationResult.data ?? {
            success: false,
            status: "INVALID_ADDRESS",
            legacyStatus: "INVALID_ADDRESS",
            message: validationResult.error ?? "Coverage validation failed",
            coverageStatus: "INVALID",
            correlation: {
              coverageValidationId: trace.bookingOperationId,
              requestId: trace.requestId,
              traceId: trace.traceId,
            },
          },
        );
      }
      coverage = validationResult.data;
      trace.coverageValidationId = coverage?.correlation.coverageValidationId;
    }

    const coverageStatus = coverage?.coverageStatus ?? coverage?.locationContext?.coverageStatus;
    const creationResult = await bookingCreationPolicy.execute(
      {
        ...input,
        coverageStatus: typeof coverageStatus === "string" ? coverageStatus : undefined,
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
      throw new BookingValidationError(
        creationResult.error ?? "Booking creation rules failed",
        "BUSINESS_RULE_FAILED",
        creationResult.metadata,
      );
    }

    const initialStatus: BookingStatus = input.status ?? "scheduled";
    const resolvedCityId = input.cityId ?? coverage?.resolvedCityId ?? null;

    const booking = await bookingRepository.create({
      customerId: input.customerId,
      contractRegistryId: input.contractRegistryId ?? null,
      serviceLocationId: input.serviceLocationId ?? null,
      assetId: input.assetId ?? null,
      vehicleId: input.vehicleId ?? null,
      solarSiteId: input.solarSiteId ?? null,
      serviceId: input.serviceId ?? null,
      branchId: input.branchId ?? null,
      companyId: input.companyId ?? null,
      franchiseeId: input.franchiseeId ?? null,
      bookingType: input.bookingType ?? "one_time",
      scheduledDate: window.scheduledDate,
      scheduledTime: window.scheduledTime,
      scheduledStartAt: window.scheduledStartAt,
      scheduledEndAt: window.scheduledEndAt,
      durationMinutes: window.durationMinutes,
      serviceType: input.serviceType as never,
      address: input.address ?? null,
      area: input.area ?? null,
      locationLat: input.locationLat ?? null,
      locationLng: input.locationLng ?? null,
      placeId: input.placeId ?? null,
      savedLocationId: input.savedLocationId ?? null,
      addressId: input.addressId ?? null,
      notes: input.notes ?? null,
      cityId: resolvedCityId,
      status: initialStatus,
    });
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

    await bookingTimelineService.record({
      bookingId: booking.id,
      eventType: "BOOKING_CREATED",
      toStatus: initialStatus,
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

    if (initialStatus === "scheduled" || initialStatus === "confirmed" || initialStatus === "waiting_assignment") {
      bookingDomainEventPublisher.publish(
        { ...baseBookingEventFields(trace), type: "BookingScheduled", bookingContext: ctx },
        opts?.logger,
      );
    }
    if (initialStatus === "confirmed") {
      bookingDomainEventPublisher.publish(
        { ...baseBookingEventFields(trace), type: "BookingConfirmed", bookingContext: ctx },
        opts?.logger,
      );
    }

    emitBookingMetrics(opts?.logger, buildBookingMetrics("create", trace, {
      success: true,
      durationMs: Date.now() - started,
      legacyStatus: initialStatus,
    }));

    return {
      booking: updatedBooking,
      coverage,
      addressSnapshotId,
      addressIdentityId,
      coverageValidationId: coverage?.correlation.coverageValidationId,
    };
  }

  async transition(input: TransitionBookingInput, opts?: BookingServiceOptions): Promise<Booking> {
    const started = Date.now();
    const existing = await bookingRepository.findById(input.bookingId);
    if (!existing) throw new BookingValidationError("Booking not found");

    validateTransition(existing.status, input.toStatus);

    const trace = this.trace(opts, {
      bookingId: existing.id,
      customerId: existing.customerId,
    });

    const updateData: Record<string, unknown> = {
      status: input.toStatus,
      updatedAt: new Date(),
    };
    if (input.toStatus === "confirmed") {
      updateData.customerConfirmedAt = new Date();
    }
    if (input.toStatus === "cancelled" && input.reason) {
      updateData.cancellationReason = input.reason;
    }

    const booking = await bookingRepository.update(existing.id, updateData as never);
    if (!booking) throw new BookingValidationError("Failed to update booking");

    await bookingTimelineService.recordTransition(
      booking.id,
      trace,
      existing.status,
      input.toStatus,
      { actorId: input.actorId, actorName: input.actorName, description: input.reason },
      opts?.logger,
    );

    const ctx = buildBookingContext({ booking, correlation: trace });
    if (input.toStatus === "scheduled") {
      bookingDomainEventPublisher.publish(
        { ...baseBookingEventFields(trace), type: "BookingScheduled", bookingContext: ctx },
        opts?.logger,
      );
    }
    if (input.toStatus === "confirmed") {
      bookingDomainEventPublisher.publish(
        { ...baseBookingEventFields(trace), type: "BookingConfirmed", bookingContext: ctx },
        opts?.logger,
      );
    }
    if (input.toStatus === "cancelled") {
      bookingDomainEventPublisher.publish(
        {
          ...baseBookingEventFields(trace),
          type: "BookingCancelled",
          bookingContext: ctx,
          reason: input.reason,
        },
        opts?.logger,
      );
    }

    emitBookingMetrics(opts?.logger, buildBookingMetrics("transition", trace, {
      success: true,
      durationMs: Date.now() - started,
      legacyStatus: input.toStatus,
    }));

    return booking;
  }

  async confirm(bookingId: number, opts?: BookingServiceOptions & { actorId?: number; actorName?: string }) {
    return this.transition({
      bookingId,
      toStatus: "confirmed",
      actorId: opts?.actorId,
      actorName: opts?.actorName,
    }, opts);
  }

  async markWaitingAssignment(
    bookingId: number,
    opts?: BookingServiceOptions & { actorId?: number; actorName?: string },
  ) {
    const existing = await bookingRepository.findById(bookingId);
    if (!existing) throw new BookingValidationError("Booking not found");
    if (existing.status === "waiting_assignment") return existing;
    if (existing.status === "draft" || existing.status === "rescheduled") {
      await this.transition({
        bookingId,
        toStatus: "confirmed",
        actorId: opts?.actorId,
        actorName: opts?.actorName,
        reason: "Auto-confirm before waiting assignment",
      }, opts);
    }
    return this.transition({
      bookingId,
      toStatus: "waiting_assignment",
      actorId: opts?.actorId,
      actorName: opts?.actorName,
    }, opts);
  }

  async reschedule(input: RescheduleBookingInput, opts?: BookingServiceOptions): Promise<Booking> {
    const existing = await bookingRepository.findById(input.bookingId);
    if (!existing) throw new BookingValidationError("Booking not found");
    if (existing.status === "cancelled") {
      throw new BookingValidationError("Cannot reschedule a cancelled booking");
    }

    const scheduleCheck = await schedulingDomainService.validate({
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime,
      scheduledStartAt: input.scheduledStartAt,
      scheduledEndAt: input.scheduledEndAt,
      durationMinutes: input.durationMinutes ?? existing.durationMinutes,
      customerId: existing.customerId,
      assetId: existing.assetId,
      serviceLocationId: existing.serviceLocationId,
      branchId: existing.branchId,
      cityId: existing.cityId,
      excludeBookingId: existing.id,
    });
    if (!scheduleCheck.valid || !scheduleCheck.window) {
      throw new BookingValidationError(scheduleCheck.error ?? "Schedule validation failed", "SCHEDULE_CONFLICT");
    }
    const window = scheduleCheck.window;

    validateTransition(existing.status, "rescheduled");

    const trace = this.trace(opts, { bookingId: existing.id, customerId: existing.customerId });
    const booking = await bookingRepository.update(existing.id, {
      scheduledDate: window.scheduledDate,
      scheduledTime: window.scheduledTime,
      scheduledStartAt: window.scheduledStartAt,
      scheduledEndAt: window.scheduledEndAt,
      durationMinutes: window.durationMinutes,
      status: "rescheduled",
    });
    if (!booking) throw new BookingValidationError("Failed to reschedule booking");

    await bookingTimelineService.recordTransition(
      booking.id,
      trace,
      existing.status,
      "rescheduled",
      {
        actorId: input.actorId,
        actorName: input.actorName,
        description: input.reason
          ?? `Rescheduled from ${existing.scheduledDate} ${existing.scheduledTime ?? ""} to ${window.scheduledDate} ${window.scheduledTime ?? ""}`,
      },
      opts?.logger,
    );

    const ctx = buildBookingContext({ booking, correlation: trace });
    bookingDomainEventPublisher.publish(
      {
        ...baseBookingEventFields(trace),
        type: "BookingRescheduled",
        bookingContext: ctx,
        previousScheduledDate: String(existing.scheduledDate),
        previousScheduledTime: existing.scheduledTime,
        previousScheduledStartAt: existing.scheduledStartAt?.toISOString() ?? null,
        previousScheduledEndAt: existing.scheduledEndAt?.toISOString() ?? null,
      },
      opts?.logger,
    );

    return booking;
  }

  async cancel(input: CancelBookingInput, opts?: BookingServiceOptions): Promise<Booking> {
    const cancelCheck = await cancellationPolicy.execute(
      { currentStatus: (await bookingRepository.findById(input.bookingId))?.status ?? "", reason: input.reason },
      { trace: this.trace(opts), logger: opts?.logger },
    );
    if (!cancelCheck.success) {
      throw new BookingValidationError(cancelCheck.error ?? "Cannot cancel booking");
    }
    return this.transition({
      bookingId: input.bookingId,
      toStatus: "cancelled",
      reason: input.reason,
      actorId: input.actorId,
      actorName: input.actorName,
    }, opts);
  }

  async getContext(bookingId: number, opts?: BookingServiceOptions) {
    const booking = await bookingRepository.findById(bookingId);
    if (!booking) return null;
    const trace = this.trace(opts, {
      bookingId: booking.id,
      customerId: booking.customerId,
    });
    const timeline = await bookingTimelineService.getTimeline(bookingId);
    return buildBookingContext({
      booking,
      correlation: trace,
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
