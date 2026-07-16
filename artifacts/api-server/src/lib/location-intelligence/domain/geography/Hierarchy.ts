/** Geographic hierarchy — interfaces only (no DB redesign in Phase 1 freeze). */

export type GeographyLevel =
  | "country"
  | "state"
  | "region"
  | "city"
  | "zone"
  | "service_area"
  | "pin_code"
  | "micro_area"
  | "street"
  | "building";

export interface GeographyNode {
  level: GeographyLevel;
  id?: number | string;
  name: string;
  code?: string;
  parent?: GeographyNode;
  metadata?: Record<string, unknown>;
}

/** Maps current master data to the future hierarchy model. */
export interface GeographyHierarchy {
  country?: GeographyNode;
  state?: GeographyNode;
  city?: GeographyNode;
  zone?: GeographyNode;
  serviceArea?: GeographyNode;
  pinCode?: GeographyNode;
}

export function buildGeographyHierarchyFromMaster(input: {
  countryName?: string;
  stateName?: string;
  stateCode?: string;
  cityId?: number;
  cityName?: string;
  serviceAreaId?: number;
  serviceAreaName?: string;
  pincode?: string;
}): GeographyHierarchy {
  const country: GeographyNode | undefined = input.countryName
    ? { level: "country", name: input.countryName, code: "IN" }
    : { level: "country", name: "India", code: "IN" };

  const state: GeographyNode | undefined = input.stateName
    ? { level: "state", name: input.stateName, code: input.stateCode, parent: country }
    : undefined;

  const city: GeographyNode | undefined = input.cityName
    ? { level: "city", id: input.cityId, name: input.cityName, parent: state ?? country }
    : undefined;

  const serviceArea: GeographyNode | undefined = input.serviceAreaName
    ? { level: "service_area", id: input.serviceAreaId, name: input.serviceAreaName, parent: city }
    : undefined;

  const pinCode: GeographyNode | undefined = input.pincode
    ? { level: "pin_code", name: input.pincode, parent: serviceArea ?? city }
    : undefined;

  return { country, state, city, zone: undefined, serviceArea, pinCode };
}
