import { businessRulesEngine } from "../businessRules/BusinessRulesEngine";
import { defaultBookingRules } from "../businessRules/rules";
import type { BookingPolicy, PolicyResult } from "./types";
import type { CreateBookingInput } from "../types";

export type CreationPolicyInput = CreateBookingInput & {
  coverageStatus?: string | null;
};

export const bookingCreationPolicy: BookingPolicy<CreationPolicyInput, PolicyResult> = {
  name: "BookingCreationPolicy",
  async execute(input, ctx) {
    if (businessRulesEngine.getRules().length === 0) {
      businessRulesEngine.registerAll(defaultBookingRules);
    }
    const evaluation = await businessRulesEngine.evaluate(
      {
        customerId: input.customerId,
        serviceId: input.serviceId,
        serviceType: input.serviceType,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime,
        cityId: input.cityId,
        coverageStatus: input.coverageStatus,
        trace: ctx.trace,
      },
      ["booking", "coverage", "working_hours"],
      ctx.logger,
    );
    if (!evaluation.passed) {
      const first = evaluation.failedRules[0];
      return { success: false, error: first?.message ?? "Business rules failed", metadata: { evaluation } };
    }
    return { success: true, metadata: { evaluation } };
  },
};
