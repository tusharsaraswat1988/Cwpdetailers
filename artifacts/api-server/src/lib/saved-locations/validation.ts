import { composeSavedAddress, parseComposedAddress } from "@workspace/address-model";

export type SavedLocationWriteInput = {
  customerId: number;
  label: string;
  address?: string;
  houseNumber?: string | null;
  buildingName?: string | null;
  area?: string | null;
  landmark?: string | null;
  cityId?: number | null;
  cityName?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  placeId?: string | null;
  formattedAddress?: string | null;
  googleComponents?: Array<{ long_name: string; short_name: string; types: string[] }> | null;
  isDefault?: boolean;
};

export type SavedLocationServiceError = {
  status: number;
  error: string;
};

export function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

export function finiteOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return null;
  return n;
}

export function composeFromParts(input: SavedLocationWriteInput, fallbackAddress?: string): string {
  const composed = composeSavedAddress({
    houseNumber: input.houseNumber?.trim() ?? "",
    buildingName: input.buildingName?.trim() ?? "",
    area: input.area?.trim() ?? "",
    landmark: input.landmark?.trim() ?? "",
    pincode: input.pincode?.trim() ?? "",
    city: input.cityName?.trim() ?? "",
  });
  return composed || fallbackAddress?.trim() || input.formattedAddress?.trim() || input.address?.trim() || "";
}

export function normalizeWrite(input: SavedLocationWriteInput): SavedLocationWriteInput {
  return {
    ...input,
    label: input.label.trim(),
    houseNumber: trimOrNull(input.houseNumber),
    buildingName: trimOrNull(input.buildingName),
    area: trimOrNull(input.area),
    landmark: trimOrNull(input.landmark),
    cityName: trimOrNull(input.cityName),
    pincode: trimOrNull(input.pincode),
    placeId: trimOrNull(input.placeId),
    formattedAddress: trimOrNull(input.formattedAddress),
    latitude: finiteOrNull(input.latitude),
    longitude: finiteOrNull(input.longitude),
  };
}

export function validateSavedLocationWrite(input: SavedLocationWriteInput): SavedLocationServiceError | null {
  if (!input.customerId || !input.label.trim()) {
    return { status: 400, error: "Please give this place a name." };
  }
  const house = input.houseNumber?.trim() || "";
  const area = input.area?.trim() || "";
  const address = composeFromParts(input);
  const hasCoords = finiteOrNull(input.latitude) != null && finiteOrNull(input.longitude) != null;
  if (!house) {
    return { status: 400, error: "Please add your flat or house number so our team can find you." };
  }
  if (!area && !address) {
    return { status: 400, error: "Please add a bit more detail so we know where to come." };
  }
  if (!hasCoords && !input.cityName?.trim()) {
    return { status: 400, error: "Please add your city so we can check if we serve this area." };
  }
  return null;
}

export function hydrateSavedLocation<T extends {
  address: string;
  houseNumber?: string | null;
  buildingName?: string | null;
  area?: string | null;
  landmark?: string | null;
  cityName?: string | null;
  pincode?: string | null;
}>(row: T): T {
  if (row.houseNumber || row.area || row.cityName) return row;
  const parts = parseComposedAddress(row.address);
  return {
    ...row,
    houseNumber: row.houseNumber ?? (parts.houseNumber || null),
    buildingName: row.buildingName ?? (parts.buildingName || null),
    area: row.area ?? (parts.area || null),
    landmark: row.landmark ?? (parts.landmark || null),
    cityName: row.cityName ?? (parts.city || null),
    pincode: row.pincode ?? (parts.pincode || null),
  };
}

export function isSavedLocationServiceError(err: unknown): err is SavedLocationServiceError {
  return Boolean(err && typeof err === "object" && "status" in err && "error" in err);
}
