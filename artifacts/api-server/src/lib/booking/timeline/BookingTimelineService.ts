import type { Logger } from "pino";
import { bookingTimelineRepository, type TimelineEntryInput } from "../repositories/BookingTimelineRepository";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";
import type { BookingPlatformStatus } from "@workspace/db";

const TIMELINE_TITLES: Record<string, string> = {
  BOOKING_CREATED: "Booking Created",
  COVERAGE_VALIDATED: "Coverage Validated",
  ADDRESS_SNAPSHOT_CREATED: "Address Snapshot Created",
  PRICE_CALCULATED: "Price Calculated",
  BOOKING_VALIDATED: "Booking Validated",
  BOOKING_CONFIRMED: "Booking Confirmed",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_COMPLETED: "Payment Completed",
  ASSIGNED: "Staff Assigned",
  ACCEPTED: "Staff Accepted",
  TRAVELLING: "Staff Travelling",
  ARRIVED: "Staff Arrived",
  STARTED: "Service Started",
  PAUSED: "Service Paused",
  RESUMED: "Service Resumed",
  COMPLETED: "Service Completed",
  CANCELLED: "Booking Cancelled",
  FAILED: "Booking Failed",
  REVIEW_PENDING: "Review Pending",
  REVIEWED: "Review Submitted",
  ARCHIVED: "Booking Archived",
  ADDRESS_CHANGED: "Address Changed",
  RESCHEDULED: "Booking Rescheduled",
  PROOF_UPLOADED: "Proof Uploaded",
  BUSINESS_RULE_EVALUATED: "Business Rules Evaluated",
  SERVICE_DISCOVERED: "Services Discovered",
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
    from: BookingPlatformStatus,
    to: BookingPlatformStatus,
    opts?: { actorId?: number; actorName?: string; description?: string },
    logger?: Logger,
  ) {
    const eventTypeMap: Partial<Record<BookingPlatformStatus, TimelineEntryInput["eventType"]>> = {
      VALIDATED: "BOOKING_VALIDATED",
      CONFIRMED: "BOOKING_CONFIRMED",
      ASSIGNED: "ASSIGNED",
      ACCEPTED: "ACCEPTED",
      TRAVELLING: "TRAVELLING",
      ARRIVED: "ARRIVED",
      STARTED: "STARTED",
      PAUSED: "PAUSED",
      RESUMED: "RESUMED",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
      FAILED: "FAILED",
      REVIEW_PENDING: "REVIEW_PENDING",
      REVIEWED: "REVIEWED",
      ARCHIVED: "ARCHIVED",
    };
    return this.record({
      bookingId,
      eventType: eventTypeMap[to] ?? "BOOKING_CONFIRMED",
      fromPlatformStatus: from,
      toPlatformStatus: to,
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
