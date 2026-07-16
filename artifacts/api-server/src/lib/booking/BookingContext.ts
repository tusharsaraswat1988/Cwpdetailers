import type { Booking, BookingPlatformStatus } from "@workspace/db";
import type { AddressContext } from "../address/AddressContext";
import type { LocationContext } from "../location-intelligence/LocationContext";
import type { CoverageResult } from "../coverage/CoverageTypes";
import { BOOKING_DOMAIN_VERSION } from "./versioning";
import type { BookingTraceContext } from "./correlation/BookingTraceContext";

export type BookingRecordSummary = {
  id: number;
  customerId: number;
  serviceId?: number | null;
  serviceType: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  status: string;
  platformStatus: BookingPlatformStatus;
  staffId?: number | null;
  amount?: string | null;
  addressIdentityId?: number | null;
  addressSnapshotId?: number | null;
  coverageStatus?: string | null;
  coverageValidationId?: string | null;
  confidenceScore?: number | null;
};

export type BookingScheduleContext = {
  scheduledDate: string;
  scheduledTime?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

export type BookingPricingContext = {
  amount?: string | null;
  addonIds?: number[];
  entitlementId?: number | null;
  subscriptionId?: number | null;
  priceSnapshotId?: number | null;
};

export type BookingStaffContext = {
  staffId?: number | null;
  branchId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
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
  pricing: BookingPricingContext;
  staff: BookingStaffContext;
  timeline?: BookingTimelineEntry[];
  state: {
    platformStatus: BookingPlatformStatus;
    legacyStatus: string;
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
  const b = input.booking;
  const platformStatus = (b as Booking).platformStatus ?? "DRAFT";
  return {
    booking: {
      id: b.id,
      customerId: b.customerId,
      serviceId: b.serviceId,
      serviceType: b.serviceType,
      scheduledDate: String(b.scheduledDate),
      scheduledTime: b.scheduledTime,
      status: b.status,
      platformStatus,
      staffId: b.staffId,
      amount: b.amount,
      addressIdentityId: b.addressIdentityId,
      addressSnapshotId: b.addressSnapshotId,
      coverageStatus: (b as Booking).coverageStatus,
      coverageValidationId: (b as Booking).coverageValidationId,
      confidenceScore: (b as Booking).confidenceScore,
    },
    customer: input.customer,
    addressContext: input.addressContext,
    locationContext: input.locationContext
      ?? (b as Booking).locationContextSnapshot
      ?? input.addressContext?.locationContext,
    coverageResult: input.coverageResult,
    schedule: {
      scheduledDate: String(b.scheduledDate),
      scheduledTime: b.scheduledTime,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
    },
    pricing: {
      amount: b.amount,
      addonIds: (b as Booking).addonIds ?? [],
      entitlementId: b.entitlementId,
      subscriptionId: b.subscriptionId,
    },
    staff: {
      staffId: b.staffId,
      branchId: b.branchId,
      companyId: b.companyId,
      franchiseeId: b.franchiseeId,
    },
    timeline: input.timeline,
    state: {
      platformStatus,
      legacyStatus: b.status,
    },
    metadata: {
      version: BOOKING_DOMAIN_VERSION,
      bookingOperationId: input.correlation.bookingOperationId,
    },
    correlation: input.correlation,
  };
}
