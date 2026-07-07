import type { Logger } from "pino";

export type VisitCompleteStep =
  | "request_received"
  | "input_validated"
  | "image_validation_passed"
  | "subscription_loaded"
  | "assignment_verified"
  | "geofence_passed"
  | "quota_verified"
  | "cloudinary_upload_started"
  | "cloudinary_upload_passed"
  | "db_transaction_started"
  | "db_insert_passed"
  | "response_ready";

export function traceVisitStep(
  log: Logger,
  step: VisitCompleteStep,
  meta?: Record<string, unknown>,
): void {
  log.info({ dcmsVisitComplete: step, ...meta }, `dcms visit complete: ${step}`);
}

export function traceVisitFailure(
  log: Logger,
  step: VisitCompleteStep,
  err: unknown,
  meta?: Record<string, unknown>,
): never {
  const error = err instanceof Error ? err : new Error(String(err));
  log.error(
    {
      dcmsVisitComplete: step,
      err: error,
      stack: error.stack,
      ...meta,
    },
    `dcms visit complete failed at ${step}: ${error.message}`,
  );
  throw error;
}
