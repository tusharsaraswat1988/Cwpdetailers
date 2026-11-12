import "./cashfree/harness/loadEnv";

import { TestClient } from "./cashfree/harness/testClient";
import {
  createAdminFixture,
  createTestCustomerFixture,
} from "./cashfree/harness/dbHelpers";
import { db, paymentsTable, paymentAttemptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function runAdminLedgerTests() {
  console.log("================================================================================");
  console.log("             ADMIN PAYMENT LEDGER API TEST SUITE");
  console.log("================================================================================");

  const client = new TestClient();
  await client.start();
  console.log(`[INIT] Test Server running at ${client.getBaseUrl()}`);

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  try {
    const admin = await createAdminFixture();
    const customer = await createTestCustomerFixture({ dueAmount: 1300 });

    // Test 1: RBAC enforcement - unauthenticated rejected with 401
    const unauthRes = await client.request("/api/admin/payments/ledger");
    assert(unauthRes.status === 401, "Unauthenticated request to ledger returns 401 Unauthorized");

    // Test 2: RBAC enforcement - customer role rejected with 403
    const custRes = await client.request("/api/admin/payments/ledger", {
      headers: customer.authHeaders,
    });
    assert(custRes.status === 403, "Customer role request to admin ledger returns 403 Forbidden");

    // Test 3: Admin Summary endpoint
    const summaryRes = await client.request("/api/admin/payments/ledger/summary", {
      headers: admin.authHeaders,
    });
    assert(summaryRes.status === 200, "Admin can access /api/admin/payments/ledger/summary (200 OK)");
    assert(typeof summaryRes.data.todayCollected === "number", "Summary has numeric todayCollected");
    assert(typeof summaryRes.data.todayTransactionsCount === "number", "Summary has numeric todayTransactionsCount");
    assert(typeof summaryRes.data.thisMonthCollected === "number", "Summary has numeric thisMonthCollected");
    assert(typeof summaryRes.data.pendingTransactionsCount === "number", "Summary has numeric pendingTransactionsCount");
    assert(typeof summaryRes.data.failedTransactionsCount === "number", "Summary has numeric failedTransactionsCount");
    assert(typeof summaryRes.data.totalCollectedAllTime === "number", "Summary has numeric totalCollectedAllTime");
    assert(typeof summaryRes.data.totalOutstandingCustomerDues === "number", "Summary has numeric totalOutstandingCustomerDues");
    assert(typeof summaryRes.data.calculatedAtIst === "string", "Summary includes calculatedAtIst formatted string");

    // Test 4: Admin Ledger paginated list
    const ledgerRes = await client.request("/api/admin/payments/ledger?limit=10&page=1", {
      headers: admin.authHeaders,
    });
    assert(ledgerRes.status === 200, "Admin can access /api/admin/payments/ledger (200 OK)");
    assert(Array.isArray(ledgerRes.data.data), "Ledger data is an array of rows");
    assert(typeof ledgerRes.data.total === "number", "Ledger response has total count");
    assert(ledgerRes.data.page === 1, "Page is 1");
    assert(ledgerRes.data.limit === 10, "Limit is 10");

    // Test 5: Verify ledger row schema on entries if present
    if (ledgerRes.data.data.length > 0) {
      const row = ledgerRes.data.data[0];
      assert(row.id != null, "Ledger row has unique id");
      assert(row.paymentDate != null, "Ledger row has paymentDate ISO timestamp");
      assert(row.paymentDateIst != null, "Ledger row has formatted paymentDateIst");
      assert(row.customerName != null, "Ledger row has customerName");
      assert(row.city != null, "Ledger row has city");
      assert(row.amountPaid != null, "Ledger row has amountPaid");
      assert(row.status != null, "Ledger row has status (success/pending/failed/abandoned/reversed)");
    }

    // Test 6: In-flight pending attempt visible in ledger
    const testOrderId = `cwp_test_order_${Date.now()}`;
    const [attempt] = await db
      .insert(paymentAttemptsTable)
      .values({
        attemptId: `cwp_att_test_${Date.now()}`,
        cfOrderId: testOrderId,
        customerId: customer.customerId,
        invoiceId: customer.invoiceId,
        amount: "1300.00",
        currency: "INR",
        status: "initiated",
        idempotencyKey: `idem_test_${Date.now()}`,
      })
      .returning();

    const pendingLedgerRes = await client.request(
      `/api/admin/payments/ledger?search=${encodeURIComponent(attempt.cfOrderId)}`,
      { headers: admin.authHeaders }
    );
    assert(pendingLedgerRes.status === 200, "Can search ledger by Cashfree Order ID");
    const foundAttempt = pendingLedgerRes.data.data.find(
      (r: any) => r.cfOrderId === attempt.cfOrderId
    );
    assert(foundAttempt != null, "Pending payment attempt is visible in Admin Ledger");
    if (foundAttempt) {
      assert(foundAttempt.status === "pending", "Attempt with status initiated maps to ledger status 'pending'");
      assert(foundAttempt.amountPaid === 1300, "Attempt amount is correctly reported as 1300");
    }

    // Test 7: Filter by status
    const statusFilterRes = await client.request("/api/admin/payments/ledger?status=pending", {
      headers: admin.authHeaders,
    });
    assert(statusFilterRes.status === 200, "Status filter query succeeds");
    const allPending = statusFilterRes.data.data.every((r: any) => r.status === "pending");
    assert(allPending, "All returned rows with ?status=pending have status 'pending'");

    // Test 8: Filter by method
    const methodFilterRes = await client.request("/api/admin/payments/ledger?method=cashfree", {
      headers: admin.authHeaders,
    });
    assert(methodFilterRes.status === 200, "Method filter query succeeds");
    const allCashfree = methodFilterRes.data.data.every(
      (r: any) => r.paymentMethod.toLowerCase() === "cashfree"
    );
    assert(allCashfree, "All returned rows with ?method=cashfree have cashfree payment method");

    // Test 9: CSV Export endpoint
    const exportRes = await client.request("/api/admin/payments/ledger/export", {
      headers: admin.authHeaders,
    });
    assert(exportRes.status === 200, "Admin can export ledger as CSV (200 OK)");
    const contentType = exportRes.headers.get("content-type") || "";
    assert(contentType.includes("text/csv"), "Export response Content-Type is text/csv");
    const disposition = exportRes.headers.get("content-disposition") || "";
    assert(disposition.includes("attachment"), "Export response has Content-Disposition: attachment");
    assert(exportRes.rawText.includes("Payment Date & Time (IST)"), "CSV has Payment Date & Time (IST) header");
    assert(exportRes.rawText.includes("Cashfree Order ID"), "CSV has Cashfree Order ID header");
    assert(exportRes.rawText.includes("Internal Reference"), "CSV has Internal Reference header");

    // Test 10: Single transaction detail
    if (foundAttempt) {
      const detailRes = await client.request(`/api/admin/payments/ledger/${foundAttempt.id}`, {
        headers: admin.authHeaders,
      });
      assert(detailRes.status === 200, "Admin can fetch single transaction detail by id");
      assert(detailRes.data.id === foundAttempt.id, "Detail returns matching transaction id");
      assert(detailRes.data.customerId === customer.customerId, "Detail returns matching customerId");
    }

    console.log("--------------------------------------------------------------------------------");
    console.log(`Summary: Passed: ${passed} | Failed: ${failed}`);
    console.log("================================================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await client.stop();
  }
}

runAdminLedgerTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
