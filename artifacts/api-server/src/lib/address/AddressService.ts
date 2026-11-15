import type { Logger } from "pino";
import type { Address } from "@workspace/db";
import { prepareAddress } from "./domain/AddressPreparation";
import { calculateAddressConfidenceFromPrepared } from "./confidence/AddressConfidenceScorer";
import { createAddressPolicy, updateAddressPolicy } from "./policies/CreateAddressPolicy";
import { mergePolicy } from "./policies/MergePolicy";
import { normalizationPolicyWithPreview } from "./policies/NormalizationPolicy";
import { deduplicationPolicy } from "./policies/DeduplicationPolicy";
import { validationPolicy } from "./policies/ValidationPolicy";
import type { AddressPolicyContext } from "./policies/types";
import { addressIdentityRepository } from "./repositories/AddressIdentityRepository";
import { addressRepository } from "./repositories/AddressRepository";
import { addressHistoryRepository } from "./repositories/AddressHistoryRepository";
import { addressLegacyLinkRepository } from "./repositories/AddressLegacyLinkRepository";
import {
  addressToSnapshotRecord,
  type AddressEntity,
  type CreateAddressInput,
  type DuplicateCandidate,
  type MergeDuplicateInput,
  type ParsedAddressPreview,
  type UpdateAddressInput,
} from "./types";
import type { AddressTraceContext } from "./correlation/AddressTraceContext";

export class AddressValidationError extends Error {
  constructor(
    message: string,
    public readonly coverageResult?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AddressValidationError";
  }
}

export class AddressDuplicateError extends Error {
  constructor(
    message: string,
    public readonly duplicates: DuplicateCandidate[],
  ) {
    super(message);
    this.name = "AddressDuplicateError";
  }
}

export type AddressServiceOptions = {
  trace?: AddressTraceContext;
  logger?: Logger;
  isLegacyMigrated?: boolean;
};

/** @internal — consume AddressCapability in future modules. */
export class AddressService {
  previewParsed(input: CreateAddressInput): ParsedAddressPreview {
    return normalizationPolicyWithPreview.preview(input);
  }

  normalize(input: CreateAddressInput): ParsedAddressPreview {
    return this.previewParsed(input);
  }

  async findDuplicates(input: CreateAddressInput, opts?: AddressServiceOptions): Promise<DuplicateCandidate[]> {
    const prepared = prepareAddress(input);
    const ctx: AddressPolicyContext = {
      trace: opts?.trace ?? { traceId: "", requestId: "", addressOperationId: "" },
      logger: opts?.logger,
      prepared,
    };
    const result = await deduplicationPolicy.execute(input, ctx);
    return result.duplicates;
  }

  async validateWithLocationIntelligence(input: CreateAddressInput, opts?: AddressServiceOptions) {
    const prepared = prepareAddress(input);
    const ctx: AddressPolicyContext = {
      trace: opts?.trace ?? { traceId: "", requestId: "", addressOperationId: "" },
      logger: opts?.logger,
      prepared,
    };
    const result = await validationPolicy.execute(input, ctx);
    return {
      success: result.success,
      message: result.message,
      locationContext: result.locationContext,
      confidenceScore: result.locationConfidenceScore,
      cityId: result.cityId,
    };
  }

  async create(
    input: CreateAddressInput,
    opts?: AddressServiceOptions,
  ): Promise<AddressEntity & { addressConfidenceScore: number }> {
    const prepared = prepareAddress(input);
    const ctx: AddressPolicyContext = {
      trace: opts?.trace ?? { traceId: "", requestId: "", addressOperationId: "" },
      logger: opts?.logger,
      prepared,
    };

    const { dedup, validation } = await createAddressPolicy.execute(input, ctx);
    if (dedup.blocked) {
      throw new AddressDuplicateError("Duplicate address detected", dedup.duplicates);
    }
    if (!validation.success) {
      throw new AddressValidationError(validation.message ?? "Address validation failed");
    }

    const addressConfidenceScore = calculateAddressConfidenceFromPrepared(prepared, {
      isLegacyMigrated: opts?.isLegacyMigrated ?? input.source === "IMPORTED",
    });

    if (validation.cityId && !prepared.merged.cityId) {
      prepared.merged.cityId = validation.cityId;
    }

    const identity = await addressIdentityRepository.create({
      customerId: input.customerId,
      canonicalPlaceId: prepared.merged.placeId ?? null,
      canonicalLatitude: prepared.merged.latitude ?? null,
      canonicalLongitude: prepared.merged.longitude ?? null,
      fingerprint: prepared.fingerprint,
      status: "ACTIVE",
    });

    if (input.isDefault) {
      await addressRepository.clearDefaultForCustomer(input.customerId);
    }

    let createZoneId = prepared.merged.zoneId ?? null;
    let createBranchId = prepared.merged.branchId ?? null;
    let createResolutionStatus = prepared.merged.resolutionStatus ?? null;
    let createServiceabilityStatus = validation.coverageStatus ?? prepared.merged.serviceabilityStatus ?? null;
    let createLocationContextSnapshot = validation.locationContext ?? null;
    let createConfidenceScore = validation.locationConfidenceScore ?? null;

    if (!createZoneId || !createBranchId) {
      try {
        const { locationResolver } = await import("../location-intelligence/resolver/LocationResolver");
        const { serviceabilityEngine } = await import("../location-intelligence/serviceability/ServiceabilityEngine");

        const resolved = await locationResolver.resolve({
          cityId: prepared.merged.cityId ?? undefined,
          societyId: prepared.merged.societyId ?? undefined,
          localityId: prepared.merged.localityId ?? undefined,
          propertyType: prepared.merged.propertyType ?? undefined,
          pincode: prepared.normalized.postalCode ?? undefined,
          locality: prepared.normalized.locality ?? undefined,
          sector: prepared.normalized.area ?? undefined,
          latitude: prepared.merged.latitude ?? undefined,
          longitude: prepared.merged.longitude ?? undefined,
          placeId: prepared.merged.placeId ?? undefined,
          formattedAddress: prepared.formattedAddress,
        });

        createZoneId = resolved.zoneId ?? createZoneId;
        createBranchId = resolved.branchId ?? createBranchId;
        createResolutionStatus = resolved.status;
        createConfidenceScore = resolved.confidence;

        const serv = await serviceabilityEngine.evaluate({
          cityId: resolved.cityId,
          branchId: resolved.branchId,
          zoneId: resolved.zoneId,
          societyId: resolved.societyId,
          localityId: resolved.localityId,
          pincode: prepared.normalized.postalCode ?? undefined,
          propertyType: resolved.propertyType,
          serviceId: input.serviceId,
          resolvedLocation: resolved,
        });

        createServiceabilityStatus = serv.status;
        createLocationContextSnapshot = {
          resolution: resolved,
          serviceability: serv,
        };
      } catch {
        // Fallback gracefully
      }
    }

    const address = await addressRepository.create({
      identityId: identity.id,
      customerId: input.customerId,
      version: 1,
      nickname: prepared.normalized.nickname ?? prepared.merged.nickname ?? null,
      addressType: prepared.merged.addressType ?? "HOME",
      houseNumber: prepared.normalized.houseNumber,
      buildingName: prepared.normalized.buildingName,
      floor: prepared.normalized.floor,
      apartment: prepared.normalized.apartment,
      street: prepared.normalized.street,
      landmark: prepared.normalized.landmark,
      area: prepared.normalized.area,
      locality: prepared.normalized.locality,
      subLocality: prepared.normalized.subLocality,
      cityId: prepared.merged.cityId ?? null,
      district: prepared.normalized.district,
      stateId: prepared.merged.stateId ?? null,
      country: prepared.normalized.country ?? "India",
      postalCode: prepared.normalized.postalCode,
      latitude: prepared.merged.latitude ?? null,
      longitude: prepared.merged.longitude ?? null,
      placeId: prepared.merged.placeId ?? null,
      formattedAddress: prepared.formattedAddress,
      plusCode: prepared.normalized.plusCode,
      addressComponents: prepared.merged.addressComponents ?? null,
      instructions: prepared.merged.instructions ?? null,
      normalizedAddress: prepared.normalizedKey,
      isDefault: input.isDefault ?? false,
      verificationStatus: input.verificationStatus ?? prepared.verification,
      source: input.source ?? prepared.source,
      confidenceScore: createConfidenceScore,
      locationContextSnapshot: createLocationContextSnapshot,
      propertyType: prepared.merged.propertyType ?? "OTHER",
      localityId: prepared.merged.localityId ?? null,
      societyId: prepared.merged.societyId ?? null,
      towerId: prepared.merged.towerId ?? null,
      zoneId: createZoneId,
      branchId: createBranchId,
      serviceabilityStatus: createServiceabilityStatus,
      resolutionStatus: createResolutionStatus,
      isCurrent: true,
    });

    return { identity, address, addressConfidenceScore };
  }

  async update(
    addressId: number,
    input: UpdateAddressInput,
    opts?: AddressServiceOptions,
  ): Promise<AddressEntity & { addressConfidenceScore: number; previousVersion: number }> {
    const existing = await addressRepository.findEntityById(addressId);
    if (!existing || existing.address.deletedAt) {
      throw new Error("Address not found");
    }

    const cityIdChanged = input.cityId !== undefined && input.cityId !== existing.address.cityId;
    const effectivePropertyType = input.propertyType !== undefined
      ? (input.propertyType as any)
      : (existing.address.propertyType ?? "OTHER");
    const propertyTypeSwitchedToIndividual =
      effectivePropertyType === "INDIVIDUAL_HOME" || effectivePropertyType === "COMMERCIAL_PROPERTY";

    // Clear stale society/tower/zone when switching property type or city
    let effectiveSocietyId: number | null = input.societyId !== undefined
      ? input.societyId
      : propertyTypeSwitchedToIndividual || cityIdChanged
        ? null
        : (existing.address.societyId ?? null);

    let effectiveTowerId: number | null = input.towerId !== undefined
      ? input.towerId
      : propertyTypeSwitchedToIndividual || cityIdChanged
        ? null
        : (existing.address.towerId ?? null);

    let effectiveLocalityId: number | null = input.localityId !== undefined
      ? input.localityId
      : cityIdChanged
        ? null
        : (existing.address.localityId ?? null);

    const mergedInput: CreateAddressInput = {
      customerId: existing.address.customerId,
      nickname: input.nickname !== undefined ? input.nickname : existing.address.nickname,
      addressType: input.addressType !== undefined ? input.addressType : existing.address.addressType,
      houseNumber: input.houseNumber !== undefined ? input.houseNumber : existing.address.houseNumber,
      buildingName: input.buildingName !== undefined ? input.buildingName : existing.address.buildingName,
      floor: input.floor !== undefined ? input.floor : existing.address.floor,
      apartment: input.apartment !== undefined ? input.apartment : existing.address.apartment,
      street: input.street !== undefined ? input.street : existing.address.street,
      landmark: input.landmark !== undefined ? input.landmark : existing.address.landmark,
      area: input.area !== undefined ? input.area : existing.address.area,
      locality: input.locality !== undefined ? input.locality : existing.address.locality,
      subLocality: input.subLocality !== undefined ? input.subLocality : existing.address.subLocality,
      cityId: input.cityId !== undefined ? input.cityId : existing.address.cityId,
      district: input.district !== undefined ? input.district : existing.address.district,
      stateId: input.stateId !== undefined ? input.stateId : existing.address.stateId,
      country: input.country !== undefined ? input.country : existing.address.country,
      postalCode: input.postalCode !== undefined ? input.postalCode : existing.address.postalCode,
      latitude: input.latitude !== undefined ? input.latitude : existing.address.latitude,
      longitude: input.longitude !== undefined ? input.longitude : existing.address.longitude,
      placeId: input.placeId !== undefined ? input.placeId : existing.address.placeId,
      formattedAddress: input.formattedAddress !== undefined ? input.formattedAddress : existing.address.formattedAddress,
      plusCode: input.plusCode !== undefined ? input.plusCode : existing.address.plusCode,
      addressComponents:
        input.addressComponents !== undefined
          ? input.addressComponents
          : (existing.address.addressComponents as CreateAddressInput["addressComponents"]),
      instructions: input.instructions !== undefined ? input.instructions : existing.address.instructions,
      isDefault: input.isDefault !== undefined ? input.isDefault : existing.address.isDefault,
      verificationStatus: input.verificationStatus !== undefined ? input.verificationStatus : existing.address.verificationStatus,
      source: input.source !== undefined ? input.source : existing.address.source,
      validateCoverage: input.validateCoverage,
      serviceId: input.serviceId,
      propertyType: effectivePropertyType,
      localityId: effectiveLocalityId,
      societyId: effectiveSocietyId,
      towerId: effectiveTowerId,
      zoneId: cityIdChanged ? null : (input.zoneId !== undefined ? input.zoneId : existing.address.zoneId),
      branchId: cityIdChanged ? null : (input.branchId !== undefined ? input.branchId : existing.address.branchId),
      allowDuplicate: true,
    };

    const prepared = prepareAddress(mergedInput);
    const ctx: AddressPolicyContext = {
      trace: opts?.trace ?? { traceId: "", requestId: "", addressOperationId: "" },
      logger: opts?.logger,
      prepared,
    };

    const validation = await updateAddressPolicy.execute(
      { ...input, customerId: existing.address.customerId },
      ctx,
    );
    if ("success" in validation && validation.success === false) {
      throw new AddressValidationError(validation.message ?? "Address validation failed");
    }

    // Dynamic Location Intelligence Recalculation on Address Edit
    let resolvedZoneId: number | null = mergedInput.zoneId ?? null;
    let resolvedBranchId: number | null = mergedInput.branchId ?? null;
    let resolvedStatus: string | null = input.resolutionStatus ?? existing.address.resolutionStatus ?? null;
    let resolvedServiceabilityStatus: string | null = input.serviceabilityStatus ?? existing.address.serviceabilityStatus ?? null;
    let locationContextSnapshot = existing.address.locationContextSnapshot as Record<string, unknown> | null;
    let locationConfidence = existing.address.confidenceScore;

    try {
      const { locationResolver } = await import("../location-intelligence/resolver/LocationResolver");
      const { serviceabilityEngine } = await import("../location-intelligence/serviceability/ServiceabilityEngine");

      const resolved = await locationResolver.resolve({
        cityId: mergedInput.cityId ?? undefined,
        societyId: effectiveSocietyId ?? undefined,
        localityId: effectiveLocalityId ?? undefined,
        propertyType: effectivePropertyType,
        pincode: prepared.normalized.postalCode ?? undefined,
        locality: prepared.normalized.locality ?? undefined,
        sector: prepared.normalized.area ?? undefined,
        latitude: prepared.merged.latitude ?? undefined,
        longitude: prepared.merged.longitude ?? undefined,
        placeId: prepared.merged.placeId ?? undefined,
        formattedAddress: prepared.formattedAddress,
      });

      resolvedZoneId = resolved.zoneId ?? resolvedZoneId;
      resolvedBranchId = resolved.branchId ?? resolvedBranchId;
      resolvedStatus = resolved.status;
      locationConfidence = resolved.confidence;

      const serv = await serviceabilityEngine.evaluate({
        cityId: resolved.cityId,
        branchId: resolved.branchId,
        zoneId: resolved.zoneId,
        societyId: resolved.societyId,
        localityId: resolved.localityId,
        pincode: prepared.normalized.postalCode ?? undefined,
        propertyType: resolved.propertyType,
        serviceId: input.serviceId,
        resolvedLocation: resolved,
      });

      resolvedServiceabilityStatus = serv.status;
      locationContextSnapshot = {
        resolution: resolved,
        serviceability: serv,
        recalculatedAt: new Date().toISOString(),
      };
    } catch {
      // Retain existing if resolution engines fail gracefully
    }

    if (input.validateCoverage && validation && "locationContext" in validation) {
      locationContextSnapshot = validation.locationContext ?? locationContextSnapshot;
      locationConfidence = validation.locationConfidenceScore ?? locationConfidence;
    }

    const addressConfidenceScore = calculateAddressConfidenceFromPrepared(prepared);

    await addressRepository.markNotCurrent(existing.address.id);
    if (input.isDefault) {
      await addressRepository.clearDefaultForCustomer(existing.address.customerId);
    }

    const newVersion = existing.address.version + 1;
    const address = await addressRepository.create({
      identityId: existing.identity.id,
      customerId: existing.address.customerId,
      version: newVersion,
      nickname: prepared.normalized.nickname ?? prepared.merged.nickname ?? null,
      addressType: prepared.merged.addressType ?? existing.address.addressType,
      houseNumber: prepared.normalized.houseNumber,
      buildingName: prepared.normalized.buildingName,
      floor: prepared.normalized.floor,
      apartment: prepared.normalized.apartment,
      street: prepared.normalized.street,
      landmark: prepared.normalized.landmark,
      area: prepared.normalized.area,
      locality: prepared.normalized.locality,
      subLocality: prepared.normalized.subLocality,
      cityId: prepared.merged.cityId ?? existing.address.cityId,
      district: prepared.normalized.district,
      stateId: prepared.merged.stateId ?? existing.address.stateId,
      country: prepared.normalized.country ?? "India",
      postalCode: prepared.normalized.postalCode,
      latitude: prepared.merged.latitude ?? null,
      longitude: prepared.merged.longitude ?? null,
      placeId: prepared.merged.placeId ?? null,
      formattedAddress: prepared.formattedAddress,
      plusCode: prepared.normalized.plusCode,
      addressComponents: prepared.merged.addressComponents ?? existing.address.addressComponents,
      instructions: prepared.merged.instructions ?? existing.address.instructions,
      normalizedAddress: prepared.normalizedKey,
      isDefault: input.isDefault ?? existing.address.isDefault,
      verificationStatus: input.verificationStatus ?? prepared.verification,
      source: input.source ?? prepared.source,
      confidenceScore: locationConfidence,
      locationContextSnapshot,
      propertyType: effectivePropertyType,
      localityId: effectiveLocalityId,
      societyId: effectiveSocietyId,
      towerId: effectiveTowerId,
      zoneId: resolvedZoneId,
      branchId: resolvedBranchId,
      serviceabilityStatus: resolvedServiceabilityStatus,
      resolutionStatus: resolvedStatus,
      isCurrent: true,
    });

    await addressHistoryRepository.append({
      identityId: existing.identity.id,
      addressId: existing.address.id,
      customerId: existing.address.customerId,
      version: existing.address.version,
      snapshot: addressToSnapshotRecord(existing.address),
      changeReason: input.changeReason,
      supersededByAddressId: address.id,
    });

    return {
      identity: existing.identity,
      address,
      addressConfidenceScore,
      previousVersion: existing.address.version,
    };
  }

  async get(addressId: number) {
    return addressRepository.findEntityById(addressId);
  }

  async list(customerId: number, opts?: { includeDeleted?: boolean; includeArchived?: boolean }) {
    const rows = await addressRepository.listByCustomer(customerId, opts);
    const entities: AddressEntity[] = [];
    for (const row of rows) {
      const identity = await addressIdentityRepository.findById(row.identityId);
      if (identity) entities.push({ identity, address: row });
    }
    return entities;
  }

  async setDefault(addressId: number) {
    const entity = await addressRepository.findEntityById(addressId);
    if (!entity || entity.address.deletedAt) throw new Error("Address not found");
    await addressRepository.clearDefaultForCustomer(entity.address.customerId);
    const address = await addressRepository.update(addressId, { isDefault: true });
    return { identity: entity.identity, address };
  }

  async softDelete(addressId: number): Promise<Address> {
    return addressRepository.softDelete(addressId);
  }

  async restore(addressId: number): Promise<Address> {
    return addressRepository.restore(addressId);
  }

  async archive(addressId: number): Promise<Address> {
    return addressRepository.archive(addressId);
  }

  async getHistory(identityId: number) {
    return addressHistoryRepository.listByIdentity(identityId);
  }

  async mergeDuplicates(input: MergeDuplicateInput) {
    return mergePolicy.execute(input, { trace: { traceId: "", requestId: "", addressOperationId: "" } });
  }

  async resolveLegacyLink(legacyTable: string, legacyId: number) {
    return addressLegacyLinkRepository.findByLegacy(legacyTable, legacyId);
  }
}

/** @internal */
export const addressService = new AddressService();
