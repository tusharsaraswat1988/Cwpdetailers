import type { AddressTraceContext } from "../../correlation/AddressTraceContext";
import type { AddressContext } from "../../AddressContext";
import { ADDRESS_DOMAIN_VERSION } from "../../versioning";

export type AddressDomainEventType =
  | "AddressCreated"
  | "AddressUpdated"
  | "AddressDeleted"
  | "AddressRestored"
  | "AddressMerged"
  | "AddressSnapshotCreated"
  | "DefaultAddressChanged"
  | "AddressValidated"
  | "AddressNormalized"
  | "DuplicateAddressDetected";

export type AddressDomainEventBase = {
  type: AddressDomainEventType;
  timestamp: string;
  traceId: string;
  requestId: string;
  addressOperationId: string;
  identityId?: number;
  addressId?: number;
  customerId?: number;
  version: typeof ADDRESS_DOMAIN_VERSION;
};

export type AddressCreatedEvent = AddressDomainEventBase & {
  type: "AddressCreated";
  addressContext: AddressContext;
};

export type AddressUpdatedEvent = AddressDomainEventBase & {
  type: "AddressUpdated";
  addressContext: AddressContext;
  previousVersion: number;
};

export type AddressDeletedEvent = AddressDomainEventBase & {
  type: "AddressDeleted";
};

export type AddressRestoredEvent = AddressDomainEventBase & {
  type: "AddressRestored";
  addressContext: AddressContext;
};

export type AddressMergedEvent = AddressDomainEventBase & {
  type: "AddressMerged";
  mergedIntoIdentityId: number;
  mergedIdentityIds: number[];
};

export type AddressSnapshotCreatedEvent = AddressDomainEventBase & {
  type: "AddressSnapshotCreated";
  snapshotId: number;
  snapshotReason: string;
};

export type DefaultAddressChangedEvent = AddressDomainEventBase & {
  type: "DefaultAddressChanged";
  addressId: number;
};

export type AddressValidatedEvent = AddressDomainEventBase & {
  type: "AddressValidated";
  success: boolean;
  locationConfidenceScore?: number;
};

export type AddressNormalizedEvent = AddressDomainEventBase & {
  type: "AddressNormalized";
  normalizedAddress: string;
};

export type DuplicateAddressDetectedEvent = AddressDomainEventBase & {
  type: "DuplicateAddressDetected";
  duplicateCount: number;
};

export type AddressDomainEvent =
  | AddressCreatedEvent
  | AddressUpdatedEvent
  | AddressDeletedEvent
  | AddressRestoredEvent
  | AddressMergedEvent
  | AddressSnapshotCreatedEvent
  | DefaultAddressChangedEvent
  | AddressValidatedEvent
  | AddressNormalizedEvent
  | DuplicateAddressDetectedEvent;

export function baseAddressEventFields(
  correlation: AddressTraceContext,
): Omit<AddressDomainEventBase, "type"> {
  return {
    timestamp: new Date().toISOString(),
    traceId: correlation.traceId,
    requestId: correlation.requestId,
    addressOperationId: correlation.addressOperationId,
    identityId: correlation.identityId,
    addressId: correlation.addressId,
    customerId: correlation.customerId,
    version: ADDRESS_DOMAIN_VERSION,
  };
}
