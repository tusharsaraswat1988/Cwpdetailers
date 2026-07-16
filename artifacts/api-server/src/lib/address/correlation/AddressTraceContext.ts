import { randomUUID } from "node:crypto";

export type AddressTraceContext = {
  traceId: string;
  requestId: string;
  addressOperationId: string;
  identityId?: number;
  addressId?: number;
  customerId?: number;
};

export function createAddressOperationId(): string {
  return randomUUID();
}

export function buildAddressTraceContext(opts?: {
  traceId?: string;
  requestId?: string;
  identityId?: number;
  addressId?: number;
  customerId?: number;
}): AddressTraceContext {
  const traceId = opts?.traceId ?? randomUUID();
  return {
    traceId,
    requestId: opts?.requestId ?? traceId,
    addressOperationId: createAddressOperationId(),
    identityId: opts?.identityId,
    addressId: opts?.addressId,
    customerId: opts?.customerId,
  };
}

export function resolveAddressTraceId(headerValue?: string | string[] | null): string {
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  return randomUUID();
}
