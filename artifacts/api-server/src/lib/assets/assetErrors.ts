const CLIENT_SAFE_ERRORS = new Set([
  "Invalid service location for customer",
  "Invalid vehicleModelId",
  "vehicleModelId or make+model are required",
  "Vehicle registration number already exists",
  "Site name and capacity are required",
]);

/** Map asset create failures to safe client messages — never leak raw SQL. */
export function mapAssetCreateError(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes("already exists")) {
    return { status: 409, message: "Vehicle registration number already exists" };
  }

  if (CLIENT_SAFE_ERRORS.has(raw) || raw.startsWith("Service location required")) {
    return { status: 400, message: raw };
  }

  if (raw.includes("invalid input value for enum vehicle_type")) {
    return {
      status: 400,
      message: "Invalid vehicle type. Re-select the make & model from master data.",
    };
  }

  return {
    status: 500,
    message: "Could not register this item. Please check the details and try again.",
  };
}
