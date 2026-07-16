import type { CoverageRequest, GoogleAddressComponent, ParsedAddressComponents } from "../CoverageTypes";

/** Provider-agnostic address parsing contract. */
export interface AddressParser {
  readonly providerId: string;
  canParse(request: CoverageRequest): boolean;
  parse(request: CoverageRequest): ParsedAddressComponents;
}

export const INDIAN_PIN_REGEX = /\b([1-9]\d{5})\b/;

export function extractPincodeFromText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const match = text.match(INDIAN_PIN_REGEX);
  return match?.[1] ?? null;
}

export function mergeParsedComponents(
  base: ParsedAddressComponents,
  overlay: ParsedAddressComponents,
): ParsedAddressComponents {
  return {
    postalCode: overlay.postalCode ?? base.postalCode ?? null,
    locality: overlay.locality ?? base.locality ?? null,
    subLocality: overlay.subLocality ?? base.subLocality ?? null,
    city: overlay.city ?? base.city ?? null,
    state: overlay.state ?? base.state ?? null,
    country: overlay.country ?? base.country ?? null,
  };
}

export function componentValue(
  components: GoogleAddressComponent[],
  ...types: string[]
): string | null {
  const hit = components.find(c => types.some(t => c.types.includes(t)));
  return hit?.long_name ?? null;
}
