import type { BookingTimeline, InsertBookingTimeline, BookingTimelineEventType } from "@workspace/db";
import { db, bookingTimelineTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";

export type TimelineEntryInput = {
  bookingId: number;
  eventType: BookingTimelineEventType;
  title: string;
  description?: string;
  fromPlatformStatus?: InsertBookingTimeline["fromPlatformStatus"];
  toPlatformStatus?: InsertBookingTimeline["toPlatformStatus"];
  actorId?: number;
  actorName?: string;
  metadata?: Record<string, unknown>;
  trace: BookingTraceContext;
};

export class BookingTimelineRepository {
  async append(input: TimelineEntryInput): Promise<BookingTimeline> {
    const [entry] = await db.insert(bookingTimelineTable).values({
      bookingId: input.bookingId,
      eventType: input.eventType,
      title: input.title,
      description: input.description,
      fromPlatformStatus: input.fromPlatformStatus,
      toPlatformStatus: input.toPlatformStatus,
      actorId: input.actorId,
      actorName: input.actorName,
      metadata: input.metadata ?? {},
      traceId: input.trace.traceId,
      requestId: input.trace.requestId,
      bookingOperationId: input.trace.bookingOperationId,
      addressIdentityId: input.trace.addressIdentityId,
      addressSnapshotId: input.trace.addressSnapshotId,
      coverageValidationId: input.trace.coverageValidationId,
    }).returning();
    return entry;
  }

  async findByBookingId(bookingId: number): Promise<BookingTimeline[]> {
    return db.select().from(bookingTimelineTable)
      .where(eq(bookingTimelineTable.bookingId, bookingId))
      .orderBy(asc(bookingTimelineTable.createdAt));
  }
}

export const bookingTimelineRepository = new BookingTimelineRepository();
