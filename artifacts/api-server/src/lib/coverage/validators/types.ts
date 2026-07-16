import type { CoverageRequest, ParsedAddressComponents } from "../CoverageTypes";
import type { TraceContext } from "../../location-intelligence/correlation/TraceContext";
import type { CityRecord } from "../repositories/CityRepository";
import type { PinRecord } from "../repositories/PinRepository";
import type { CityServiceCatalog } from "../repositories/ServiceAvailabilityRepository";

export type CityResolutionSource =
  | "pin"
  | "google_city"
  | "city_slug"
  | "city_id"
  | "city_name";

export type PipelineState = {
  request: CoverageRequest;
  parsedAddress: ParsedAddressComponents;
  pincode?: string | null;
  pinRecord?: PinRecord | null;
  city?: CityRecord | null;
  cityResolutionSource?: CityResolutionSource;
  usedCityFallback?: boolean;
  serviceCatalog?: CityServiceCatalog;
  correlation: TraceContext;
  requestSource: string;
};

export type PipelineHalt = {
  halt: true;
  status: import("../CoverageTypes").CoverageStatusCode;
  message?: string;
};

export type PipelineContinue = {
  halt: false;
  state: PipelineState;
};

export type PipelineResult = PipelineHalt | PipelineContinue;

export type CoverageValidator = {
  readonly name: string;
  validate(state: PipelineState): Promise<PipelineResult>;
};

export function halt(
  status: import("../CoverageTypes").CoverageStatusCode,
  message?: string,
): PipelineHalt {
  return { halt: true, status, message };
}

export function cont(state: PipelineState): PipelineContinue {
  return { halt: false, state };
}
