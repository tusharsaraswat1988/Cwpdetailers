/**
 * SchedulingDomainService — single orchestration point for all scheduling concerns.
 * Conflict, capacity, slots, duplicates, and time-window resolution go through here.
 * BookingService must not call ConflictDetector/SlotService directly.
 */

import type { ScheduleProvider } from "../extensions/interfaces";
import type { BookingContext } from "../BookingContext";
import { detectConflicts, type ConflictCheckInput, type ConflictResult } from "./ConflictDetector";
import { assertNoDuplicateBooking } from "./DuplicateBookingGuard";
import { checkSlotCapacity } from "./CapacityPolicy";
import { getAvailableSlots, type SlotQuery, type AvailableSlot } from "./SlotService";
import {
  resolveTimeWindow,
  type TimeWindowInput,
  type ResolvedTimeWindow,
  DOMAIN_DEFAULT_DURATION_MINUTES,
} from "./TimeWindow";
import { getCapacityProvider } from "./CapacityProvider";
import { and, eq, inArray, sql, ne } from "drizzle-orm";
import { db, bookingsTable, type BookingStatus } from "@workspace/db";
import { SLOT_OCCUPYING_STATUSES } from "../domain/stateMachine";

export type ValidateScheduleInput = TimeWindowInput & {
  customerId: number;
  assetId?: number | null;
  serviceLocationId?: number | null;
  branchId?: number | null;
  cityId?: number | null;
  excludeBookingId?: number;
};

export type ValidateScheduleResult = {
  valid: boolean;
  error?: string;
  window?: ResolvedTimeWindow;
  conflicts?: ConflictResult["conflicts"];
};

export class SchedulingDomainService {
  resolveWindow(input: TimeWindowInput): ResolvedTimeWindow {
    return resolveTimeWindow(input);
  }

  async validate(input: ValidateScheduleInput): Promise<ValidateScheduleResult> {
    if (!input.scheduledDate && !input.scheduledStartAt) {
      return { valid: false, error: "scheduledDate or scheduledStartAt is required" };
    }

    let window: ResolvedTimeWindow;
    try {
      window = resolveTimeWindow(input);
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Invalid time window" };
    }

    const date = new Date(`${window.scheduledDate}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return { valid: false, error: "Invalid scheduledDate" };
    }
    if (date.getDay() === 0) {
      return { valid: false, error: "CWP is closed on Sundays" };
    }

    const hour = window.scheduledStartAt.getHours();
    if (hour < 6 || hour >= 22) {
      return { valid: false, error: "Booking time must be between 06:00 and 22:00" };
    }

    try {
      await assertNoDuplicateBooking({
        customerId: input.customerId,
        assetId: input.assetId,
        scheduledDate: window.scheduledDate,
        scheduledTime: window.scheduledTime,
        scheduledStartAt: window.scheduledStartAt,
        scheduledEndAt: window.scheduledEndAt,
        durationMinutes: window.durationMinutes,
        excludeBookingId: input.excludeBookingId,
      });
    } catch (err) {
      return { valid: false, error: err instanceof Error ? err.message : "Duplicate booking" };
    }

    const conflicts = await detectConflicts({
      scheduledDate: window.scheduledDate,
      scheduledTime: window.scheduledTime,
      scheduledStartAt: window.scheduledStartAt,
      scheduledEndAt: window.scheduledEndAt,
      durationMinutes: window.durationMinutes,
      customerId: input.customerId,
      assetId: input.assetId,
      serviceLocationId: input.serviceLocationId,
      excludeBookingId: input.excludeBookingId,
    });

    if (conflicts.hasConflict) {
      return {
        valid: false,
        error: conflicts.conflicts[0]?.reason ?? "Scheduling conflict",
        conflicts: conflicts.conflicts,
      };
    }

    if (input.branchId != null) {
      const occupying = [...SLOT_OCCUPYING_STATUSES] as BookingStatus[];
      const dayRows = await db
        .select({
          id: bookingsTable.id,
          scheduledDate: bookingsTable.scheduledDate,
          scheduledTime: bookingsTable.scheduledTime,
          scheduledStartAt: bookingsTable.scheduledStartAt,
          scheduledEndAt: bookingsTable.scheduledEndAt,
          durationMinutes: bookingsTable.durationMinutes,
        })
        .from(bookingsTable)
        .where(
          and(
            eq(bookingsTable.scheduledDate, window.scheduledDate),
            eq(bookingsTable.branchId, input.branchId),
            inArray(bookingsTable.status, occupying),
            input.excludeBookingId != null
              ? ne(bookingsTable.id, input.excludeBookingId)
              : sql`true`,
          ),
        );

      let overlappingCount = 0;
      for (const row of dayRows) {
        const start = row.scheduledStartAt
          ?? resolveTimeWindow({
            scheduledDate: row.scheduledDate,
            scheduledTime: row.scheduledTime,
            durationMinutes: row.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES,
          }).scheduledStartAt;
        const end = row.scheduledEndAt
          ?? new Date(start.getTime() + (row.durationMinutes ?? DOMAIN_DEFAULT_DURATION_MINUTES) * 60_000);
        if (
          window.scheduledStartAt.getTime() < end.getTime()
          && start.getTime() < window.scheduledEndAt.getTime()
        ) {
          overlappingCount += 1;
        }
      }

      const capacity = await checkSlotCapacity({
        branchId: input.branchId,
        scheduledDate: window.scheduledDate,
        scheduledTime: window.scheduledTime,
        cityId: input.cityId,
        currentCount: overlappingCount,
      });
      if (!capacity.available) {
        return { valid: false, error: "Slot is at capacity for this branch", window };
      }
    }

    return { valid: true, window };
  }

  async getSlots(query: SlotQuery): Promise<AvailableSlot[]> {
    return getAvailableSlots(query);
  }

  async detectConflicts(input: ConflictCheckInput): Promise<ConflictResult> {
    return detectConflicts(input);
  }

  getCapacityProviderId(): string {
    return getCapacityProvider().providerId;
  }
}

export const schedulingDomainService = new SchedulingDomainService();

export const bookingScheduleProvider: ScheduleProvider = {
  providerId: "booking-schedule-v1",
  async validateSchedule(context: BookingContext) {
    const result = await schedulingDomainService.validate({
      scheduledDate: context.schedule.scheduledDate,
      scheduledTime: context.schedule.scheduledTime,
      scheduledStartAt: context.schedule.scheduledStartAt,
      scheduledEndAt: context.schedule.scheduledEndAt,
      durationMinutes: context.schedule.durationMinutes,
      customerId: context.booking.customerId,
      assetId: context.booking.assetId,
      serviceLocationId: context.booking.serviceLocationId,
      branchId: context.booking.branchId,
      excludeBookingId: context.booking.id,
    });
    return { valid: result.valid, error: result.error };
  },
};

export { detectConflicts } from "./ConflictDetector";
export type { ConflictCheckInput, ConflictResult } from "./ConflictDetector";
export { assertNoDuplicateBooking } from "./DuplicateBookingGuard";
export { checkSlotCapacity } from "./CapacityPolicy";
export {
  getCapacityProvider,
  setCapacityProvider,
  resetCapacityProvider,
  DefaultCapacityProvider,
} from "./CapacityProvider";
export type { CapacityProvider, CapacityContext } from "./CapacityProvider";
export { getAvailableSlots, BOOKING_TIME_SLOTS, bookingSlotProvider } from "./SlotService";
export type { SlotQuery, AvailableSlot } from "./SlotService";
export {
  resolveTimeWindow,
  windowsOverlap,
  generateCandidateStarts,
  DOMAIN_DEFAULT_DURATION_MINUTES,
} from "./TimeWindow";
export type { TimeWindowInput, ResolvedTimeWindow } from "./TimeWindow";

/** @deprecated Use schedulingDomainService.validate */
export async function validateSchedule(input: ValidateScheduleInput) {
  return schedulingDomainService.validate(input);
}
