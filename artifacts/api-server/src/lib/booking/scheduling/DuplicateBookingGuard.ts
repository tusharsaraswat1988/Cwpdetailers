import { and, eq, inArray, ne } from "drizzle-orm";
import { db, bookingsTable, type BookingStatus } from "@workspace/db";
import { SLOT_OCCUPYING_STATUSES } from "../domain/stateMachine";
import { resolveTimeWindow, windowsOverlap, DOMAIN_DEFAULT_DURATION_MINUTES } from "./TimeWindow";
import { BookingValidationError } from "../types";

export type DuplicateCheckInput = {
  customerId: number;
  assetId?: number | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
  durationMinutes?: number | null;
  excludeBookingId?: number;
};

/**
 * Prevents duplicate active bookings for the same customer + asset overlapping window.
 */
export async function assertNoDuplicateBooking(input: DuplicateCheckInput): Promise<void> {
  const window = resolveTimeWindow(input);
  const occupying = [...SLOT_OCCUPYING_STATUSES] as BookingStatus[];

  const conditions = [
    eq(bookingsTable.customerId, input.customerId),
    eq(bookingsTable.scheduledDate, window.scheduledDate),
    inArray(bookingsTable.status, occupying),
  ];

  if (input.assetId != null) {
    conditions.push(eq(bookingsTable.assetId, input.assetId));
  }
  if (input.excludeBookingId != null) {
    conditions.push(ne(bookingsTable.id, input.excludeBookingId));
  }

  const rows = await db
    .select({
      id: bookingsTable.id,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
      scheduledStartAt: bookingsTable.scheduledStartAt,
      scheduledEndAt: bookingsTable.scheduledEndAt,
      durationMinutes: bookingsTable.durationMinutes,
    })
    .from(bookingsTable)
    .where(and(...conditions));

  for (const row of rows) {
    const start = row.scheduledStartAt
      ?? resolveTimeWindow({
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime,
        durationMinutes: row.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES,
      }).scheduledStartAt;
    const end = row.scheduledEndAt
      ?? new Date(start.getTime() + (row.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES) * 60_000);

    if (windowsOverlap(window.scheduledStartAt, window.scheduledEndAt, start, end)) {
      throw new BookingValidationError(
        `Duplicate overlapping booking already exists (id=${row.id}) for this customer/asset`,
        "DUPLICATE_BOOKING",
        { existingBookingId: row.id },
      );
    }
  }
}
