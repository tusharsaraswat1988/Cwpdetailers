import type { BookingSnapshot, InsertBookingSnapshot, BookingSnapshotType } from "@workspace/db";
import { db, bookingSnapshotsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";

export type SnapshotInput = {
  bookingId: number;
  snapshotType: BookingSnapshotType;
  snapshotData: Record<string, unknown>;
  trace: BookingTraceContext;
};

export class BookingSnapshotRepository {
  async create(input: SnapshotInput): Promise<BookingSnapshot> {
    const existing = await this.findLatest(input.bookingId, input.snapshotType);
    const version = (existing?.version ?? 0) + 1;
    const [snapshot] = await db.insert(bookingSnapshotsTable).values({
      bookingId: input.bookingId,
      snapshotType: input.snapshotType,
      snapshotData: input.snapshotData,
      version,
      traceId: input.trace.traceId,
      requestId: input.trace.requestId,
    }).returning();
    return snapshot;
  }

  async findLatest(bookingId: number, snapshotType: BookingSnapshotType): Promise<BookingSnapshot | null> {
    const [snapshot] = await db.select().from(bookingSnapshotsTable)
      .where(and(
        eq(bookingSnapshotsTable.bookingId, bookingId),
        eq(bookingSnapshotsTable.snapshotType, snapshotType),
      ))
      .orderBy(desc(bookingSnapshotsTable.version))
      .limit(1);
    return snapshot ?? null;
  }

  async findByBookingId(bookingId: number): Promise<BookingSnapshot[]> {
    return db.select().from(bookingSnapshotsTable)
      .where(eq(bookingSnapshotsTable.bookingId, bookingId))
      .orderBy(desc(bookingSnapshotsTable.createdAt));
  }
}

export const bookingSnapshotRepository = new BookingSnapshotRepository();
