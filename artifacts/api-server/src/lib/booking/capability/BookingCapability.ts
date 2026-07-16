import type { Logger } from "pino";
import { bookingService } from "../BookingService";
import { buildBookingTraceContext } from "../correlation/BookingTraceContext";
import { bookingDomainEventPublisher } from "../domain/events/EventPublisher";
import { baseBookingEventFields } from "../domain/events/types";
import { buildBookingMetrics, emitBookingMetrics } from "../metrics/BookingMetrics";
import { bookingTimelineService } from "../timeline/BookingTimelineService";
import { bookingSnapshotService } from "../snapshots/BookingSnapshotService";
import { repositoryBookingSearchProvider } from "../search/RepositorySearchProvider";
import { bookingSearchRegistry } from "../search/types";
import { BOOKING_CAPABILITY_VERSION } from "../versioning";
import type { CreateBookingInput, CreateBookingResult, TransitionBookingInput } from "../types";
import { bookingToPublicResponse, BookingValidationError } from "../types";
import type { BookingSearchCriteria } from "../search/types";

bookingSearchRegistry.repository = repositoryBookingSearchProvider;

export type BookingCapabilityOptions = {
  traceId?: string;
  requestId?: string;
  requestSource?: string;
  logger?: Logger;
};

export class BookingCapability {
  readonly version = BOOKING_CAPABILITY_VERSION;

  private trace(opts?: BookingCapabilityOptions, extra?: { bookingId?: number; customerId?: number }) {
    return buildBookingTraceContext({
      traceId: opts?.traceId,
      requestId: opts?.requestId,
      bookingId: extra?.bookingId,
      customerId: extra?.customerId,
    });
  }

  async createBooking(input: CreateBookingInput, opts?: BookingCapabilityOptions): Promise<CreateBookingResult & { bookingContext?: Awaited<ReturnType<typeof bookingService.getContext>> }> {
    const result = await bookingService.create(input, opts);
    const bookingContext = await bookingService.getContext(result.booking.id, opts);
    return { ...result, bookingContext: bookingContext ?? undefined };
  }

  async transitionBooking(input: TransitionBookingInput, opts?: BookingCapabilityOptions) {
    const booking = await bookingService.transition(input, opts);
    const bookingContext = await bookingService.getContext(booking.id, opts);
    return { booking: bookingToPublicResponse(booking), bookingContext };
  }

  async getBookingContext(bookingId: number, opts?: BookingCapabilityOptions) {
    return bookingService.getContext(bookingId, opts);
  }

  async getTimeline(bookingId: number) {
    return bookingTimelineService.getTimeline(bookingId);
  }

  async getSnapshots(bookingId: number) {
    return bookingSnapshotService.getSnapshots(bookingId);
  }

  async search(criteria: BookingSearchCriteria) {
    const provider = bookingSearchRegistry.repository;
    if (!provider) throw new BookingValidationError("Booking search provider not configured");
    return provider.search(criteria);
  }

  publishSnapshotCreated(
    trace: ReturnType<typeof buildBookingTraceContext>,
    snapshotId: number,
    snapshotType: string,
    logger?: Logger,
  ) {
    bookingDomainEventPublisher.publish(
      { ...baseBookingEventFields(trace), type: "BookingSnapshotCreated", snapshotId, snapshotType },
      logger,
    );
  }
}

export const bookingCapability = new BookingCapability();
