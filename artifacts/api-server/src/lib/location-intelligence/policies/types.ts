import type { PipelineState, PipelineResult } from "../../coverage/validators/types";

export interface LocationPolicy {
  readonly name: string;
  apply(state: PipelineState): Promise<PipelineResult>;
}

export type PolicyContext = {
  requestSource: string;
  isBooking: boolean;
};
