import type { CoverageResult } from "./CoverageTypes";

export class CoverageValidationError extends Error {
  readonly result: CoverageResult;

  constructor(result: CoverageResult) {
    super(result.message);
    this.name = "CoverageValidationError";
    this.result = result;
  }
}

/** @deprecated Phase 1 alias */
export class ServiceabilityValidationError extends CoverageValidationError {}

export function assertCoverageSuccess(result: CoverageResult): void {
  if (!result.success) {
    throw new CoverageValidationError(result);
  }
}

/** @deprecated Phase 1 alias */
export const assertServiceabilitySuccess = assertCoverageSuccess;
