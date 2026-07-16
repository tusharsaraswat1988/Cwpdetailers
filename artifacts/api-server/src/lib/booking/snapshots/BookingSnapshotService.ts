import type { Logger } from "pino";
import type { CoverageResult } from "../../coverage/CoverageTypes";
import type { LocationContext } from "../../location-intelligence/LocationContext";
import { createBookingAddressSnapshot } from "../../address/AddressSnapshotService";
import { bookingSnapshotRepository } from "../repositories/BookingSnapshotRepository";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";

export type BookingSnapshotBundle = {
  addressSnapshotId?: number;
  addressIdentityId?: number;
  addressId?: number;
  locationSnapshotId?: number;
  coverageSnapshotId?: number;
  priceSnapshotId?: number;
};

export class BookingSnapshotService {
  async createAddressSnapshot(
    bookingId: number,
    addressId: number,
    trace: BookingTraceContext,
    logger?: Logger,
  ): Promise<BookingSnapshotBundle> {
    const anchor = await createBookingAddressSnapshot(addressId, logger);
    if (!anchor) return {};

    const snapshot = await bookingSnapshotRepository.create({
      bookingId,
      snapshotType: "ADDRESS",
      snapshotData: {
        addressSnapshotId: anchor.addressSnapshotId,
        addressIdentityId: anchor.addressIdentityId,
        addressId: anchor.addressId,
      },
      trace,
    });

    return {
      addressSnapshotId: anchor.addressSnapshotId,
      addressIdentityId: anchor.addressIdentityId,
      addressId: anchor.addressId,
      locationSnapshotId: snapshot.id,
    };
  }

  async createLocationSnapshot(
    bookingId: number,
    locationContext: LocationContext | Record<string, unknown>,
    trace: BookingTraceContext,
  ) {
    const snapshot = await bookingSnapshotRepository.create({
      bookingId,
      snapshotType: "LOCATION",
      snapshotData: locationContext as Record<string, unknown>,
      trace,
    });
    return snapshot.id;
  }

  async createCoverageSnapshot(
    bookingId: number,
    coverage: CoverageResult,
    trace: BookingTraceContext,
  ) {
    const snapshot = await bookingSnapshotRepository.create({
      bookingId,
      snapshotType: "COVERAGE",
      snapshotData: {
        success: coverage.success,
        status: coverage.status,
        coverageStatus: coverage.coverageStatus,
        validationId: coverage.correlation.coverageValidationId,
        resolvedCityId: coverage.resolvedCityId,
        availableServices: coverage.availableServices,
        comingSoonServices: coverage.comingSoonServices,
        unavailableServices: coverage.unavailableServices,
      },
      trace,
    });
    return snapshot.id;
  }

  async createPriceSnapshot(
    bookingId: number,
    priceData: Record<string, unknown>,
    trace: BookingTraceContext,
  ) {
    const snapshot = await bookingSnapshotRepository.create({
      bookingId,
      snapshotType: "PRICE",
      snapshotData: priceData,
      trace,
    });
    return snapshot.id;
  }

  async getSnapshots(bookingId: number) {
    return bookingSnapshotRepository.findByBookingId(bookingId);
  }
}

export const bookingSnapshotService = new BookingSnapshotService();
