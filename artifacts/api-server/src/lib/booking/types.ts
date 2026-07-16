import type { InsertBooking, Booking } from "@workspace/db";
import type { CoverageResult } from "../coverage/CoverageTypes";

export type CreateBookingInput = {
  customerId: number;
  vehicleId?: number | null;
  solarSiteId?: number | null;
  subscriptionId?: number | null;
  serviceId?: number | null;
  staffId?: number | null;
  branchId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
  scheduledDate: string;
  scheduledTime?: string | null;
  serviceType: string;
  address?: string | null;
  area?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  placeId?: string | null;
  savedLocationId?: number | null;
  addressId?: number | null;
  notes?: string | null;
  amount?: string | null;
  recurrenceRule?: string | null;
  entitlementId?: number | null;
  addonIds?: number[];
  cityId?: number | null;
  citySlug?: string | null;
  cityName?: string | null;
  addressComponents?: unknown[];
  postalCode?: string | null;
  status?: InsertBooking["status"];
  platformStatus?: InsertBooking["platformStatus"];
  initialPlatformStatus?: InsertBooking["platformStatus"];
};

export type CreateBookingResult = {
  booking: Booking;
  coverage?: CoverageResult;
  addressSnapshotId?: number;
  addressIdentityId?: number;
  coverageValidationId?: string;
  confidenceScore?: number;
};

export type TransitionBookingInput = {
  bookingId: number;
  toLegacyStatus: string;
  reason?: string;
  actorId?: number;
  actorName?: string;
};

export class BookingValidationError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "BookingValidationError";
  }
}

export class BookingCoverageError extends BookingValidationError {
  constructor(message: string, public readonly coverage: CoverageResult) {
    super(message, coverage.status, coverage);
    this.name = "BookingCoverageError";
  }
}

export function bookingToPublicResponse(booking: Booking) {
  return {
    ...booking,
    platformStatus: booking.platformStatus ?? "DRAFT",
  };
}
