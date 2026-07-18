import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db, bookingsTable, type BookingStatus } from "@workspace/db";
import { SLOT_OCCUPYING_STATUSES } from "../domain/stateMachine";
import {
  resolveTimeWindow,
  windowsOverlap,
  type TimeWindowInput,
  DOMAIN_DEFAULT_DURATION_MINUTES,
} from "./TimeWindow";

export type ConflictCheckInput = TimeWindowInput & {
  customerId: number;
  assetId?: number | null;
  serviceLocationId?: number | null;
  excludeBookingId?: number;
};

export type ConflictResult = {
  hasConflict: boolean;
  conflicts: Array<{
    bookingId: number;
    reason: string;
    scheduledDate: string;
    scheduledTime: string | null;
    scheduledStartAt?: Date | null;
    scheduledEndAt?: Date | null;
  }>;
};

function rowWindow(row: {
  scheduledDate: string;
  scheduledTime: string | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  durationMinutes: number | null;
}): { start: Date; end: Date } {
  if (row.scheduledStartAt && row.scheduledEndAt) {
    return { start: row.scheduledStartAt, end: row.scheduledEndAt };
  }
  const resolved = resolveTimeWindow({
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    scheduledStartAt: row.scheduledStartAt,
    scheduledEndAt: row.scheduledEndAt,
    durationMinutes: row.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES,
  });
  return { start: resolved.scheduledStartAt, end: resolved.scheduledEndAt };
}

/**
 * Detects overlapping schedule windows for the same asset, service location,
 * or customer. Uses start/end datetime — not fixed one-hour equality.
 * Does not check staff availability (Assignment phase).
 */
export async function detectConflicts(input: ConflictCheckInput): Promise<ConflictResult> {
  const window = resolveTimeWindow(input);
  const occupying = [...SLOT_OCCUPYING_STATUSES] as BookingStatus[];

  const dayRows = await db
    .select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      assetId: bookingsTable.assetId,
      serviceLocationId: bookingsTable.serviceLocationId,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
      scheduledStartAt: bookingsTable.scheduledStartAt,
      scheduledEndAt: bookingsTable.scheduledEndAt,
      durationMinutes: bookingsTable.durationMinutes,
      status: bookingsTable.status,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.scheduledDate, window.scheduledDate),
        inArray(bookingsTable.status, occupying),
        input.excludeBookingId != null
          ? ne(bookingsTable.id, input.excludeBookingId)
          : sql`true`,
      ),
    );

  const conflicts: ConflictResult["conflicts"] = [];

  for (const row of dayRows) {
    const other = rowWindow(row);
    if (!windowsOverlap(window.scheduledStartAt, window.scheduledEndAt, other.start, other.end)) {
      continue;
    }

    if (input.assetId && row.assetId === input.assetId) {
      conflicts.push({
        bookingId: row.id,
        reason: "Asset already has an overlapping booking",
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime,
        scheduledStartAt: other.start,
        scheduledEndAt: other.end,
      });
      continue;
    }

    if (input.serviceLocationId && row.serviceLocationId === input.serviceLocationId) {
      conflicts.push({
        bookingId: row.id,
        reason: "Service location already has an overlapping booking",
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime,
        scheduledStartAt: other.start,
        scheduledEndAt: other.end,
      });
      continue;
    }

    if (row.customerId === input.customerId) {
      conflicts.push({
        bookingId: row.id,
        reason: "Customer already has an overlapping booking",
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime,
        scheduledStartAt: other.start,
        scheduledEndAt: other.end,
      });
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}
