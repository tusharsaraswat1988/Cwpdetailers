import { and, eq, inArray, sql } from "drizzle-orm";
import { db, bookingsTable, type BookingStatus } from "@workspace/db";
import { SLOT_OCCUPYING_STATUSES } from "../domain/stateMachine";
import { checkSlotCapacity } from "./CapacityPolicy";
import {
  generateCandidateStarts,
  resolveTimeWindow,
  windowsOverlap,
  DOMAIN_DEFAULT_DURATION_MINUTES,
} from "./TimeWindow";
import type { SlotProvider } from "../extensions/interfaces";
import type { BookingContext } from "../BookingContext";

export type SlotQuery = {
  date: string;
  branchId?: number | null;
  assetId?: number | null;
  serviceLocationId?: number | null;
  customerId?: number | null;
  cityId?: number | null;
  /** Requested service duration for candidate evaluation. */
  durationMinutes?: number | null;
  /** Discovery grid step — not a domain duration assumption. */
  stepMinutes?: number;
  now?: Date;
};

export type AvailableSlot = {
  time: string;
  available: boolean;
  remaining: number;
  reason?: string;
  /** Resolved end for this candidate given durationMinutes. */
  endsAt?: string;
};

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

function todayIso(now = new Date()): string {
  return now.toISOString().split("T")[0];
}

function isSunday(dateStr: string): boolean {
  return parseLocalDate(dateStr).getDay() === 0;
}

/**
 * Server-side slot availability using variable duration windows.
 * Capacity comes from CapacityProvider. Does NOT check staff availability.
 */
export async function getAvailableSlots(query: SlotQuery): Promise<AvailableSlot[]> {
  const now = query.now ?? new Date();
  const durationMinutes = query.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES;
  const candidates = generateCandidateStarts(query.date, {
    stepMinutes: query.stepMinutes ?? 60,
  });

  if (isSunday(query.date)) {
    return candidates.map((time) => ({
      time,
      available: false,
      remaining: 0,
      reason: "CWP is closed on Sundays",
    }));
  }

  const occupying = [...SLOT_OCCUPYING_STATUSES] as BookingStatus[];
  const dayBookings = await db
    .select({
      id: bookingsTable.id,
      scheduledTime: bookingsTable.scheduledTime,
      scheduledStartAt: bookingsTable.scheduledStartAt,
      scheduledEndAt: bookingsTable.scheduledEndAt,
      durationMinutes: bookingsTable.durationMinutes,
      assetId: bookingsTable.assetId,
      serviceLocationId: bookingsTable.serviceLocationId,
      customerId: bookingsTable.customerId,
      branchId: bookingsTable.branchId,
      scheduledDate: bookingsTable.scheduledDate,
    })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.scheduledDate, query.date),
        inArray(bookingsTable.status, occupying),
        query.branchId != null ? eq(bookingsTable.branchId, query.branchId) : sql`true`,
      ),
    );

  const isToday = query.date === todayIso(now);
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  const results: AvailableSlot[] = [];

  for (const time of candidates) {
    const [hStr, mStr] = time.split(":");
    const hour = parseInt(hStr ?? "0", 10);
    const minute = parseInt(mStr ?? "0", 10);
    if (isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute))) {
      results.push({ time, available: false, remaining: 0, reason: "Time slot has passed" });
      continue;
    }

    let candidate;
    try {
      candidate = resolveTimeWindow({
        scheduledDate: query.date,
        scheduledTime: time,
        durationMinutes,
      });
    } catch {
      results.push({ time, available: false, remaining: 0, reason: "Invalid time" });
      continue;
    }

    const overlapping = dayBookings.filter((b) => {
      const start = b.scheduledStartAt
        ?? resolveTimeWindow({
          scheduledDate: b.scheduledDate,
          scheduledTime: b.scheduledTime,
          durationMinutes: b.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES,
        }).scheduledStartAt;
      const end = b.scheduledEndAt
        ?? new Date(start.getTime() + (b.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES) * 60_000);
      return windowsOverlap(candidate.scheduledStartAt, candidate.scheduledEndAt, start, end);
    });

    const capacity = await checkSlotCapacity({
      branchId: query.branchId,
      scheduledDate: query.date,
      scheduledTime: time,
      cityId: query.cityId,
      currentCount: overlapping.length,
    });

    if (!capacity.available) {
      results.push({
        time,
        available: false,
        remaining: 0,
        reason: "Slot is at capacity",
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
      continue;
    }

    if (query.assetId != null && overlapping.some((b) => b.assetId === query.assetId)) {
      results.push({
        time,
        available: false,
        remaining: capacity.remaining,
        reason: "Asset already booked in this window",
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
      continue;
    }

    if (
      query.serviceLocationId != null
      && overlapping.some((b) => b.serviceLocationId === query.serviceLocationId)
    ) {
      results.push({
        time,
        available: false,
        remaining: capacity.remaining,
        reason: "Location already booked in this window",
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
      continue;
    }

    if (query.customerId != null && overlapping.some((b) => b.customerId === query.customerId)) {
      results.push({
        time,
        available: false,
        remaining: capacity.remaining,
        reason: "Customer already has a booking in this window",
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
      continue;
    }

    results.push({
      time,
      available: true,
      remaining: capacity.remaining,
      endsAt: candidate.scheduledEndAt.toISOString(),
    });
  }

  return results;
}

/** @deprecated Prefer generateCandidateStarts — kept for import compat. */
export const BOOKING_TIME_SLOTS = generateCandidateStarts("1970-01-01") as readonly string[];

export const bookingSlotProvider: SlotProvider = {
  providerId: "booking-slot-v1",
  async getAvailableSlots(context: BookingContext, date: string) {
    const slots = await getAvailableSlots({
      date,
      branchId: context.booking.branchId,
      assetId: context.booking.assetId,
      serviceLocationId: context.booking.serviceLocationId,
      customerId: context.booking.customerId,
      durationMinutes: context.schedule.durationMinutes,
    });
    return slots.map((s) => ({ time: s.time, available: s.available }));
  },
};
