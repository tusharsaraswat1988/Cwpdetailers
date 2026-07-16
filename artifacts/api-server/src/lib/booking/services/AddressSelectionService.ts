import type { Logger } from "pino";
import { db, addressesTable, addressIdentitiesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { addressCapability } from "../../address";
import { validateServiceabilityForBooking, buildCoverageRequest } from "../../coverage";
import type { CoverageResult } from "../coverage/CoverageTypes";
import { buildBookingTraceContext } from "../correlation/BookingTraceContext";
import { flattenCoverageServices } from "./coverageServiceMapper";

export type AddressSelectionOption = {
  type: "current" | "saved" | "search" | "google" | "pin";
  addressId?: number;
  identityId?: number;
  label: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  isDefault?: boolean;
  verificationStatus?: string;
  confidenceScore?: number;
};

export type AddressSelectionResponse = {
  current?: AddressSelectionOption;
  saved: AddressSelectionOption[];
  traceId: string;
};

export type ValidateAddressSelectionInput = {
  customerId: number;
  addressId?: number;
  address?: string;
  locationLat?: number;
  locationLng?: number;
  placeId?: string;
  serviceId?: number;
  cityId?: number;
};

export type ValidateAddressSelectionResult = {
  valid: boolean;
  coverage?: CoverageResult;
  services?: Array<{ serviceId: number; serviceName: string; availability: string }>;
  addressOption?: AddressSelectionOption;
};

/** Backend APIs for intelligent address selection — no UI changes. */
export class AddressSelectionService {
  async getSelectionOptions(customerId: number, logger?: Logger): Promise<AddressSelectionResponse> {
    const trace = buildBookingTraceContext({ customerId });

    const savedRows = await db.select({
      id: addressesTable.id,
      identityId: addressesTable.identityId,
      nickname: addressesTable.nickname,
      formattedAddress: addressesTable.formattedAddress,
      latitude: addressesTable.latitude,
      longitude: addressesTable.longitude,
      placeId: addressesTable.placeId,
      isDefault: addressesTable.isDefault,
      verificationStatus: addressesTable.verificationStatus,
      confidenceScore: addressesTable.confidenceScore,
    }).from(addressesTable)
      .innerJoin(addressIdentitiesTable, eq(addressesTable.identityId, addressIdentitiesTable.id))
      .where(and(
        eq(addressesTable.customerId, customerId),
        eq(addressIdentitiesTable.status, "ACTIVE"),
      ))
      .orderBy(desc(addressesTable.isDefault), desc(addressesTable.updatedAt));

    const saved: AddressSelectionOption[] = savedRows.map((row) => ({
      type: "saved",
      addressId: row.id,
      identityId: row.identityId,
      label: row.nickname ?? row.formattedAddress ?? `Address #${row.id}`,
      formattedAddress: row.formattedAddress,
      latitude: row.latitude,
      longitude: row.longitude,
      placeId: row.placeId,
      isDefault: row.isDefault,
      verificationStatus: row.verificationStatus,
      confidenceScore: row.confidenceScore,
    }));

    const current = saved.find((s) => s.isDefault) ?? saved[0];

    logger?.debug({ customerId, savedCount: saved.length, traceId: trace.traceId }, "address selection options loaded");

    return {
      current: current ? { ...current, type: "current" } : undefined,
      saved,
      traceId: trace.traceId,
    };
  }

  async validateSelection(
    input: ValidateAddressSelectionInput,
    logger?: Logger,
  ): Promise<ValidateAddressSelectionResult> {
    const trace = buildBookingTraceContext({ customerId: input.customerId });

    let addressOption: AddressSelectionOption | undefined;
    let lat = input.locationLat;
    let lng = input.locationLng;
    let address = input.address;
    let placeId = input.placeId;

    if (input.addressId) {
      const result = await addressCapability.getAddress(input.addressId, { traceId: trace.traceId, logger });
      const ctx = result?.addressContext;
      if (ctx) {
        addressOption = {
          type: "saved",
          addressId: input.addressId,
          identityId: ctx.identity.id,
          label: ctx.currentAddress.nickname ?? ctx.currentAddress.formattedAddress ?? "",
          formattedAddress: ctx.currentAddress.formattedAddress,
          latitude: ctx.currentAddress.latitude,
          longitude: ctx.currentAddress.longitude,
          placeId: ctx.currentAddress.placeId,
          confidenceScore: ctx.addressConfidenceScore,
        };
        lat = ctx.currentAddress.latitude ?? lat;
        lng = ctx.currentAddress.longitude ?? lng;
        address = ctx.currentAddress.formattedAddress ?? address;
        placeId = ctx.currentAddress.placeId ?? placeId;
      }
    }

    const coverage = await validateServiceabilityForBooking(
      buildCoverageRequest({
        customerId: input.customerId,
        address,
        locationLat: lat,
        locationLng: lng,
        placeId,
        serviceId: input.serviceId,
        cityId: input.cityId,
      }),
      { requestSource: "address_selection", requestId: trace.requestId, traceId: trace.traceId },
      logger,
    );

    const services = flattenCoverageServices(coverage).map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      availability: s.availability,
    }));

    return {
      valid: coverage.success,
      coverage,
      services,
      addressOption,
    };
  }
}

export const addressSelectionService = new AddressSelectionService();
