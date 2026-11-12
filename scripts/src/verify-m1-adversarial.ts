import "./load-env.js";
import { pool, db } from "@workspace/db";
import { paymentAttemptsTable, paymentsTable, customersTable, invoicesTable } from "@workspace/db";
import { eq, sql, like } from "drizzle-orm";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { isMigrationAlreadyApplied, type Queryable } from "./migration-state.js";

const TEST_PREFIX = "test_adv_" + Date.now();
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  detail?: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, detail?: string, error?: string) {
  results.push({ name, passed, detail, error });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] ${name}`);
  if (detail) console.log(`       ${detail}`);
  if (error) console.error(`       ERROR: ${error}`);
}

async function main() {
  console.log("===============================================================================");
  console.log("   Milestone 1: Empirical Adversarial Challenge Verification Suite             ");
  console.log(`   Test Run ID: ${TEST_PREFIX}`);
  console.log("===============================================================================\n");

  let testCustomerId: number | null = null;
  let testInvoiceId: number | null = null;
  let createdTestCustomer = false;
  let createdTestInvoice = false;

  try {
    // -------------------------------------------------------------------------
    // Phase 0: Provision or identify fixture data
    // -------------------------------------------------------------------------
    console.log("--- Phase 0: Environment & Fixture Setup ---");

    // 0.1 Check DB connectivity
    const ping = await pool.query("SELECT 1 AS ok");
    recordTest(
      "Database Connectivity",
      Boolean(ping.rows[0]?.ok),
      "Connected successfully to PostgreSQL database",
    );

    // 0.2 Check payment_attempts table exists
    const tblCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_attempts'
      ) AS ok
    `);
    recordTest(
      "Table 'payment_attempts' Exists",
      Boolean(tblCheck.rows[0]?.ok),
      "Verified 'payment_attempts' is present in public schema",
    );

    // 0.3 Check enum label 'cashfree' in payment_method
    const enumCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'payment_method' AND e.enumlabel = 'cashfree'
      ) AS ok
    `);
    recordTest(
      "Enum 'payment_method' includes 'cashfree'",
      Boolean(enumCheck.rows[0]?.ok),
      "Verified 'cashfree' enum label exists in pg_type / pg_enum",
    );

    // 0.4 Find or create a test customer
    const existingCust = await pool.query("SELECT id FROM customers ORDER BY id LIMIT 1");
    if (existingCust.rows.length > 0) {
      testCustomerId = existingCust.rows[0].id;
    } else {
      const insertedCust = await pool.query(
        `INSERT INTO customers (name, phone) VALUES ('Adversarial Customer', '${TEST_PREFIX.slice(-10)}') RETURNING id`,
      );
      testCustomerId = insertedCust.rows[0].id;
      createdTestCustomer = true;
    }
    console.log(`       Using test customerId: ${testCustomerId}`);

    // 0.5 Find or create a test invoice
    const existingInv = await pool.query("SELECT id FROM invoices ORDER BY id LIMIT 1");
    if (existingInv.rows.length > 0) {
      testInvoiceId = existingInv.rows[0].id;
    } else {
      const insertedInv = await pool.query(
        `INSERT INTO invoices (invoice_number, customer_id, total_amount) 
         VALUES ('INV-${TEST_PREFIX}', ${testCustomerId}, '1000.00') RETURNING id`,
      );
      testInvoiceId = insertedInv.rows[0].id;
      createdTestInvoice = true;
    }
    console.log(`       Using test invoiceId: ${testInvoiceId}\n`);

    // -------------------------------------------------------------------------
    // Phase 1: Uniqueness Constraints on payment_attempts
    // -------------------------------------------------------------------------
    console.log("--- Phase 1: Uniqueness Constraint Stress Testing ---");

    const baseAttemptId = `${TEST_PREFIX}_att_base`;
    const baseCfOrderId = `${TEST_PREFIX}_cf_base`;
    const baseIdempotencyKey = `${TEST_PREFIX}_idem_base`;

    // Insert baseline record
    await pool.query(`
      INSERT INTO payment_attempts (
        attempt_id, cf_order_id, customer_id, amount, idempotency_key, status
      ) VALUES (
        '${baseAttemptId}', '${baseCfOrderId}', ${testCustomerId}, '999.00', '${baseIdempotencyKey}', 'initiated'
      )
    `);

    // 1.1 Duplicate attempt_id
    try {
      await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, amount, idempotency_key
        ) VALUES (
          '${baseAttemptId}', '${TEST_PREFIX}_cf_diff1', ${testCustomerId}, '100.00', '${TEST_PREFIX}_idem_diff1'
        )
      `);
      recordTest("Reject Duplicate attempt_id", false, "Expected unique violation, but insert succeeded");
    } catch (err: any) {
      const isUniqueViol = err.code === "23505";
      recordTest(
        "Reject Duplicate attempt_id",
        isUniqueViol,
        `Postgres error code ${err.code} (detail: ${err.detail || err.message})`,
        isUniqueViol ? undefined : err.message,
      );
    }

    // 1.2 Duplicate cf_order_id
    try {
      await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, amount, idempotency_key
        ) VALUES (
          '${TEST_PREFIX}_att_diff2', '${baseCfOrderId}', ${testCustomerId}, '200.00', '${TEST_PREFIX}_idem_diff2'
        )
      `);
      recordTest("Reject Duplicate cf_order_id", false, "Expected unique violation, but insert succeeded");
    } catch (err: any) {
      const isUniqueViol = err.code === "23505";
      recordTest(
        "Reject Duplicate cf_order_id",
        isUniqueViol,
        `Postgres error code ${err.code} (detail: ${err.detail || err.message})`,
        isUniqueViol ? undefined : err.message,
      );
    }

    // 1.3 Duplicate idempotency_key
    try {
      await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, amount, idempotency_key
        ) VALUES (
          '${TEST_PREFIX}_att_diff3', '${TEST_PREFIX}_cf_diff3', ${testCustomerId}, '300.00', '${baseIdempotencyKey}'
        )
      `);
      recordTest("Reject Duplicate idempotency_key", false, "Expected unique violation, but insert succeeded");
    } catch (err: any) {
      const isUniqueViol = err.code === "23505";
      recordTest(
        "Reject Duplicate idempotency_key",
        isUniqueViol,
        `Postgres error code ${err.code} (detail: ${err.detail || err.message})`,
        isUniqueViol ? undefined : err.message,
      );
    }

    // -------------------------------------------------------------------------
    // Phase 2: Foreign Key Constraints on payment_attempts
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 2: Foreign Key Constraint Stress Testing ---");

    const nonExistentCustomerId = 2147483640;
    const nonExistentInvoiceId = 2147483640;

    // 2.1 Invalid customer_id foreign key
    try {
      await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, amount, idempotency_key
        ) VALUES (
          '${TEST_PREFIX}_att_fk1', '${TEST_PREFIX}_cf_fk1', ${nonExistentCustomerId}, '400.00', '${TEST_PREFIX}_idem_fk1'
        )
      `);
      recordTest("Reject Invalid customer_id Foreign Key", false, "Expected FK violation, but insert succeeded");
    } catch (err: any) {
      const isFkViol = err.code === "23503";
      recordTest(
        "Reject Invalid customer_id Foreign Key",
        isFkViol,
        `Postgres error code ${err.code} (detail: ${err.detail || err.message})`,
        isFkViol ? undefined : err.message,
      );
    }

    // 2.2 Invalid invoice_id foreign key
    try {
      await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, invoice_id, amount, idempotency_key
        ) VALUES (
          '${TEST_PREFIX}_att_fk2', '${TEST_PREFIX}_cf_fk2', ${testCustomerId}, ${nonExistentInvoiceId}, '500.00', '${TEST_PREFIX}_idem_fk2'
        )
      `);
      recordTest("Reject Invalid invoice_id Foreign Key", false, "Expected FK violation, but insert succeeded");
    } catch (err: any) {
      const isFkViol = err.code === "23503";
      recordTest(
        "Reject Invalid invoice_id Foreign Key",
        isFkViol,
        `Postgres error code ${err.code} (detail: ${err.detail || err.message})`,
        isFkViol ? undefined : err.message,
      );
    }

    // 2.3 Valid invoice_id foreign key accepts valid reference and null
    try {
      const resWithInv = await pool.query(`
        INSERT INTO payment_attempts (
          attempt_id, cf_order_id, customer_id, invoice_id, amount, idempotency_key
        ) VALUES (
          '${TEST_PREFIX}_att_fk_ok', '${TEST_PREFIX}_cf_fk_ok', ${testCustomerId}, ${testInvoiceId}, '600.00', '${TEST_PREFIX}_idem_fk_ok'
        ) RETURNING id
      `);
      recordTest(
        "Accept Valid invoice_id Reference",
        Boolean(resWithInv.rows[0]?.id),
        `Inserted payment_attempt id ${resWithInv.rows[0]?.id} with valid invoice_id`,
      );
    } catch (err: any) {
      recordTest("Accept Valid invoice_id Reference", false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // Phase 3: NOT NULL Constraints on payment_attempts
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 3: NOT NULL Constraint Stress Testing ---");

    const requiredColumns = [
      { col: "attempt_id", val: "NULL" },
      { col: "cf_order_id", val: "NULL" },
      { col: "customer_id", val: "NULL" },
      { col: "amount", val: "NULL" },
      { col: "idempotency_key", val: "NULL" },
    ];

    for (const { col, val } of requiredColumns) {
      try {
        await pool.query(`
          INSERT INTO payment_attempts (
            attempt_id, cf_order_id, customer_id, amount, idempotency_key
          ) VALUES (
            ${col === "attempt_id" ? val : `'${TEST_PREFIX}_att_nn_${col}'`},
            ${col === "cf_order_id" ? val : `'${TEST_PREFIX}_cf_nn_${col}'`},
            ${col === "customer_id" ? val : testCustomerId},
            ${col === "amount" ? val : "'100.00'"},
            ${col === "idempotency_key" ? val : `'${TEST_PREFIX}_idem_nn_${col}'`}
          )
        `);
        recordTest(`Reject NOT NULL on ${col}`, false, `Expected not_null violation for ${col}`);
      } catch (err: any) {
        const isNotNullViol = err.code === "23502";
        recordTest(
          `Reject NOT NULL on ${col}`,
          isNotNullViol,
          `Enforced not-null with error code ${err.code}`,
          isNotNullViol ? undefined : err.message,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Phase 4: Payment Method Enum & Payments Table Integration
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 4: Payment Method Enum & payments Table Stress Testing ---");

    const testTxId = `${TEST_PREFIX}_tx_cashfree_ok`;

    // 4.1 Insert payment with method = 'cashfree'
    try {
      const insRes = await pool.query(`
        INSERT INTO payments (
          customer_id, invoice_id, amount, method, transaction_id, status, notes
        ) VALUES (
          ${testCustomerId}, ${testInvoiceId}, '1499.00', 'cashfree', '${testTxId}', 'completed', 'Adversarial Cashfree test payment'
        ) RETURNING id, method, status, amount
      `);
      const row = insRes.rows[0];
      const valid = row && row.method === "cashfree" && row.amount === "1499.00";
      recordTest(
        "Insert payments with method = 'cashfree'",
        valid,
        `Inserted payment id ${row?.id} with method '${row?.method}' and status '${row?.status}'`,
      );
    } catch (err: any) {
      recordTest("Insert payments with method = 'cashfree'", false, undefined, err.message);
    }

    // 4.2 Query payment back via Drizzle ORM
    try {
      const drizzlePayments = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.transactionId, testTxId));
      const found = drizzlePayments.length === 1 && drizzlePayments[0].method === "cashfree";
      recordTest(
        "Drizzle ORM Query Payment with method = 'cashfree'",
        found,
        `Retrieved payment record id ${drizzlePayments[0]?.id} through Drizzle schema types`,
      );
    } catch (err: any) {
      recordTest("Drizzle ORM Query Payment with method = 'cashfree'", false, undefined, err.message);
    }

    // 4.3 Reject invalid payment_method enum value
    try {
      await pool.query(`
        INSERT INTO payments (
          customer_id, amount, method, transaction_id
        ) VALUES (
          ${testCustomerId}, '100.00', 'unsupported_gateway', '${TEST_PREFIX}_tx_bad'
        )
      `);
      recordTest("Reject Invalid payment_method Enum Value", false, "Expected enum violation, but insert succeeded");
    } catch (err: any) {
      const isEnumViol = err.code === "22P02";
      recordTest(
        "Reject Invalid payment_method Enum Value",
        isEnumViol,
        `Postgres error code ${err.code} (invalid enum representation)`,
        isEnumViol ? undefined : err.message,
      );
    }

    // -------------------------------------------------------------------------
    // Phase 5: JSONB Payloads, Status Transitions & Drizzle Schema Types
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 5: JSONB Payloads & Drizzle Lifecycle Testing ---");

    const lifecycleAttemptId = `${TEST_PREFIX}_att_lifecycle`;
    const lifecycleCfOrderId = `${TEST_PREFIX}_cf_lifecycle`;
    const lifecycleIdem = `${TEST_PREFIX}_idem_lifecycle`;

    const sampleWebhookPayload = {
      event: "PAYMENT_SUCCESS_WEBHOOK",
      data: {
        order: { order_id: lifecycleCfOrderId, order_amount: 899.5 },
        payment: {
          cf_payment_id: "12345678",
          payment_method: "netbanking",
          payment_currency: "INR",
          payment_time: new Date().toISOString(),
        },
      },
    };

    const sampleVerificationPayload = {
      order_id: lifecycleCfOrderId,
      order_status: "PAID",
      order_amount: 899.5,
    };

    // 5.1 Insert payment attempt via Drizzle with JSONB
    try {
      const [inserted] = await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId: lifecycleAttemptId,
          cfOrderId: lifecycleCfOrderId,
          customerId: testCustomerId,
          invoiceId: testInvoiceId,
          amount: "899.50",
          currency: "INR",
          cfPaymentSessionId: "session_token_xyz_123",
          status: "initiated",
          idempotencyKey: lifecycleIdem,
          rawWebhookPayload: sampleWebhookPayload,
          rawVerificationPayload: sampleVerificationPayload,
        })
        .returning();

      recordTest(
        "Drizzle Insert payment_attempts with JSONB Payloads",
        Boolean(inserted?.id),
        `Created attempt id ${inserted?.id} with initial status '${inserted?.status}' and session id`,
      );

      // 5.2 Update attempt status to 'paid' and add cfPaymentId
      const [updated] = await db
        .update(paymentAttemptsTable)
        .set({
          status: "paid",
          cfPaymentId: "cf_pay_99999",
          paymentMethod: "netbanking",
        })
        .where(eq(paymentAttemptsTable.id, inserted.id))
        .returning();

      const jsonbMatch =
        (updated.rawWebhookPayload as any)?.event === "PAYMENT_SUCCESS_WEBHOOK" &&
        (updated.rawVerificationPayload as any)?.order_status === "PAID";

      recordTest(
        "Update payment_attempts Status & Preserve JSONB",
        updated.status === "paid" && updated.cfPaymentId === "cf_pay_99999" && jsonbMatch,
        `Status updated to '${updated.status}', cfPaymentId set, JSONB payload intact`,
      );
    } catch (err: any) {
      recordTest("Drizzle Lifecycle & JSONB Testing", false, undefined, err.message);
    }

    // -------------------------------------------------------------------------
    // Phase 6: Migration Idempotency Stress Testing
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 6: Migration Idempotency Stress Testing ---");

    // 6.1 Direct SQL idempotency: execute migration 063 SQL multiple times directly
    try {
      const migrationSqlPath = path.join(rootDir, "lib/db/migrations/063_cashfree_payment_gateway.sql");
      const migrationSql = readFileSync(migrationSqlPath, "utf8");

      // Execute once directly
      await pool.query(migrationSql);
      // Execute a second time directly
      await pool.query(migrationSql);

      recordTest(
        "Direct SQL Idempotency (063_cashfree_payment_gateway.sql)",
        true,
        "Executed 063 SQL 2x directly against PostgreSQL; DDL 'IF NOT EXISTS' handled smoothly",
      );
    } catch (err: any) {
      recordTest("Direct SQL Idempotency (063_cashfree_payment_gateway.sql)", false, undefined, err.message);
    }

    // 6.2 Test migration-state detection: isMigrationAlreadyApplied
    try {
      const isApplied = await isMigrationAlreadyApplied(
        pool as unknown as Queryable,
        "063_cashfree_payment_gateway.sql",
      );
      recordTest(
        "isMigrationAlreadyApplied Schema Detection",
        isApplied,
        "Migration detector returned true based on table 'payment_attempts' and enum 'cashfree'",
      );
    } catch (err: any) {
      recordTest("isMigrationAlreadyApplied Schema Detection", false, undefined, err.message);
    }

    // 6.3 Test runner idempotency via pnpm run migrate:pending
    try {
      const run1 = execSync("pnpm run migrate:pending", { cwd: rootDir, encoding: "utf8" });
      const run1Pass = run1.includes("Skip 063_cashfree_payment_gateway.sql (already recorded)") ||
                       run1.includes("All pending migrations applied.");

      const run2 = execSync("pnpm run migrate:pending", { cwd: rootDir, encoding: "utf8" });
      const run2Pass = run2.includes("Skip 063_cashfree_payment_gateway.sql (already recorded)") &&
                       run2.includes("All pending migrations applied.");

      recordTest(
        "pnpm run migrate:pending Runner Idempotency",
        run1Pass && run2Pass,
        "Repeated execution of migrate:pending is deterministic, exits with 0 and skips recorded files",
      );
    } catch (err: any) {
      recordTest("pnpm run migrate:pending Runner Idempotency", false, undefined, err.message);
    }

    // 6.4 Simulate unrecorded schema migration:
    // Remove migration 063 from schema_migrations tracking table and re-run migrate:pending
    try {
      await pool.query(
        "DELETE FROM schema_migrations WHERE filename = '063_cashfree_payment_gateway.sql'",
      );

      const unrecordedRun = execSync("pnpm run migrate:pending", { cwd: rootDir, encoding: "utf8" });
      const detectedInSchema = unrecordedRun.includes("Skip 063_cashfree_payment_gateway.sql (already applied in schema)");

      // Check it was re-recorded in schema_migrations
      const reRecorded = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE filename = '063_cashfree_payment_gateway.sql'",
      );

      recordTest(
        "Automatic Schema Re-sync on Missing Tracking Entry",
        detectedInSchema && reRecorded.rows.length === 1,
        "Detected existing table/enum, printed 'already applied in schema', and self-healed tracking table",
      );
    } catch (err: any) {
      recordTest("Automatic Schema Re-sync on Missing Tracking Entry", false, undefined, err.message);
    }

  } finally {
    // -------------------------------------------------------------------------
    // Phase 7: Clean Teardown
    // -------------------------------------------------------------------------
    console.log("\n--- Phase 7: Clean Teardown ---");
    try {
      // Clean payment_attempts
      const delAttempts = await pool.query(
        `DELETE FROM payment_attempts WHERE attempt_id LIKE '${TEST_PREFIX}%'`
      );
      console.log(`       Deleted ${delAttempts.rowCount} test payment_attempts records.`);

      // Clean payments
      const delPayments = await pool.query(
        `DELETE FROM payments WHERE transaction_id LIKE '${TEST_PREFIX}%'`
      );
      console.log(`       Deleted ${delPayments.rowCount} test payments records.`);

      // Clean temporary invoices if created
      if (createdTestInvoice && testInvoiceId) {
        await pool.query(`DELETE FROM invoices WHERE id = ${testInvoiceId}`);
        console.log(`       Cleaned temporary test invoice id: ${testInvoiceId}`);
      }

      // Clean temporary customer if created
      if (createdTestCustomer && testCustomerId) {
        await pool.query(`DELETE FROM customers WHERE id = ${testCustomerId}`);
        console.log(`       Cleaned temporary test customer id: ${testCustomerId}`);
      }

      recordTest(
        "Teardown Cleaned All Test Records",
        true,
        "Zero test artifacts left behind in the database",
      );
    } catch (cleanErr: any) {
      recordTest(
        "Teardown Cleaned All Test Records",
        false,
        undefined,
        `Cleanup error: ${cleanErr.message}`,
      );
    }

    await pool.end();
  }

  // ---------------------------------------------------------------------------
  // Summary & Verdict
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log("   Verification Summary & Verdict                                             ");
  console.log("===============================================================================");

  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Checks: ${total} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFAILURES ENCOUNTERED:");
    for (const f of results.filter((r) => !r.passed)) {
      console.log(` - ${f.name}: ${f.error || f.detail || "Failed"}`);
    }
    console.log("\nVERDICT: REQUEST_CHANGES");
    process.exit(1);
  } else {
    console.log("\nAll constraint, uniqueness, enum, lifecycle, and idempotency checks PASSED!");
    console.log("VERDICT: APPROVE");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("FATAL ERROR running adversarial verification suite:", err);
  process.exit(1);
});
