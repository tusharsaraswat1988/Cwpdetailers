import type { Booking, BookingStatus, BookingType } from "@workspace/db";
import type { CoverageResult } from "../coverage/CoverageTypes";

export type CreateBookingInput = {
  customerId: number;
  contractRegistryId?: number | null;
  serviceLocationId?: number | null;
  assetId?: number | null;
  vehicleId?: number | null;
  solarSiteId?: number | null;
  serviceId?: number | null;
  branchId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
  /** Why this booking exists (default one_time). */
  bookingType?: BookingType;
  scheduledDate: string;
  scheduledTime?: string | null;
  /** Canonical window — preferred over date+time alone. */
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
  durationMinutes?: number | null;
  serviceType: string;
  address?: string | null;
  area?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  placeId?: string | null;
  savedLocationId?: number | null;
  addressId?: number | null;
  notes?: string | null;
  cityId?: number | null;
  citySlug?: string | null;
  cityName?: string | null;
  addressComponents?: unknown[];
  postalCode?: string | null;
  status?: BookingStatus;
  /** Skip coverage when caller already validated (e.g. Phase 5.1). */
  skipCoverageValidation?: boolean;
};

export type CreateBookingResult = {
  booking: Booking;
  coverage?: CoverageResult;
  addressSnapshotId?: number;
  addressIdentityId?: number;
  coverageValidationId?: string;
};

export type TransitionBookingInput = {
  bookingId: number;
  toStatus: BookingStatus;
  reason?: string;
  actorId?: number;
  actorName?: string;
};

export type RescheduleBookingInput = {
  bookingId: number;
  scheduledDate: string;
  scheduledTime?: string | null;
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
  durationMinutes?: number | null;
  reason?: string;
  actorId?: number;
  actorName?: string;
};

export type CancelBookingInput = {
  bookingId: number;
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
  return { ...booking };
}
