import "./harness/loadEnv";

import { MockCashfreeGateway } from "./harness/mockCashfreeServer";
import { TestClient } from "./harness/testClient";
import { TestRunnerContext } from "./harness/testContext";
import { emergencyCleanupOrphanFixtures } from "./harness/dbHelpers";
import { runTier1F1F5 } from "./tier1-features/test-f1-f5-core";
import { runTier1F6F10 } from "./tier1-features/test-f6-f10-gateway";
import { runTier1F11F15 } from "./tier1-features/test-f11-f15-journey";
import { runTier1F16F19 } from "./tier1-features/test-f16-f19-admin";
import { runTier2Boundaries } from "./tier2-boundaries/test-tier2-boundaries";
import { runTier3Combinations } from "./tier3-combinations/test-tier3-combinations";
import { runTier4Scenarios } from "./tier4-scenarios/test-tier4-scenarios";

async function main() {
  console.log("================================================================================");
  console.log("         CWP DETAILERS — CASHFREE PAYMENT GATEWAY E2E TEST SUITE");
  console.log("================================================================================");
  console.log(`Node: ${process.version} | Timestamp: ${new Date().toISOString()}`);
  console.log("--------------------------------------------------------------------------------\n");

  const mockGateway = new MockCashfreeGateway();
  const testClient = new TestClient();

  const startTime = Date.now();

  try {
    // 0. Clean any orphaned test fixtures from prior crashed runs
    await emergencyCleanupOrphanFixtures();

    // 1. Start embedded mock Cashfree gateway on ephemeral port
    console.log("[INIT] Starting Mock Cashfree PG Gateway...");
    const { baseUrl: mockBaseUrl } = await mockGateway.start();
    console.log(`[INIT] Mock Cashfree Gateway listening at: ${mockBaseUrl}`);

    process.env.CASHFREE_BASE_URL = mockBaseUrl;
    process.env.CASHFREE_APP_ID = mockGateway.clientId;
    process.env.CASHFREE_SECRET_KEY = mockGateway.secretKey;
    process.env.CASHFREE_ENV = "sandbox";
    process.env.CASHFREE_API_VERSION = "2023-08-01";

    // 2. Start Express app test client on ephemeral port
    console.log("[INIT] Starting CWP API Server TestClient...");
    const apiBaseUrl = await testClient.start();
    console.log(`[INIT] CWP API Server listening at: ${apiBaseUrl}\n`);

    // 3. Initialize test context
    const ctx = new TestRunnerContext(testClient, mockGateway);

    // =========================================================================
    // EXECUTE TEST SUITES
    // =========================================================================

    console.log(">>> RUNNING TIER 1: FEATURE COVERAGE (F1 to F19)");
    console.log("--------------------------------------------------------------------------------");
    await runTier1F1F5(ctx);
    await runTier1F6F10(ctx);
    await runTier1F11F15(ctx);
    await runTier1F16F19(ctx);

    console.log("\n>>> RUNNING TIER 2: BOUNDARY & CORNER CASES (6 Areas)");
    console.log("--------------------------------------------------------------------------------");
    await runTier2Boundaries(ctx);

    console.log("\n>>> RUNNING TIER 3: CROSS-FEATURE COMBINATIONS & STATE MACHINE (5 Combos)");
    console.log("--------------------------------------------------------------------------------");
    await runTier3Combinations(ctx);

    console.log("\n>>> RUNNING TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 Journeys)");
    console.log("--------------------------------------------------------------------------------");
    await runTier4Scenarios(ctx);

    // =========================================================================
    // REPORTING & SUMMARY
    // =========================================================================

    const totalDuration = Date.now() - startTime;
    const allResults = ctx.results;
    const totalCount = allResults.length;
    const passedCount = allResults.filter((r) => r.passed).length;
    const failedCount = allResults.filter((r) => !r.passed && !r.skipped).length;
    const skippedCount = allResults.filter((r) => r.skipped).length;

    console.log("\n================================================================================");
    console.log("                              TEST EXECUTION SUMMARY");
    console.log("================================================================================");

    // Group by Tier
    for (let t = 1; t <= 4; t++) {
      const tierResults = allResults.filter((r) => r.tier === t);
      const tierPassed = tierResults.filter((r) => r.passed).length;
      const tierFailed = tierResults.filter((r) => !r.passed && !r.skipped).length;
      const tierSkipped = tierResults.filter((r) => r.skipped).length;
      console.log(
        `Tier ${t}: Total: ${tierResults.length.toString().padStart(2)} | ` +
          `Passed: ${tierPassed.toString().padStart(2)} | ` +
          `Failed: ${tierFailed.toString().padStart(2)} | ` +
          `Pending M2/M3: ${tierSkipped.toString().padStart(2)}`
      );
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(
      `GRAND TOTAL: ${totalCount} Assertions | Passed: ${passedCount} | Failed: ${failedCount} | Pending M2/M3: ${skippedCount}`
    );
    console.log(`Total Execution Time: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log("================================================================================");

    if (failedCount > 0) {
      console.error("\n[FAILURES DETECTED]");
      const failures = allResults.filter((r) => !r.passed && !r.skipped);
      for (const f of failures) {
        console.error(`- [${f.id}] ${f.name}`);
        console.error(`  Error: ${f.error}`);
      }
      process.exit(1);
    } else {
      console.log("\n[SUCCESS] All executed tests passed cleanly! No regressions or test failures.");
      process.exit(0);
    }
  } catch (globalErr: any) {
    console.error("\n[FATAL RUNNER ERROR]:", globalErr);
    process.exit(1);
  } finally {
    try {
      await emergencyCleanupOrphanFixtures();
      await testClient.stop();
      await mockGateway.stop();
    } catch (cleanupErr) {
      console.warn("Cleanup error:", cleanupErr);
    }
  }
}

main().catch((err) => {
  console.error("Unhandled top-level error:", err);
  process.exit(1);
});
