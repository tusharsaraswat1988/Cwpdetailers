/** Map billing/invoice failures to safe client messages — never leak raw SQL. */
export function mapBillingError(err: unknown): { status: number; message: string } {
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

  if (raw.includes("already invoiced") || raw.includes("already exists")) {
    return { status: 409, message: raw };
  }

  // Known validation messages from billing services
  if (
    raw.includes("required") ||
    raw.includes("invalid") ||
    raw.includes("not found") ||
    raw.includes("disabled")
  ) {
    return { status: 400, message: raw };
  }

  return {
    status: 500,
    message: "Could not complete billing. Please try again.",
  };
}
