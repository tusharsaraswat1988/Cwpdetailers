import { randomUUID } from "node:crypto";
import type { CoverageCorrelation } from "../../coverage/CoverageTypes";

export type TraceContext = CoverageCorrelation & {
  traceId: string;
};

export function createTraceId(): string {
  return randomUUID();
}

export function resolveTraceId(headerValue?: string | string[] | null): string {
  if (typeof headerValue === "string" && headerValue.trim()) return headerValue.trim();
  if (Array.isArray(headerValue) && headerValue[0]?.trim()) return headerValue[0].trim();
  return createTraceId();
}

export function buildTraceContext(opts?: {
  requestId?: string;
  traceId?: string;
  bookingId?: number;
}): TraceContext {
  const traceId = opts?.traceId ?? createTraceId();
  const requestId = opts?.requestId ?? traceId;
  return {
    traceId,
    requestId,
    coverageValidationId: randomUUID(),
    bookingId: opts?.bookingId,
  };
}

/** @deprecated use buildTraceContext — re-export for coverage module compat */
export function buildCorrelation(opts?: {
  requestId?: string;
  bookingId?: number;
}): CoverageCorrelation {
  const ctx = buildTraceContext(opts);
  return {
    coverageValidationId: ctx.coverageValidationId,
    requestId: ctx.requestId,
    bookingId: ctx.bookingId,
  };
}

export function createCoverageValidationId(): string {
  return randomUUID();
}

export function resolveRequestId(headerValue?: string | string[] | null): string {
  return resolveTraceId(headerValue);
}
