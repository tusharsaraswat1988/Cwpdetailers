const VALID_VEHICLE_TYPES = new Set(["sedan", "suv", "hatchback", "luxury", "van", "truck"]);

const CATEGORY_SLUG_TO_TYPE: Record<string, string> = {
  hatchback: "hatchback",
  sedan: "sedan",
  suv: "suv",
  "compact-suv": "suv",
  crossover: "suv",
  muv: "van",
  mpv: "van",
  luxury: "luxury",
  van: "van",
  pickup: "truck",
};

/** Map master-data category slug to a valid vehicles.vehicle_type enum value. */
export function vehicleTypeFromCategorySlug(categorySlug: string): string {
  return CATEGORY_SLUG_TO_TYPE[categorySlug.toLowerCase()] ?? "sedan";
}

/** Normalize client-provided vehicle type to a valid lowercase enum value. */
export function normalizeVehicleType(value: string | undefined | null): string {
  const normalized = (value ?? "sedan").toLowerCase().trim();
  return VALID_VEHICLE_TYPES.has(normalized) ? normalized : "sedan";
}
