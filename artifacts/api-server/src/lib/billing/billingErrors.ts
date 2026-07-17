import { CommercialValidationError } from "./commercialValidation";

/** Map billing/invoice failures to safe client messages — never leak raw SQL. */
export function mapBillingError(err: unknown): { status: number; message: string } {
  if (err instanceof CommercialValidationError) {
    const statusByCode: Record<CommercialValidationError["code"], number> = {
      NOT_READY: 400,
      ALREADY_BILLED: 409,
      CONTRACT_INVALID: 400,
      ENTITLEMENT_UNAVAILABLE: 400,
      NEGATIVE_TOTAL: 400,
      INVALID_STATE: 400,
      UNAUTHORIZED: 403,
      NOT_FOUND: 404,
    };
    return { status: statusByCode[err.code], message: err.message };
  }

  const raw = err instanceof Error ? err.message : String(err);

  if (
    raw.includes("Failed query:") ||
    raw.includes("insert into \"") ||
    raw.includes("select \"") ||
    raw.includes("params:")
  ) {
    return {
      status: 500,
      message: "Could not create invoice. Please try again or contact support.",
    };
  }

  if (raw === "Customer not found" || raw.includes("Contract not found")) {
    return { status: 404, message: raw };
  }

  if (raw.includes("already invoiced") || raw.includes("already exists") || raw.includes("already exists for this job")) {
    return { status: 409, message: raw };
  }

  // Known validation messages from billing services
  if (
    raw.includes("required") ||
    raw.includes("invalid") ||
    raw.includes("not found") ||
    raw.includes("disabled") ||
    raw.includes("ready_for_billing") ||
    raw.includes("Entitlement") ||
    raw.includes("cannot be negative")
  ) {
    return { status: 400, message: raw };
  }

  return {
    status: 500,
    message: "Could not complete billing. Please try again.",
  };
}
