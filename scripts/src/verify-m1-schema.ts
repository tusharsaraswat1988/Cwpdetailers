import "./load-env.js";
import {
  db,
  pool,
  paymentAttemptsTable,
  paymentMethodEnum,
  customersTable,
  invoicesTable,
  type PaymentAttempt,
  type NewPaymentAttempt,
  type PaymentAttemptStatus,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

interface TestReport {
  name: string;
  passed: boolean;
  details?: string;
}

const report: TestReport[] = [];

function assert(condition: boolean, name: string, details?: string) {
  if (condition) {
    report.push({ name, passed: true, details });
    console.log(`[PASS] ${name}`);
  } else {
    report.push({ name, passed: false, details });
    console.error(`[FAIL] ${name}: ${details}`);
    throw new Error(`Assertion failed: ${name} - ${details}`);
  }
}

async function runEmpiricalVerification() {
  console.log("=== Starting Empirical Verification of paymentAttemptsTable ===");

  // 1. Static / TypeScript type inferences check
  console.log("\n--- Stage 1: TypeScript compilation and schema exports ---");
  assert(paymentAttemptsTable !== undefined, "paymentAttemptsTable is exported");
  assert(paymentMethodEnum !== undefined, "paymentMethodEnum is exported");
  assert(
    paymentMethodEnum.enumValues.includes("cashfree"),
    "paymentMethodEnum includes 'cashfree'",
    `Enum values: ${JSON.stringify(paymentMethodEnum.enumValues)}`
  );

  // Type check simulation
  const dummyAttempt: NewPaymentAttempt = {
    attemptId: "cwp_att_test_dummy",
    cfOrderId: "cwp_order_test_dummy",
    customerId: 1,
    amount: "100.00",
    currency: "INR",
    idempotencyKey: "idem_dummy",
    status: "initiated",
  };
  assert(dummyAttempt.status === "initiated", "NewPaymentAttempt type inference is valid");

  // 2. Fetch or create a test customer
  console.log("\n--- Stage 2: Database Connection & Customer Resolution ---");
  const existingCustomers = await db.select().from(customersTable).limit(1);
  let testCustomerId: number;
  let createdTestCustomer = false;

  if (existingCustomers.length > 0) {
    testCustomerId = existingCustomers[0].id;
    console.log(`Using existing customer ID: ${testCustomerId} (${existingCustomers[0].name})`);
  } else {
    console.log("No existing customer found. Creating temporary customer for test...");
    const [newCustomer] = await db
      .insert(customersTable)
      .values({
        name: "Test Customer M1 Verification",
        phone: "9999998888",
        email: "m1_verify@test.local",
      })
      .returning();
    testCustomerId = newCustomer.id;
    createdTestCustomer = true;
    console.log(`Created temporary customer ID: ${testCustomerId}`);
  }

  // Generate unique test IDs with timestamps
  const nonce = Date.now();
  const testAttemptId = `cwp_att_test_${nonce}`;
  const testCfOrderId = `cwp_order_test_${nonce}`;
  const testIdempotencyKey = `cwp_idem_test_${nonce}`;
  const testAmount = "1499.50";

  let createdAttemptId: number | null = null;

  try {
    // 3. Insert real record into payment_attempts
    console.log("\n--- Stage 3: Live DB Insertion ---");
    const insertPayload: NewPaymentAttempt = {
      attemptId: testAttemptId,
      cfOrderId: testCfOrderId,
      customerId: testCustomerId,
      amount: testAmount,
      currency: "INR",
      cfPaymentSessionId: `session_${nonce}`,
      status: "initiated",
      idempotencyKey: testIdempotencyKey,
      paymentMethod: "cashfree",
      rawWebhookPayload: { event: "order_created", nonce },
      rawVerificationPayload: { verified: false },
    };

    const insertedRows = await db
      .insert(paymentAttemptsTable)
      .values(insertPayload)
      .returning();

    assert(insertedRows.length === 1, "Payment attempt inserted successfully");
    const record = insertedRows[0];
    createdAttemptId = record.id;

    assert(record.attemptId === testAttemptId, "Inserted attemptId matches");
    assert(record.cfOrderId === testCfOrderId, "Inserted cfOrderId matches");
    assert(record.customerId === testCustomerId, "Inserted customerId matches");
    assert(Number(record.amount) === 1499.5, "Inserted amount matches (1499.50)");
    assert(record.currency === "INR", "Inserted currency is INR");
    assert(record.status === "initiated", "Initial status is 'initiated'");
    assert(record.createdAt instanceof Date, "createdAt is a valid Date");
    assert(record.updatedAt instanceof Date, "updatedAt is a valid Date");
    assert(
      (record.rawWebhookPayload as any)?.event === "order_created",
      "rawWebhookPayload JSON stored and retrieved properly"
    );

    // 4. Query using Drizzle Query Builder
    console.log("\n--- Stage 4: Query via Drizzle Query Builder ---");
    const qbResult = await db
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.attemptId, testAttemptId));

    assert(qbResult.length === 1, "Drizzle select query returned exactly 1 record");
    assert(qbResult[0].id === record.id, "Query builder result ID matches inserted record");

    // 5. Query using Raw SQL
    console.log("\n--- Stage 5: Query via Raw SQL ---");
    const rawResult = await db.execute(
      sql`SELECT * FROM payment_attempts WHERE attempt_id = ${testAttemptId}`
    );

    assert(rawResult.rows.length === 1, "Raw SQL query returned exactly 1 row");
    const rawRow = rawResult.rows[0] as any;
    assert(rawRow.attempt_id === testAttemptId, "Raw SQL attempt_id matches");
    assert(rawRow.cf_order_id === testCfOrderId, "Raw SQL cf_order_id matches");
    assert(Number(rawRow.amount) === 1499.5, "Raw SQL amount matches numeric precision");
    assert(rawRow.status === "initiated", "Raw SQL status matches");

    // 6. Test Drizzle Relational Query (relations to customers)
    console.log("\n--- Stage 6: Relational Query via db.query ---");
    if ((db.query as any)?.paymentAttemptsTable) {
      const relResult = await (db.query as any).paymentAttemptsTable.findFirst({
        where: eq(paymentAttemptsTable.attemptId, testAttemptId),
        with: { customer: true },
      });
      assert(relResult !== null, "db.query.paymentAttemptsTable found the record");
      assert(relResult.customer !== null, "db.query relational join to customer returned customer");
      assert(relResult.customer.id === testCustomerId, "Relational customer.id matches expected ID");
    } else {
      console.log("db.query relational API not configured or skipped; Drizzle select with join testing...");
      const joinedResult = await db
        .select({
          attempt: paymentAttemptsTable,
          customer: customersTable,
        })
        .from(paymentAttemptsTable)
        .innerJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
        .where(eq(paymentAttemptsTable.attemptId, testAttemptId));

      assert(joinedResult.length === 1, "Join query returned 1 row");
      assert(joinedResult[0].customer.id === testCustomerId, "Join query customer ID matches");
    }

    // 7. Lifecycle transitions: "initiated" -> "active" -> "paid"
    console.log("\n--- Stage 7: Status Lifecycle Transitions ---");

    // Step A: "initiated" -> "active"
    const [activeRecord] = await db
      .update(paymentAttemptsTable)
      .set({
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(paymentAttemptsTable.id, record.id))
      .returning();

    assert(activeRecord.status === "active", "Status successfully transitioned to 'active'");

    // Step B: "active" -> "paid"
    const cfPaymentId = `cf_pay_${nonce}`;
    const [paidRecord] = await db
      .update(paymentAttemptsTable)
      .set({
        status: "paid",
        cfPaymentId,
        rawVerificationPayload: { verified: true, paymentId: cfPaymentId },
        updatedAt: new Date(),
      })
      .where(eq(paymentAttemptsTable.id, record.id))
      .returning();

    assert(paidRecord.status === "paid", "Status successfully transitioned to 'paid'");
    assert(paidRecord.cfPaymentId === cfPaymentId, "cfPaymentId saved upon payment completion");
    assert(
      (paidRecord.rawVerificationPayload as any)?.verified === true,
      "rawVerificationPayload updated properly"
    );

    // 8. Adversarial Stress-Testing: Failure modes and constraints
    console.log("\n--- Stage 8: Adversarial Stress Testing ---");

    // 8.1: Test other valid statuses ("failed", "user_dropped", "expired")
    for (const validStatus of ["failed", "user_dropped", "expired"] as PaymentAttemptStatus[]) {
      const [updated] = await db
        .update(paymentAttemptsTable)
        .set({ status: validStatus, updatedAt: new Date() })
        .where(eq(paymentAttemptsTable.id, record.id))
        .returning();
      assert(updated.status === validStatus, `Status transitioned to '${validStatus}' successfully`);
    }

    // 8.2: Unique constraint on attempt_id
    console.log("Testing unique constraint on attempt_id...");
    let caughtDuplicateAttemptId = false;
    try {
      await db.insert(paymentAttemptsTable).values({
        attemptId: testAttemptId, // Duplicate!
        cfOrderId: `other_order_${nonce}`,
        customerId: testCustomerId,
        amount: "100.00",
        idempotencyKey: `other_idem_1_${nonce}`,
      });
    } catch (err: any) {
      caughtDuplicateAttemptId = true;
      const errorStr = `${err.message} ${err.cause?.message || ""} ${err.cause?.code || err.code || ""} ${err.cause?.detail || ""}`;
      const isUniqueViolation = errorStr.includes("unique") || errorStr.includes("23505");
      assert(
        isUniqueViolation,
        "Duplicate attempt_id correctly rejected with unique constraint violation",
        errorStr
      );
    }
    assert(caughtDuplicateAttemptId, "Unique attempt_id violation was triggered and caught");

    // 8.3: Unique constraint on cf_order_id
    console.log("Testing unique constraint on cf_order_id...");
    let caughtDuplicateCfOrderId = false;
    try {
      await db.insert(paymentAttemptsTable).values({
        attemptId: `other_att_2_${nonce}`,
        cfOrderId: testCfOrderId, // Duplicate!
        customerId: testCustomerId,
        amount: "100.00",
        idempotencyKey: `other_idem_2_${nonce}`,
      });
    } catch (err: any) {
      caughtDuplicateCfOrderId = true;
      const errorStr = `${err.message} ${err.cause?.message || ""} ${err.cause?.code || err.code || ""} ${err.cause?.detail || ""}`;
      const isUniqueViolation = errorStr.includes("unique") || errorStr.includes("23505");
      assert(
        isUniqueViolation,
        "Duplicate cf_order_id correctly rejected with unique constraint violation",
        errorStr
      );
    }
    assert(caughtDuplicateCfOrderId, "Unique cf_order_id violation was triggered and caught");

    // 8.4: Unique constraint on idempotency_key
    console.log("Testing unique constraint on idempotency_key...");
    let caughtDuplicateIdempotency = false;
    try {
      await db.insert(paymentAttemptsTable).values({
        attemptId: `other_att_3_${nonce}`,
        cfOrderId: `other_order_3_${nonce}`,
        customerId: testCustomerId,
        amount: "100.00",
        idempotencyKey: testIdempotencyKey, // Duplicate!
      });
    } catch (err: any) {
      caughtDuplicateIdempotency = true;
      const errorStr = `${err.message} ${err.cause?.message || ""} ${err.cause?.code || err.code || ""} ${err.cause?.detail || ""}`;
      const isUniqueViolation = errorStr.includes("unique") || errorStr.includes("23505");
      assert(
        isUniqueViolation,
        "Duplicate idempotency_key correctly rejected with unique constraint violation",
        errorStr
      );
    }
    assert(caughtDuplicateIdempotency, "Unique idempotency_key violation was triggered and caught");

    // 8.5: Foreign key constraint on non-existent customer_id
    console.log("Testing foreign key constraint on customer_id...");
    let caughtInvalidCustomer = false;
    try {
      await db.insert(paymentAttemptsTable).values({
        attemptId: `other_att_fk_${nonce}`,
        cfOrderId: `other_order_fk_${nonce}`,
        customerId: 999999999, // Highly unlikely to exist
        amount: "100.00",
        idempotencyKey: `other_idem_fk_${nonce}`,
      });
    } catch (err: any) {
      caughtInvalidCustomer = true;
      const errorStr = `${err.message} ${err.cause?.message || ""} ${err.cause?.code || err.code || ""} ${err.cause?.detail || ""}`;
      const isFkViolation = errorStr.includes("foreign key") || errorStr.includes("23503");
      assert(
        isFkViolation,
        "Invalid customer_id correctly rejected with foreign key constraint violation",
        errorStr
      );
    }
    assert(caughtInvalidCustomer, "Foreign key constraint violation on customer_id was caught");

    // 8.6: Foreign key constraint on non-existent invoice_id
    console.log("Testing foreign key constraint on invoice_id...");
    let caughtInvalidInvoice = false;
    try {
      await db.insert(paymentAttemptsTable).values({
        attemptId: `other_att_inv_fk_${nonce}`,
        cfOrderId: `other_order_inv_fk_${nonce}`,
        customerId: testCustomerId,
        invoiceId: 999999999, // Non-existent invoice
        amount: "100.00",
        idempotencyKey: `other_idem_inv_fk_${nonce}`,
      });
    } catch (err: any) {
      caughtInvalidInvoice = true;
      const errorStr = `${err.message} ${err.cause?.message || ""} ${err.cause?.code || err.code || ""} ${err.cause?.detail || ""}`;
      const isFkViolation = errorStr.includes("foreign key") || errorStr.includes("23503");
      assert(
        isFkViolation,
        "Invalid invoice_id correctly rejected with foreign key constraint violation",
        errorStr
      );
    }
    assert(caughtInvalidInvoice, "Foreign key constraint violation on invoice_id was caught");

    // 8.7: Verify payment_method enum in live Postgres contains 'cashfree'
    console.log("Testing payment_method enum in PostgreSQL catalog...");
    const enumQuery = await db.execute(sql`
      SELECT enumlabel 
      FROM pg_enum 
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid 
      WHERE pg_type.typname = 'payment_method'
    `);
    const enumLabels = enumQuery.rows.map((r: any) => r.enumlabel);
    console.log(`Live PostgreSQL payment_method enum values: ${JSON.stringify(enumLabels)}`);
    assert(
      enumLabels.includes("cashfree"),
      "Live database payment_method enum in pg_type contains 'cashfree'",
      `Values: ${JSON.stringify(enumLabels)}`
    );

    // 8.8: Verify indexes exist in PostgreSQL catalog
    console.log("Testing indexes on payment_attempts table in PostgreSQL catalog...");
    const indexQuery = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'payment_attempts'
    `);
    const indexNames = indexQuery.rows.map((r: any) => r.indexname);
    console.log(`Live PostgreSQL indexes on payment_attempts: ${JSON.stringify(indexNames)}`);
    const expectedIndexes = [
      "payment_attempts_customer_id_idx",
      "payment_attempts_invoice_id_idx",
      "payment_attempts_status_idx",
      "payment_attempts_attempt_id_idx",
      "payment_attempts_cf_order_id_idx",
      "payment_attempts_idempotency_key_idx",
    ];
    for (const expIdx of expectedIndexes) {
      assert(
        indexNames.includes(expIdx),
        `Index '${expIdx}' exists on payment_attempts table in PostgreSQL`
      );
    }

  } finally {
    // 9. Cleanup
    console.log("\n--- Stage 9: Cleanup ---");
    if (createdAttemptId !== null) {
      await db.delete(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, createdAttemptId));
      console.log(`Cleaned up payment_attempts test record ID: ${createdAttemptId}`);
    }

    // Clean up temporary customer if created
    if (createdTestCustomer && testCustomerId) {
      await db.delete(customersTable).where(eq(customersTable.id, testCustomerId));
      console.log(`Cleaned up temporary customer record ID: ${testCustomerId}`);
    }

    // Verify cleanup
    const verifyClean = await db
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.attemptId, testAttemptId));
    assert(verifyClean.length === 0, "Test record confirmed deleted from database");

    await pool.end();
    console.log("Database connection pool closed.");
  }

  // Summary
  console.log("\n=======================================================");
  console.log("                 VERIFICATION SUMMARY                  ");
  console.log("=======================================================");
  const passedCount = report.filter((r) => r.passed).length;
  const failedCount = report.filter((r) => !r.passed).length;
  console.log(`Total tests: ${report.length}`);
  console.log(`Passed: ${passedCount}`);
  console.log(`Failed: ${failedCount}`);

  if (failedCount > 0) {
    console.error("FAIL: Some verification tests failed!");
    process.exit(1);
  } else {
    console.log("SUCCESS: All verification tests PASSED!");
  }
}

runEmpiricalVerification().catch((err) => {
  console.error("Unexpected error during verification:", err);
  process.exit(1);
});
