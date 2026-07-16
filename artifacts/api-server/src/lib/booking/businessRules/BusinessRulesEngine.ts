import type { Logger } from "pino";
import type { BookingTraceContext } from "../correlation/BookingTraceContext";
import type { BookingContext } from "../BookingContext";

export type RuleCategory =
  | "booking"
  | "pricing"
  | "subscription"
  | "coupon"
  | "coverage"
  | "holiday"
  | "working_hours"
  | "cancellation"
  | "refund";

export type RuleEvaluationInput = {
  bookingContext?: Partial<BookingContext>;
  customerId?: number;
  serviceId?: number | null;
  serviceType?: string;
  scheduledDate?: string;
  scheduledTime?: string | null;
  amount?: string | null;
  cityId?: number | null;
  coverageStatus?: string | null;
  trace: BookingTraceContext;
};

export type RuleEvaluationResult = {
  category: RuleCategory;
  ruleName: string;
  passed: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type BusinessRule = {
  readonly name: string;
  readonly category: RuleCategory;
  evaluate(input: RuleEvaluationInput, logger?: Logger): Promise<RuleEvaluationResult>;
};

export type BusinessRulesEngineResult = {
  passed: boolean;
  results: RuleEvaluationResult[];
  failedRules: RuleEvaluationResult[];
};

export class BusinessRulesEngine {
  private rules: BusinessRule[] = [];

  register(rule: BusinessRule): void {
    this.rules.push(rule);
  }

  registerAll(rules: BusinessRule[]): void {
    this.rules.push(...rules);
  }

  async evaluate(
    input: RuleEvaluationInput,
    categories?: RuleCategory[],
    logger?: Logger,
  ): Promise<BusinessRulesEngineResult> {
    const applicable = categories
      ? this.rules.filter((r) => categories.includes(r.category))
      : this.rules;

    const results: RuleEvaluationResult[] = [];
    for (const rule of applicable) {
      const result = await rule.evaluate(input, logger);
      results.push(result);
    }

    const failedRules = results.filter((r) => !r.passed);
    return {
      passed: failedRules.length === 0,
      results,
      failedRules,
    };
  }

  getRules(): readonly BusinessRule[] {
    return this.rules;
  }

  clear(): void {
    this.rules = [];
  }
}

export const businessRulesEngine = new BusinessRulesEngine();
