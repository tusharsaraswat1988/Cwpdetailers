import type { Logger } from "pino";
import type { PreparedAddress } from "../domain/AddressPreparation";
import type { CreateAddressInput, DuplicateCandidate } from "../types";
import type { AddressTraceContext } from "../correlation/AddressTraceContext";

export type AddressPolicyContext = {
  trace: AddressTraceContext;
  logger?: Logger;
  prepared?: PreparedAddress;
};

export interface AddressPolicy<TInput = unknown, TResult = unknown> {
  readonly name: string;
  execute(input: TInput, ctx: AddressPolicyContext): Promise<TResult>;
}

export type NormalizationPolicyResult = { prepared: PreparedAddress };

export type DeduplicationPolicyResult = {
  duplicates: DuplicateCandidate[];
  blocked: boolean;
};

export type ValidationPolicyResult = {
  success: boolean;
  message?: string;
  locationContext?: Record<string, unknown> | null;
  locationConfidenceScore?: number | null;
  cityId?: number | null;
};
