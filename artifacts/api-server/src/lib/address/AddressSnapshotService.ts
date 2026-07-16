import type { Logger } from "pino";
import type { Address } from "@workspace/db";
import { buildCoverageRequest } from "../coverage/parsers";
import { locationIntelligencePlatform } from "../location-intelligence/LocationIntelligencePlatform";
import {
  addressToSnapshotRecord,
  type CreateAddressInput,
  type AddressEntity,
} from "./types";
import { addressSnapshotRepository } from "./repositories/AddressSnapshotRepository";
import { addressCapability } from "./capability/AddressCapability";
import { buildAddressTraceContext } from "./correlation/AddressTraceContext";

export class AddressSnapshotService {
  async createFromAddress(
    entity: AddressEntity,
    reason: "BOOKING" | "CONTRACT" | "MANUAL" | "MIGRATION" | "API" = "API",
    logger?: Logger,
  ) {
    let locationContext: Record<string, unknown> | null =
      (entity.address.locationContextSnapshot as Record<string, unknown> | null) ?? null;
    let coverageValidationId: string | undefined;

    if (!locationContext) {
      const coverage = await locationIntelligencePlatform.validateCoverage(
        buildCoverageRequest({
          address: entity.address.formattedAddress ?? undefined,
          locationLat: entity.address.latitude,
          locationLng: entity.address.longitude,
          placeId: entity.address.placeId,
          postalCode: entity.address.postalCode,
          cityId: entity.address.cityId,
          addressComponents: entity.address.addressComponents as never,
          customerId: entity.address.customerId,
        }),
        { requestSource: "address_snapshot", includeServiceCatalog: false },
        logger,
      );
      locationContext = coverage.locationContext as Record<string, unknown> | null;
      coverageValidationId = coverage.correlation.coverageValidationId;
    }

    const result = await addressSnapshotRepository.create({
      identityId: entity.identity.id,
      addressId: entity.address.id,
      customerId: entity.address.customerId,
      version: entity.address.version,
      snapshot: addressToSnapshotRecord(entity.address),
      locationContext,
      coverageValidationId,
      snapshotReason: reason,
    });

    addressCapability.publishSnapshotCreated(
      buildAddressTraceContext({
        identityId: entity.identity.id,
        addressId: entity.address.id,
        customerId: entity.address.customerId,
      }),
      result.snapshot.id,
      reason,
      logger,
    );

    return result;
  }

  async createFromAddressId(addressId: number, reason: "BOOKING" | "CONTRACT" | "MANUAL" | "API" = "API", logger?: Logger) {
    const { addressRepository } = await import("./repositories/AddressRepository");
    const entity = await addressRepository.findEntityById(addressId);
    if (!entity) throw new Error("Address not found");
    return this.createFromAddress(entity, reason, logger);
  }

  snapshotToBookingFields(snapshot: { data: Record<string, unknown> }) {
    const s = snapshot.data;
    return {
      address: String(s.formattedAddress ?? ""),
      area: (s.locality ?? s.area ?? null) as string | null,
      locationLat: s.latitude as number | null,
      locationLng: s.longitude as number | null,
      placeId: s.placeId as string | null,
      cityId: s.cityId as number | null,
    };
  }
}

export const addressSnapshotService = new AddressSnapshotService();

export type BookingSnapshotAnchor = {
  addressSnapshotId: number;
  addressIdentityId: number;
  addressId: number;
};

export async function createBookingAddressSnapshot(
  addressId: number,
  logger?: Logger,
): Promise<BookingSnapshotAnchor | null> {
  try {
    const result = await addressSnapshotService.createFromAddressId(addressId, "BOOKING", logger);
    return {
      addressSnapshotId: result.snapshot.id,
      addressIdentityId: result.snapshot.identityId,
      addressId: result.snapshot.addressId,
    };
  } catch {
    return null;
  }
}
