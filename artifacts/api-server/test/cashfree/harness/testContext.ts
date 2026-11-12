import type { TestClient } from "./testClient";
import type { MockCashfreeGateway } from "./mockCashfreeServer";

export interface TestCaseResult {
  id: string;
  tier: number;
  feature?: string;
  name: string;
  passed: boolean;
  skipped: boolean;
  skipReason?: string;
  error?: string;
  durationMs: number;
}

export interface TestSuiteReport {
  suiteName: string;
  tier: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestCaseResult[];
}

export class TestRunnerContext {
  public results: TestCaseResult[] = [];
  public client: TestClient;
  public mockGateway: MockCashfreeGateway;

  constructor(client: TestClient, mockGateway: MockCashfreeGateway) {
    this.client = client;
    this.mockGateway = mockGateway;
  }

  async runTest(
    opts: {
      id: string;
      tier: number;
      feature?: string;
      name: string;
    },
    fn: (ctx: TestRunnerContext) => Promise<void> | void
  ): Promise<TestCaseResult> {
    const start = Date.now();
    try {
      await fn(this);
      const res: TestCaseResult = {
        id: opts.id,
        tier: opts.tier,
        feature: opts.feature,
        name: opts.name,
        passed: true,
        skipped: false,
        durationMs: Date.now() - start,
      };
      this.results.push(res);
      return res;
    } catch (err: any) {
      if (err?.__skip) {
        const res: TestCaseResult = {
          id: opts.id,
          tier: opts.tier,
          feature: opts.feature,
          name: opts.name,
          passed: false,
          skipped: true,
          skipReason: err.message,
          durationMs: Date.now() - start,
        };
        this.results.push(res);
        return res;
      }

      const res: TestCaseResult = {
        id: opts.id,
        tier: opts.tier,
        feature: opts.feature,
        name: opts.name,
        passed: false,
        skipped: false,
        error: err?.stack || err?.message || String(err),
        durationMs: Date.now() - start,
      };
      this.results.push(res);
      return res;
    }
  }

  skip(reason: string): never {
    const err: any = new Error(reason);
    err.__skip = true;
    throw err;
  }

  assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(`Assertion Failed: ${message}`);
    }
  }

  assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
      throw new Error(
        `Assertion Failed: ${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
      );
    }
  }

  assertDeepEqual<T>(actual: T, expected: T, message: string): void {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) {
      throw new Error(`Assertion Failed: ${message}\n  Expected: ${b}\n  Actual:   ${a}`);
    }
  }

  assertIncludes(actual: string | any[], expected: any, message: string): void {
    if (typeof actual === "string") {
      if (!actual.includes(expected)) {
        throw new Error(
          `Assertion Failed: ${message}\n  Expected string to include: "${expected}"\n  Actual string: "${actual}"`
        );
      }
    } else if (Array.isArray(actual)) {
      if (!actual.includes(expected)) {
        throw new Error(
          `Assertion Failed: ${message}\n  Expected array to include: ${JSON.stringify(expected)}\n  Actual array: ${JSON.stringify(actual)}`
        );
      }
    } else {
      throw new Error(`Assertion Failed: ${message}\n  Target is neither string nor array`);
    }
  }

  assertDefined(value: any, message: string): void {
    if (value === undefined || value === null) {
      throw new Error(`Assertion Failed: ${message} (value is ${value})`);
    }
  }
}
