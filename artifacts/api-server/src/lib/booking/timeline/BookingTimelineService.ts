import type { Logger } from "pino";
import type { BookingStatus } from "@workspace/db";
import { bookingTimelineRepository, type TimelineEntryInput } from "../repositories/BookingTimelineRepository";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";

const TIMELINE_TITLES: Record<string, string> = {
  BOOKING_CREATED: "Booking Created",
  COVERAGE_VALIDATED: "Coverage Validated",
  ADDRESS_SNAPSHOT_CREATED: "Address Snapshot Created",
  BOOKING_VALIDATED: "Booking Validated",
  BOOKING_CONFIRMED: "Booking Confirmed",
  WAITING_ASSIGNMENT: "Waiting Assignment",
  CANCELLED: "Booking Cancelled",
  RESCHEDULED: "Booking Rescheduled",
  BUSINESS_RULE_EVALUATED: "Business Rules Evaluated",
  SERVICE_DISCOVERED: "Services Discovered",
  ADDRESS_CHANGED: "Address Changed",
};

const STATUS_EVENT_MAP: Partial<Record<BookingStatus, TimelineEntryInput["eventType"]>> = {
  scheduled: "BOOKING_VALIDATED",
  confirmed: "BOOKING_CONFIRMED",
  waiting_assignment: "WAITING_ASSIGNMENT",
  cancelled: "CANCELLED",
  rescheduled: "RESCHEDULED",
};

export class BookingTimelineService {
  async record(
    input: Omit<TimelineEntryInput, "title"> & { title?: string },
    logger?: Logger,
  ) {
    const entry = await bookingTimelineRepository.append({
      ...input,
      title: input.title ?? TIMELINE_TITLES[input.eventType] ?? input.eventType,
    });
    logger?.debug(
      { bookingId: input.bookingId, eventType: input.eventType, traceId: input.trace.traceId },
      "booking timeline entry recorded",
    );
    return entry;
  }

  async recordTransition(
    bookingId: number,
    trace: BookingTraceContext,
    from: BookingStatus,
    to: BookingStatus,
    opts?: { actorId?: number; actorName?: string; description?: string },
    logger?: Logger,
  ) {
    return this.record({
      bookingId,
      eventType: STATUS_EVENT_MAP[to] ?? "BOOKING_CONFIRMED",
      fromStatus: from,
      toStatus: to,
      trace,
      actorId: opts?.actorId,
      actorName: opts?.actorName,
      description: opts?.description,
    }, logger);
  }

  async getTimeline(bookingId: number) {
    return bookingTimelineRepository.findByBookingId(bookingId);
  }
}

export const bookingTimelineService = new BookingTimelineService();
