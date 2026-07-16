import type { LocationPolicy, PolicyContext } from "./types";
import { coveragePolicy, CoveragePolicy } from "./CoveragePolicy";

export class BookingPolicy {
  constructor(private readonly coverage: CoveragePolicy = coveragePolicy) {}

  async execute(
    state: import("../../coverage/validators/types").PipelineState,
    _ctx: PolicyContext,
  ) {
    return this.coverage.execute(state);
  }
}

export const bookingPolicy = new BookingPolicy();

export const pricingPolicy: LocationPolicy = {
  name: "PricingPolicy",
  async apply(state) {
    return { halt: false, state };
  },
};

export const expansionPolicy: LocationPolicy = {
  name: "ExpansionPolicy",
  async apply(state) {
    return { halt: false, state };
  },
};

export const workforcePolicy: LocationPolicy = {
  name: "WorkforcePolicy",
  async apply(state) {
    return { halt: false, state };
  },
};
