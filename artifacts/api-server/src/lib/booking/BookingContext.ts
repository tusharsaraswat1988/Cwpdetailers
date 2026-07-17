import type { Booking, BookingStatus, BookingType } from "@workspace/db";
import type { AddressContext } from "../address/AddressContext";
import type { LocationContext } from "../location-intelligence/LocationContext";
import type { CoverageResult } from "../coverage/CoverageTypes";
import { BOOKING_DOMAIN_VERSION } from "./versioning";
import type { BookingTraceContext } from "./correlation/BookingTraceContext";

export type BookingRecordSummary = {
  id: number;
  customerId: number;
  contractRegistryId?: number | null;
  serviceId?: number | null;
  serviceType: string;
  bookingType?: BookingType | string;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: BookingStatus | string;
  assetId?: number | null;
  serviceLocationId?: number | null;
  branchId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
  addressIdentityId?: number | null;
  addressSnapshotId?: number | null;
};

export type BookingScheduleContext = {
  scheduledDate: string;
  scheduledTime?: string | null;
  scheduledStartAt?: Date | null;
  scheduledEndAt?: Date | null;
  durationMinutes?: number | null;
};

export type BookingTimelineEntry = {
  id: number;
  eventType: string;
  title: string;
  description?: string | null;
  createdAt: Date;
};

export type BookingContext = {
  booking: BookingRecordSummary;
  customer?: { id: number; name?: string; phone?: string };
  addressContext?: AddressContext | null;
  locationContext?: LocationContext | Record<string, unknown> | null;
  coverageResult?: CoverageResult | null;
  schedule: BookingScheduleContext;
  timeline?: BookingTimelineEntry[];
  state: {
    status: string;
  };
  metadata: {
    version: typeof BOOKING_DOMAIN_VERSION;
    [key: string]: unknown;
  };
  correlation: BookingTraceContext;
};

export function buildBookingContext(input: {
  booking: Booking | BookingRecordSummary;
  correlation: BookingTraceContext;
  addressContext?: AddressContext | null;
  locationContext?: LocationContext | Record<string, unknown> | null;
  coverageResult?: CoverageResult | null;
  customer?: { id: number; name?: string; phone?: string };
  timeline?: BookingTimelineEntry[];
}): BookingContext {
  const b = input.booking as Booking;
  return {
    booking: {
      id: b.id,
      customerId: b.customerId,
      contractRegistryId: b.contractRegistryId,
      serviceId: b.serviceId,
      serviceType: b.serviceType,
      bookingType: b.bookingType,
      scheduledDate: String(b.scheduledDate),
      scheduledTime: b.scheduledTime,
      status: b.status,
      assetId: b.assetId,
      serviceLocationId: b.serviceLocationId,
      branchId: b.branchId,
      companyId: b.companyId,
      franchiseeId: b.franchiseeId,
      addressIdentityId: b.addressIdentityId,
      addressSnapshotId: b.addressSnapshotId,
    },
    customer: input.customer,
    addressContext: input.addressContext,
    locationContext: input.locationContext ?? input.addressContext?.locationContext,
    coverageResult: input.coverageResult,
    schedule: {
      scheduledDate: String(b.scheduledDate),
      scheduledTime: b.scheduledTime,
      scheduledStartAt: b.scheduledStartAt ?? null,
      scheduledEndAt: b.scheduledEndAt ?? null,
      durationMinutes: b.durationMinutes ?? null,
    },
    timeline: input.timeline,
    state: {
      status: b.status,
    },
    metadata: {
      version: BOOKING_DOMAIN_VERSION,
      bookingOperationId: input.correlation.bookingOperationId,
    },
    correlation: input.correlation,
  };
}
