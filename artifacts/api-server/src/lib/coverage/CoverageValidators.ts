import { compositeAddressParser } from "./parsers";
import { buildTraceContext } from "../location-intelligence/correlation/TraceContext";
import type { CoverageCheckOptions, CoverageRequest } from "./CoverageTypes";
import { addressValidator } from "./validators/AddressValidator";
import { pinValidator } from "./validators/PinValidator";
import { serviceAreaValidator } from "./validators/ServiceAreaValidator";
import { cityValidator } from "./validators/CityValidator";
import { serviceValidator } from "./validators/ServiceValidator";
import type { CoverageValidator, PipelineState, PipelineResult } from "./validators/types";

const DEFAULT_PIPELINE: CoverageValidator[] = [
  addressValidator,
  pinValidator,
  serviceAreaValidator,
  cityValidator,
  serviceValidator,
];

export class CoverageValidators {
  constructor(private readonly pipeline: CoverageValidator[] = DEFAULT_PIPELINE) {}

  createInitialState(
    request: CoverageRequest,
    options: CoverageCheckOptions = {},
  ): PipelineState {
    return {
      request,
      parsedAddress: compositeAddressParser.parse(request),
      correlation: buildTraceContext({
        requestId: options.requestId,
        traceId: options.traceId,
        bookingId: options.bookingId,
      }),
      requestSource: options.requestSource ?? "unknown",
    };
  }

  async runPipeline(
    request: CoverageRequest,
    options: CoverageCheckOptions = {},
  ): Promise<{ state: PipelineState; halted?: PipelineResult & { halt: true } }> {
    let state = this.createInitialState(request, options);

    for (const validator of this.pipeline) {
      const result = await validator.validate(state);
      if (result.halt) {
        return { state, halted: result };
      }
      state = result.state;
    }

    return { state };
  }
}

export const coverageValidators = new CoverageValidators();

export {
  addressValidator,
  pinValidator,
  serviceAreaValidator,
  cityValidator,
  serviceValidator,
};
