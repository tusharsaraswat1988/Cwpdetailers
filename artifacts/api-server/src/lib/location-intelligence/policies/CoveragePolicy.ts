import type { LocationPolicy } from "./types";
import { addressValidator } from "../../coverage/validators/AddressValidator";
import { pinValidator } from "../../coverage/validators/PinValidator";
import { serviceAreaValidator } from "../../coverage/validators/ServiceAreaValidator";
import { cityValidator } from "../../coverage/validators/CityValidator";
import { societyValidator } from "../../coverage/validators/SocietyValidator";
import { serviceValidator } from "../../coverage/validators/ServiceValidator";
import { cont, halt } from "../../coverage/validators/types";
import type { PipelineState } from "../../coverage/validators/types";
import { locationResolver } from "../resolver/LocationResolver";
import { serviceabilityEngine } from "../serviceability/ServiceabilityEngine";
import { locationPricingEngine } from "../pricing/LocationPricingEngine";

function asPolicy(validator: { name: string; validate: LocationPolicy["apply"] }): LocationPolicy {
  return { name: validator.name, apply: validator.validate.bind(validator) };
}

export const addressPolicy: LocationPolicy = asPolicy(addressValidator);
export const pinPolicy: LocationPolicy = asPolicy(pinValidator);
export const serviceAreaPolicy: LocationPolicy = asPolicy(serviceAreaValidator);
export const cityPolicy: LocationPolicy = asPolicy(cityValidator);
export const societyPolicy: LocationPolicy = asPolicy(societyValidator);
export const servicePolicy: LocationPolicy = asPolicy(serviceValidator);

export const locationResolutionPolicy: LocationPolicy = {
  name: "LocationResolutionPolicy",
  async apply(state: PipelineState) {
    try {
      const resolved = await locationResolver.resolve({
        placeId: state.request.placeId,
        latitude: state.request.locationLat,
        longitude: state.request.locationLng,
        cityId: state.city?.id ?? state.request.cityId,
        citySlug: state.city?.slug ?? state.request.citySlug,
        cityName: state.city?.name ?? state.request.cityName,
        pincode: state.pincode ?? state.request.pincode ?? state.request.postalCode,
        societyId: state.request.societyId,
        localityId: state.request.localityId,
        propertyType: state.request.propertyType,
        formattedAddress: state.request.address,
      });

      const updatedState: PipelineState = {
        ...state,
        resolutionStatus: resolved.status,
        propertyType: resolved.propertyType,
        locality: resolved.localityId ? { id: resolved.localityId, name: resolved.localityName || "", slug: "" } : state.locality,
        society: resolved.societyId ? { id: resolved.societyId, name: resolved.societyName || "", branchId: resolved.branchId } : state.society,
        zone: resolved.zoneId ? { id: resolved.zoneId, name: resolved.zoneName || "", code: resolved.zoneCode || "", branchId: resolved.branchId } : state.zone,
        branch: resolved.branchId ? { id: resolved.branchId, name: resolved.branchName || "" } : state.branch,
      };

      if (resolved.status === "AMBIGUOUS") {
        return halt("AMBIGUOUS" as any, resolved.message || "Location resolution is ambiguous.");
      }

      return cont(updatedState);
    } catch {
      return cont(state);
    }
  },
};

export const serviceabilityPolicy: LocationPolicy = {
  name: "ServiceabilityPolicy",
  async apply(state: PipelineState) {
    try {
      const evaluation = await serviceabilityEngine.evaluate({
        cityId: state.city?.id ?? state.request.cityId,
        branchId: state.branch?.id ?? state.zone?.branchId ?? state.request.branchId,
        zoneId: state.zone?.id ?? state.request.zoneId,
        societyId: state.society?.id ?? state.request.societyId,
        localityId: state.locality?.id ?? state.request.localityId,
        pincode: state.pincode ?? state.request.pincode ?? state.request.postalCode,
        propertyType: state.propertyType ?? state.request.propertyType,
        serviceId: state.request.serviceId,
      });

      if (!evaluation.isServiceable) {
        const statusCode = evaluation.status === "WAITLIST"
          ? "WAITLIST"
          : evaluation.status === "COMING_SOON"
            ? "SERVICE_COMING_SOON"
            : evaluation.status === "TEMPORARILY_CLOSED"
              ? "TEMPORARILY_UNAVAILABLE"
              : "SERVICE_UNAVAILABLE";

        return halt(statusCode, evaluation.rejectionReason || "Location is not serviceable.");
      }

      return cont(state);
    } catch {
      return cont(state);
    }
  },
};

export const locationPricingPolicy: LocationPolicy = {
  name: "LocationPricingPolicy",
  async apply(state: PipelineState) {
    const serviceId = state.request.serviceId;
    const cityId = state.city?.id ?? state.request.cityId;
    if (!serviceId || !cityId) {
      return cont(state);
    }

    try {
      const priceResult = await locationPricingEngine.resolvePrice({
        serviceId,
        cityId,
        branchId: state.branch?.id ?? state.zone?.branchId ?? state.request.branchId,
        zoneId: state.zone?.id ?? state.request.zoneId,
        societyId: state.society?.id ?? state.request.societyId,
        locationType: state.propertyType ?? state.request.propertyType,
      });

      return cont({
        ...state,
        pricingTier: {
          ruleId: priceResult.ruleId,
          basePrice: priceResult.basePrice,
          total: priceResult.total,
          gstRate: priceResult.gstRate,
          pricingType: priceResult.pricingType,
          locationType: priceResult.locationType,
          source: priceResult.source,
        },
      });
    } catch {
      return cont(state);
    }
  },
};

export const coveragePolicies: LocationPolicy[] = [
  addressPolicy,
  pinPolicy,
  serviceAreaPolicy,
  cityPolicy,
  societyPolicy,
  servicePolicy,
  locationResolutionPolicy,
  serviceabilityPolicy,
  locationPricingPolicy,
];

export class CoveragePolicy {
  constructor(private readonly policies: LocationPolicy[] = coveragePolicies) {}

  async execute(state: import("../../coverage/validators/types").PipelineState) {
    let current = state;
    for (const policy of this.policies) {
      const result = await policy.apply(current);
      if (result.halt) {
        return { state: current, halted: result };
      }
      current = result.state;
    }
    return { state: current };
  }
}

export const coveragePolicy = new CoveragePolicy();

