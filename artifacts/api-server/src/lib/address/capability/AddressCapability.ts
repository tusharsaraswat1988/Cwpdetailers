import type { Logger } from "pino";
import { addressService } from "../AddressService";
import { buildAddressContext, type AddressContext } from "../AddressContext";
import { buildAddressTraceContext, type AddressTraceContext } from "../correlation/AddressTraceContext";
import { addressDomainEventPublisher } from "../domain/events/EventPublisher";
import { baseAddressEventFields } from "../domain/events/types";
import { buildAddressMetrics, emitAddressMetrics } from "../metrics/AddressMetrics";
import { calculateAddressConfidenceFromPrepared } from "../confidence/AddressConfidenceScorer";
import { prepareAddress } from "../domain/AddressPreparation";
import { repositoryAddressSearchProvider } from "../search/RepositorySearchProvider";
import { addressSearchRegistry } from "../search/types";
import { ADDRESS_CAPABILITY_VERSION } from "../versioning";
import {
  addressToPublicResponse,
  type CreateAddressInput,
  type UpdateAddressInput,
  type MergeDuplicateInput,
  type AddressEntity,
} from "../types";
import type { AddressSearchCriteria } from "../search/types";

addressSearchRegistry.repository = repositoryAddressSearchProvider;

export type AddressCapabilityOptions = {
  traceId?: string;
  requestId?: string;
  logger?: Logger;
};

export class AddressCapability {
  readonly version = ADDRESS_CAPABILITY_VERSION;

  private trace(opts?: AddressCapabilityOptions, extra?: Partial<AddressTraceContext>): AddressTraceContext {
    return buildAddressTraceContext({
      traceId: opts?.traceId,
      requestId: opts?.requestId,
      ...extra,
    });
  }

  private entityToContext(
    entity: AddressEntity,
    trace: AddressTraceContext,
    addressConfidenceScore: number,
  ): AddressContext {
    return buildAddressContext({
      identity: entity.identity,
      address: entity.address,
      addressConfidenceScore,
      locationConfidenceScore: entity.address.confidenceScore,
      correlation: {
        ...trace,
        identityId: entity.identity.id,
        addressId: entity.address.id,
        customerId: entity.address.customerId,
      },
    });
  }

  async createAddress(input: CreateAddressInput, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const trace = this.trace(opts, { customerId: input.customerId });
    try {
      const result = await addressService.create(input, { trace, logger: opts?.logger });
      const ctx = this.entityToContext(result, trace, result.addressConfidenceScore);
      const response = {
        ...addressToPublicResponse(result),
        addressConfidenceScore: result.addressConfidenceScore,
        addressContext: ctx,
      };

      addressDomainEventPublisher.publish(
        { ...baseAddressEventFields(trace), type: "AddressCreated", addressContext: ctx },
        opts?.logger,
      );
      emitAddressMetrics(opts?.logger, buildAddressMetrics("create", trace, {
        success: true,
        durationMs: Date.now() - started,
        addressConfidenceScore: result.addressConfidenceScore,
        locationConfidenceScore: result.address.confidenceScore,
      }));

      return response;
    } catch (err) {
      emitAddressMetrics(opts?.logger, buildAddressMetrics("create", trace, {
        success: false,
        durationMs: Date.now() - started,
        failureReason: err instanceof Error ? err.message : "unknown",
      }));
      throw err;
    }
  }

  async updateAddress(addressId: number, input: UpdateAddressInput, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const trace = this.trace(opts, { addressId });
    try {
      const result = await addressService.update(addressId, input, { trace, logger: opts?.logger });
      const fullTrace = {
        ...trace,
        identityId: result.identity.id,
        addressId: result.address.id,
        customerId: result.address.customerId,
      };
      const ctx = this.entityToContext(result, fullTrace, result.addressConfidenceScore);
      const response = {
        ...addressToPublicResponse(result),
        addressConfidenceScore: result.addressConfidenceScore,
        addressContext: ctx,
      };

      addressDomainEventPublisher.publish(
        {
          ...baseAddressEventFields(fullTrace),
          type: "AddressUpdated",
          addressContext: ctx,
          previousVersion: result.previousVersion,
        },
        opts?.logger,
      );
      emitAddressMetrics(opts?.logger, buildAddressMetrics("update", fullTrace, {
        success: true,
        durationMs: Date.now() - started,
        addressConfidenceScore: result.addressConfidenceScore,
      }));

      return response;
    } catch (err) {
      emitAddressMetrics(opts?.logger, buildAddressMetrics("update", trace, {
        success: false,
        durationMs: Date.now() - started,
        failureReason: err instanceof Error ? err.message : "unknown",
      }));
      throw err;
    }
  }

  async getAddress(addressId: number, opts?: AddressCapabilityOptions) {
    const entity = await addressService.get(addressId);
    if (!entity) return null;
    const score = calculateAddressConfidenceFromPrepared(
      prepareAddress({
        customerId: entity.address.customerId,
        formattedAddress: entity.address.formattedAddress,
        source: entity.address.source,
        verificationStatus: entity.address.verificationStatus,
        placeId: entity.address.placeId,
        latitude: entity.address.latitude,
        longitude: entity.address.longitude,
      }),
    );
    const trace = this.trace(opts, {
      identityId: entity.identity.id,
      addressId,
      customerId: entity.address.customerId,
    });
    return {
      ...addressToPublicResponse(entity),
      addressConfidenceScore: score,
      addressContext: this.entityToContext(entity, trace, score),
    };
  }

  async listAddresses(
    customerId: number,
    opts?: AddressCapabilityOptions & { includeDeleted?: boolean; includeArchived?: boolean },
  ) {
    const entities = await addressService.list(customerId, opts);
    const trace = this.trace(opts, { customerId });
    return entities.map(entity => {
      const score = calculateAddressConfidenceFromPrepared(
        prepareAddress({
          customerId: entity.address.customerId,
          formattedAddress: entity.address.formattedAddress,
          source: entity.address.source,
          verificationStatus: entity.address.verificationStatus,
        }),
        { isLegacyMigrated: entity.address.source === "IMPORTED" },
      );
      return {
        ...addressToPublicResponse(entity),
        addressConfidenceScore: score,
        correlation: trace,
      };
    });
  }

  async deleteAddress(addressId: number, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const entity = await addressService.get(addressId);
    const trace = this.trace(opts, {
      addressId,
      identityId: entity?.identity.id,
      customerId: entity?.address.customerId,
    });
    const result = await addressService.softDelete(addressId);
    addressDomainEventPublisher.publish({ ...baseAddressEventFields(trace), type: "AddressDeleted" }, opts?.logger);
    emitAddressMetrics(opts?.logger, buildAddressMetrics("delete", trace, {
      success: true,
      durationMs: Date.now() - started,
    }));
    return result;
  }

  async restoreAddress(addressId: number, opts?: AddressCapabilityOptions) {
    const entity = await addressService.get(addressId);
    const result = await addressService.restore(addressId);
    if (entity) {
      const trace = this.trace(opts, {
        addressId,
        identityId: entity.identity.id,
        customerId: entity.address.customerId,
      });
      const score = calculateAddressConfidenceFromPrepared(
        prepareAddress({ customerId: entity.address.customerId, formattedAddress: entity.address.formattedAddress, source: entity.address.source }),
      );
      addressDomainEventPublisher.publish(
        { ...baseAddressEventFields(trace), type: "AddressRestored", addressContext: this.entityToContext(entity, trace, score) },
        opts?.logger,
      );
    }
    return result;
  }

  async setDefaultAddress(addressId: number, opts?: AddressCapabilityOptions) {
    const result = await addressService.setDefault(addressId);
    const trace = this.trace(opts, {
      addressId,
      identityId: result.identity.id,
      customerId: result.address.customerId,
    });
    addressDomainEventPublisher.publish(
      { ...baseAddressEventFields(trace), type: "DefaultAddressChanged", addressId },
      opts?.logger,
    );
    const score = calculateAddressConfidenceFromPrepared(
      prepareAddress({ customerId: result.address.customerId, formattedAddress: result.address.formattedAddress, source: result.address.source }),
    );
    return {
      ...addressToPublicResponse(result),
      addressConfidenceScore: score,
      addressContext: this.entityToContext(result, trace, score),
    };
  }

  async validateAddress(input: CreateAddressInput, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const trace = this.trace(opts, { customerId: input.customerId });
    const result = await addressService.validateWithLocationIntelligence(input, { trace, logger: opts?.logger });
    addressDomainEventPublisher.publish(
      {
        ...baseAddressEventFields(trace),
        type: "AddressValidated",
        success: result.success,
        locationConfidenceScore: result.confidenceScore ?? undefined,
      },
      opts?.logger,
    );
    emitAddressMetrics(opts?.logger, buildAddressMetrics("validate", trace, {
      success: result.success,
      durationMs: Date.now() - started,
      locationConfidenceScore: result.confidenceScore,
      failureReason: result.success ? undefined : result.message,
    }));
    return result;
  }

  normalizeAddress(input: CreateAddressInput, opts?: AddressCapabilityOptions) {
    const trace = this.trace(opts, { customerId: input.customerId });
    const preview = addressService.normalize(input);
    addressDomainEventPublisher.publish(
      { ...baseAddressEventFields(trace), type: "AddressNormalized", normalizedAddress: preview.formattedAddress },
      opts?.logger,
    );
    emitAddressMetrics(opts?.logger, buildAddressMetrics("normalize", trace, { success: true }));
    return preview;
  }

  previewParsedAddress(input: CreateAddressInput) {
    return addressService.previewParsed(input);
  }

  async checkDuplicates(input: CreateAddressInput, opts?: AddressCapabilityOptions) {
    const trace = this.trace(opts, { customerId: input.customerId });
    const duplicates = await addressService.findDuplicates(input, { trace, logger: opts?.logger });
    if (duplicates.length > 0) {
      addressDomainEventPublisher.publish(
        { ...baseAddressEventFields(trace), type: "DuplicateAddressDetected", duplicateCount: duplicates.length },
        opts?.logger,
      );
      emitAddressMetrics(opts?.logger, buildAddressMetrics("deduplication", trace, {
        success: true,
        duplicateCount: duplicates.length,
      }));
    }
    return { duplicates, hasDuplicates: duplicates.length > 0 };
  }

  async mergeAddresses(input: MergeDuplicateInput, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const trace = this.trace(opts, { customerId: input.customerId, identityId: input.keepIdentityId });
    const result = await addressService.mergeDuplicates(input);
    addressDomainEventPublisher.publish(
      {
        ...baseAddressEventFields(trace),
        type: "AddressMerged",
        mergedIntoIdentityId: result.mergedInto,
        mergedIdentityIds: result.merged,
      },
      opts?.logger,
    );
    emitAddressMetrics(opts?.logger, buildAddressMetrics("merge", trace, {
      success: true,
      durationMs: Date.now() - started,
    }));
    return result;
  }

  async getAddressHistory(addressId: number) {
    const entity = await addressService.get(addressId);
    if (!entity) return [];
    return addressService.getHistory(entity.identity.id);
  }

  async searchAddresses(criteria: AddressSearchCriteria, opts?: AddressCapabilityOptions) {
    const started = Date.now();
    const trace = this.trace(opts, { customerId: criteria.customerId });
    const provider = addressSearchRegistry.repository ?? repositoryAddressSearchProvider;
    const results = await provider.search(criteria);
    emitAddressMetrics(opts?.logger, buildAddressMetrics("search", trace, {
      success: true,
      durationMs: Date.now() - started,
    }));
    return results;
  }

  publishSnapshotCreated(trace: AddressTraceContext, snapshotId: number, snapshotReason: string, logger?: Logger) {
    addressDomainEventPublisher.publish(
      { ...baseAddressEventFields(trace), type: "AddressSnapshotCreated", snapshotId, snapshotReason },
      logger,
    );
    emitAddressMetrics(logger, buildAddressMetrics("snapshot", trace, { success: true }));
  }
}

export const addressCapability = new AddressCapability();
