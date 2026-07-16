import type { CoverageRequest, ParsedAddressComponents } from "../CoverageTypes";
import type { AddressParser } from "./AddressParser";
import { googleAddressParser } from "./GoogleAddressParser";
import { manualAddressParser } from "./ManualAddressParser";
import { extractPincodeFromText, mergeParsedComponents } from "./AddressParser";

export class CompositeAddressParser {
  constructor(
    private readonly providers: AddressParser[] = [googleAddressParser, manualAddressParser],
  ) {}

  parse(request: CoverageRequest): ParsedAddressComponents {
    let merged: ParsedAddressComponents = {};

    for (const provider of this.providers) {
      if (!provider.canParse(request)) continue;
      merged = mergeParsedComponents(merged, provider.parse(request));
    }

    const pin =
      merged.postalCode
      ?? extractPincodeFromText(request.address);

    return {
      ...merged,
      postalCode: pin,
      city: merged.city ?? request.cityName ?? null,
    };
  }
}

export const compositeAddressParser = new CompositeAddressParser();

export function buildCoverageRequest(
  body: Record<string, unknown>,
  overrides?: Partial<CoverageRequest>,
): CoverageRequest {
  const rawComponents = body.addressComponents;
  const addressComponents = Array.isArray(rawComponents)
    ? rawComponents.filter(
      (c): c is NonNullable<CoverageRequest["addressComponents"]>[number] =>
        typeof c === "object"
        && c !== null
        && typeof (c as { long_name?: string }).long_name === "string"
        && Array.isArray((c as { types?: unknown }).types),
    )
    : undefined;

  const coerceNumber = (value: unknown): number | null => {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const address = typeof body.address === "string" ? body.address : overrides?.address ?? null;
  const lat = coerceNumber(body.locationLat ?? body.latitude) ?? overrides?.locationLat ?? null;
  const lng = coerceNumber(body.locationLng ?? body.longitude) ?? overrides?.locationLng ?? null;
  const serviceIdRaw = body.serviceId ?? overrides?.serviceId;
  const serviceId = serviceIdRaw != null ? Number(serviceIdRaw) : null;
  const cityIdRaw = body.cityId ?? overrides?.cityId;
  const cityId = cityIdRaw != null ? Number(cityIdRaw) : null;

  const draft: CoverageRequest = {
    customerId: overrides?.customerId ?? (body.customerId != null ? Number(body.customerId) : undefined),
    address: overrides?.address ?? address,
    locationLat: overrides?.locationLat ?? lat,
    locationLng: overrides?.locationLng ?? lng,
    placeId: overrides?.placeId ?? (typeof body.placeId === "string" ? body.placeId : null),
    serviceId: overrides?.serviceId ?? (Number.isFinite(serviceId) ? serviceId : null),
    cityId: overrides?.cityId ?? (Number.isFinite(cityId) ? cityId : null),
    citySlug: overrides?.citySlug ?? (typeof body.citySlug === "string" ? body.citySlug : null),
    cityName:
      overrides?.cityName
      ?? (typeof body.area === "string" ? body.area : null)
      ?? (typeof body.city === "string" ? body.city : null),
    addressComponents: overrides?.addressComponents ?? addressComponents,
    postalCode:
      overrides?.postalCode
      ?? (typeof body.postalCode === "string" ? body.postalCode : null),
    pincode:
      overrides?.pincode
      ?? (typeof body.pincode === "string" ? body.pincode : null),
  };

  const parsed = compositeAddressParser.parse(draft);
  return {
    ...draft,
    postalCode: parsed.postalCode ?? draft.postalCode,
    pincode: parsed.postalCode ?? draft.pincode,
    cityName: parsed.city ?? draft.cityName,
  };
}

/** @deprecated Phase 1 alias */
export const buildServiceabilityRequest = buildCoverageRequest;

/** @deprecated Phase 1 alias */
export function parseGoogleAddressComponents(
  components: NonNullable<CoverageRequest["addressComponents"]>,
) {
  return googleAddressParser.parse({ addressComponents: components });
}

export { extractPincodeFromText };
