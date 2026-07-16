import type { Logger } from "pino";
import type { BusinessRule, RuleEvaluationInput, RuleEvaluationResult } from "./BusinessRulesEngine";
import { isServiceAvailableInCoverage } from "../services/coverageServiceMapper";

function pass(category: BusinessRule["category"], ruleName: string, metadata?: Record<string, unknown>): RuleEvaluationResult {
  return { category, ruleName, passed: true, metadata };
}

function fail(category: BusinessRule["category"], ruleName: string, message: string): RuleEvaluationResult {
  return { category, ruleName, passed: false, message };
}

export const coverageAvailabilityRule: BusinessRule = {
  name: "CoverageAvailabilityRule",
  category: "coverage",
  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    const status = input.coverageStatus ?? input.bookingContext?.locationContext;
    const label = typeof status === "string"
      ? status
      : (status as { coverageStatus?: string } | null)?.coverageStatus;
    if (label && label !== "AVAILABLE" && label !== "SUCCESS") {
      return fail("coverage", "CoverageAvailabilityRule", `Service not available at location: ${label}`);
    }
    return pass("coverage", "CoverageAvailabilityRule");
  },
};

export const serviceUnavailableBlockRule: BusinessRule = {
  name: "ServiceUnavailableBlockRule",
  category: "booking",
  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    const coverage = input.bookingContext?.coverageResult;
    if (!coverage || !input.serviceId) return pass("booking", "ServiceUnavailableBlockRule");
    if (!isServiceAvailableInCoverage(coverage, input.serviceId)) {
      return fail("booking", "ServiceUnavailableBlockRule", "Selected service is unavailable at this location");
    }
    return pass("booking", "ServiceUnavailableBlockRule");
  },
};

export const pricingRequiredRule: BusinessRule = {
  name: "PricingRequiredRule",
  category: "pricing",
  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    if (input.bookingContext?.pricing.entitlementId) {
      return pass("pricing", "PricingRequiredRule", { waivedByEntitlement: true });
    }
    if (!input.amount && input.amount !== "0") {
      return fail("pricing", "PricingRequiredRule", "Booking amount could not be resolved");
    }
    return pass("pricing", "PricingRequiredRule", { amount: input.amount });
  },
};

export const subscriptionActiveRule: BusinessRule = {
  name: "SubscriptionActiveRule",
  category: "subscription",
  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    if (!input.bookingContext?.pricing.subscriptionId) {
      return pass("subscription", "SubscriptionActiveRule", { skipped: true });
    }
    return pass("subscription", "SubscriptionActiveRule");
  },
};

export const couponValidityRule: BusinessRule = {
  name: "CouponValidityRule",
  category: "coupon",
  async evaluate(_input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    return pass("coupon", "CouponValidityRule", { phase: "stub" });
  },
};

export const holidayBlockRule: BusinessRule = {
  name: "HolidayBlockRule",
  category: "holiday",
  async evaluate(_input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    return pass("holiday", "HolidayBlockRule", { phase: "stub" });
  },
};

export const workingHoursRule: BusinessRule = {
  name: "WorkingHoursRule",
  category: "working_hours",
  async evaluate(input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    if (!input.scheduledTime) return pass("working_hours", "WorkingHoursRule", { skipped: true });
    const hour = parseInt(input.scheduledTime.split(":")[0] ?? "0", 10);
    if (hour < 6 || hour >= 22) {
      return fail("working_hours", "WorkingHoursRule", "Booking time must be between 06:00 and 22:00");
    }
    return pass("working_hours", "WorkingHoursRule");
  },
};

export const cancellationWindowRule: BusinessRule = {
  name: "CancellationWindowRule",
  category: "cancellation",
  async evaluate(_input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    return pass("cancellation", "CancellationWindowRule", { phase: "stub" });
  },
};

export const refundEligibilityRule: BusinessRule = {
  name: "RefundEligibilityRule",
  category: "refund",
  async evaluate(_input: RuleEvaluationInput): Promise<RuleEvaluationResult> {
    return pass("refund", "RefundEligibilityRule", { phase: "stub" });
  },
};

export const defaultBookingRules: BusinessRule[] = [
  coverageAvailabilityRule,
  serviceUnavailableBlockRule,
  pricingRequiredRule,
  subscriptionActiveRule,
  couponValidityRule,
  holidayBlockRule,
  workingHoursRule,
  cancellationWindowRule,
  refundEligibilityRule,
];

export function registerDefaultBookingRules(engine: { registerAll: (rules: BusinessRule[]) => void }): void {
  engine.registerAll(defaultBookingRules);
}
