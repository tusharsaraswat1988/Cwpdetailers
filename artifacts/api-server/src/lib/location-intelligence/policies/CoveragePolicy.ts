import type { LocationPolicy } from "./types";
import { addressValidator } from "../../coverage/validators/AddressValidator";
import { pinValidator } from "../../coverage/validators/PinValidator";
import { serviceAreaValidator } from "../../coverage/validators/ServiceAreaValidator";
import { cityValidator } from "../../coverage/validators/CityValidator";
import { serviceValidator } from "../../coverage/validators/ServiceValidator";

function asPolicy(validator: { name: string; validate: LocationPolicy["apply"] }): LocationPolicy {
  return { name: validator.name, apply: validator.validate.bind(validator) };
}

export const addressPolicy: LocationPolicy = asPolicy(addressValidator);
export const pinPolicy: LocationPolicy = asPolicy(pinValidator);
export const serviceAreaPolicy: LocationPolicy = asPolicy(serviceAreaValidator);
export const cityPolicy: LocationPolicy = asPolicy(cityValidator);
export const servicePolicy: LocationPolicy = asPolicy(serviceValidator);

export const coveragePolicies: LocationPolicy[] = [
  addressPolicy,
  pinPolicy,
  serviceAreaPolicy,
  cityPolicy,
  servicePolicy,
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
