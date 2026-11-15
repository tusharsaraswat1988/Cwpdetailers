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
import { operationalCalendarService } from "./operationalCalendarService";

export type SlotQuery = {
  date: string;
  branchId?: number | null;
  assetId?: number | null;
  serviceLocationId?: number | null;
  customerId?: number | null;
  cityId?: number | null;
  /** Service segment, e.g. 'daily_cleaning' or 'catalog_services' */
  segment?: string;
  /** Requested service duration for candidate evaluation (multiples of 15 min). */
  durationMinutes?: number | null;
  /** Discovery grid step (e.g. 15, 30, 60 minutes). */
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

function parseTimeStr(timeStr: string): { hour: number; minute: number } {
  const [hStr, mStr] = timeStr.split(":");
  return {
    hour: parseInt(hStr ?? "8", 10),
    minute: parseInt(mStr ?? "0", 10),
  };
}

function getTodayIST(now = new Date()): { dateStr: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const p: Record<string, string> = {};
  for (const part of parts) {
    p[part.type] = part.value;
  }
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  const hour = parseInt(p.hour ?? "0", 10);
  const minute = parseInt(p.minute ?? "0", 10);
  return { dateStr, hour, minute };
}

/**
 * Server-side slot availability using dynamic operational calendar,
 * dynamic operating hours, and variable 15-minute duration windows.
 */
export async function getAvailableSlots(query: SlotQuery): Promise<AvailableSlot[]> {
  const now = query.now ?? new Date();
  const durationMinutes = Math.max(15, query.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES);

  // Evaluate date in operational calendar (operating hours, govt holidays, weather calamity, closures)
  const dateEval = await operationalCalendarService.evaluateDate({
    date: query.date,
    cityId: query.cityId,
    branchId: query.branchId,
    segment: query.segment ?? "catalog_services",
  });

  const opHours = dateEval.operatingHours ?? {
    isWorkingDay: true,
    openTime: "08:00",
    closeTime: "18:00",
    slotStepMinutes: 15,
    maxConcurrentSlots: 8,
    scopeType: "default" as const,
  };

  const openTimeParsed = parseTimeStr(opHours.openTime);
  const closeTimeParsed = parseTimeStr(opHours.closeTime);
  const step = query.stepMinutes ?? opHours.slotStepMinutes ?? 15;

  const candidates = generateCandidateStarts(query.date, {
    fromHour: openTimeParsed.hour,
    fromMinute: openTimeParsed.minute,
    toHour: closeTimeParsed.hour,
    toMinute: closeTimeParsed.minute,
    stepMinutes: step,
  });

  // If entire day is closed, return all candidate slots with the exact reason
  if (dateEval.isClosed) {
    const closureReason = dateEval.reason ?? "CWP operations are closed on this date";
    return candidates.map((time) => ({
      time,
      available: false,
      remaining: 0,
      reason: closureReason,
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

  const { dateStr: todayIST, hour: currentHour, minute: currentMinute } = getTodayIST(now);
  const isToday = query.date === todayIST;

  const partialClosure = dateEval.closure && !dateEval.closure.isFullDay ? dateEval.closure : null;
  const partialStart = partialClosure?.startTime ? parseTimeStr(partialClosure.startTime) : null;
  const partialEnd = partialClosure?.endTime ? parseTimeStr(partialClosure.endTime) : null;

  const results: AvailableSlot[] = [];

  for (const time of candidates) {
    const [hStr, mStr] = time.split(":");
    const hour = parseInt(hStr ?? "0", 10);
    const minute = parseInt(mStr ?? "0", 10);

    // 1. Past time check (in IST)
    if (isToday && (hour < currentHour || (hour === currentHour && minute <= currentMinute))) {
      results.push({ time, available: false, remaining: 0, reason: "Time slot has passed" });
      continue;
    }

    // 2. Partial closure check (e.g. weather / equipment maintenance window)
    if (partialStart && partialEnd) {
      const slotMinutes = hour * 60 + minute;
      const startMinutes = partialStart.hour * 60 + partialStart.minute;
      const endMinutes = partialEnd.hour * 60 + partialEnd.minute;
      if (slotMinutes >= startMinutes && slotMinutes < endMinutes) {
        results.push({
          time,
          available: false,
          remaining: 0,
          reason: partialClosure?.customerReason ?? "Operations temporarily suspended",
        });
        continue;
      }
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

    // 3. Operating hours boundary check: candidate end time cannot exceed closeTime
    const closeTotalMinutes = closeTimeParsed.hour * 60 + closeTimeParsed.minute;
    const endHour = candidate.scheduledEndAt.getHours();
    const endMinute = candidate.scheduledEndAt.getMinutes();
    const endTotalMinutes = endHour * 60 + endMinute;
    // Check if end spills past closing time on same day
    if (endTotalMinutes > closeTotalMinutes && candidate.scheduledEndAt.getDate() === candidate.scheduledStartAt.getDate()) {
      results.push({
        time,
        available: false,
        remaining: 0,
        reason: `Service duration (${durationMinutes}m) exceeds closing time (${opHours.closeTime})`,
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
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
        reason: "Fully booked (capacity reached)",
        endsAt: candidate.scheduledEndAt.toISOString(),
      });
      continue;
    }

    if (query.assetId != null && overlapping.some((b) => b.assetId === query.assetId)) {
      results.push({
        time,
        available: false,
        remaining: capacity.remaining,
        reason: "Vehicle already booked in this window",
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
