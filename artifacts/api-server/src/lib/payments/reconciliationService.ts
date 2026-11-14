import { db, paymentsTable, paymentAttemptsTable, paymentRefundsTable, invoicesTable, customersTable, bookingsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, and, sql, desc, gte, lte, or, inArray } from "drizzle-orm";
import { CashfreeClient } from "../cashfree/cashfreeClient";
import { reconcileCashfreePayment } from "../cashfree/cashfreeService";
import { logger } from "../logger";

export type ReconciliationCategory =
  | "MATCHED"
  | "INTERNAL_WITHOUT_GATEWAY"
  | "GATEWAY_WITHOUT_INTERNAL"
  | "AMOUNT_MISMATCH"
  | "STATUS_MISMATCH"
  | "DUPLICATE_TRANSACTION"
  | "REFUND_MISMATCH"
  | "SETTLEMENT_PENDING";

export interface ReconciliationItem {
  id: string;
  category: ReconciliationCategory;
  severity: "info" | "warning" | "critical";
  transactionDate: string;
  transactionDateIst: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  city: string;
  branchId: number | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  bookingId: number | null;
  bookingRef: string | null;
  internalAmount: number | null;
  gatewayAmount: number | null;
  discrepancyAmount: number;
  gatewayProvider: string;
  orderId: string | null;
  paymentId: string | null;
  internalStatus: string | null;
  gatewayStatus: string | null;
  refundStatus: string;
  actionRequired: string;
  canAutoReconcile: boolean;
}

export interface ReconciliationSummary {
  period: string;
  totalTransactions: number;
  totalInternalPaidAmount: number;
  totalMatchedAmount: number;
  matchedCount: number;
  unmatchedCount: number;
  amountMismatchCount: number;
  statusMismatchCount: number;
  missingInternalCount: number;
  missingGatewayCount: number;
  refundMismatchCount: number;
  duplicateCount: number;
  reconciliationHealthScore: number;
  calculatedAtIst: string;
}

function formatIstDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dateObj = typeof d === "string" ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return "—";

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(dateObj);
}

/**
 * Runs the comprehensive 3-way reconciliation engine across payments, gateway attempts, and invoices/bookings.
 */
export async function runReconciliationAnalysis(options?: {
  startDate?: string;
  endDate?: string;
  city?: string;
  branchId?: number;
  category?: string;
}): Promise<{ items: ReconciliationItem[]; summary: ReconciliationSummary }> {
  const { startDate, endDate, city, branchId, category } = options || {};

  const now = new Date();
  let startUtc: Date | undefined;
  let endUtc: Date | undefined;

  if (startDate) {
    const s = new Date(`${startDate}T00:00:00+05:30`);
    if (!isNaN(s.getTime())) startUtc = s;
  }
  if (endDate) {
    const e = new Date(`${endDate}T23:59:59.999+05:30`);
    if (!isNaN(e.getTime())) endUtc = e;
  }

  // 1. Fetch completed & active payments
  const paymentConditions = [];
  if (startUtc) paymentConditions.push(gte(paymentsTable.createdAt, startUtc));
  if (endUtc) paymentConditions.push(lte(paymentsTable.createdAt, endUtc));

  const payments = await db
    .select({
      payment: paymentsTable,
      customer: customersTable,
      invoice: invoicesTable,
    })
    .from(paymentsTable)
    .leftJoin(customersTable, eq(paymentsTable.customerId, customersTable.id))
    .leftJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .where(paymentConditions.length > 0 ? and(...paymentConditions) : undefined)
    .orderBy(desc(paymentsTable.createdAt));

  // 2. Fetch payment attempts
  const attemptConditions = [];
  if (startUtc) attemptConditions.push(gte(paymentAttemptsTable.createdAt, startUtc));
  if (endUtc) attemptConditions.push(lte(paymentAttemptsTable.createdAt, endUtc));

  const attempts = await db
    .select({
      attempt: paymentAttemptsTable,
      customer: customersTable,
      invoice: invoicesTable,
    })
    .from(paymentAttemptsTable)
    .leftJoin(customersTable, eq(paymentAttemptsTable.customerId, customersTable.id))
    .leftJoin(invoicesTable, eq(paymentAttemptsTable.invoiceId, invoicesTable.id))
    .where(attemptConditions.length > 0 ? and(...attemptConditions) : undefined)
    .orderBy(desc(paymentAttemptsTable.createdAt));

  // Build lookup maps for cross-checking
  const paymentByOrderId = new Map<string, typeof payments[0][]>();
  for (const p of payments) {
    if (p.payment.transactionId) {
      const existing = paymentByOrderId.get(p.payment.transactionId) || [];
      existing.push(p);
      paymentByOrderId.set(p.payment.transactionId, existing);
    }
  }

  const attemptByOrderId = new Map<string, typeof attempts[0]>();
  for (const a of attempts) {
    const key = a.attempt.gatewayOrderId || a.attempt.cfOrderId || a.attempt.rzpOrderId;
    if (key) {
      attemptByOrderId.set(key, a);
    }
  }

  const items: ReconciliationItem[] = [];
  const processedKeys = new Set<string>();

  let matchedAmount = 0;
  let totalInternalAmount = 0;
  let matchedCount = 0;
  let amountMismatchCount = 0;
  let statusMismatchCount = 0;
  let missingInternalCount = 0;
  let missingGatewayCount = 0;
  let refundMismatchCount = 0;
  let duplicateCount = 0;

  // Cross-Check 1: Examine all Internal Payments against Gateway records
  for (const { payment, customer, invoice } of payments) {
    const pAmt = parseFloat(payment.amount);
    totalInternalAmount += pAmt;
    const orderId = payment.transactionId;
    const dateObj = payment.receivedAt || payment.createdAt;
    const dateIso = (dateObj instanceof Date ? dateObj : new Date(dateObj)).toISOString();
    const dateIst = formatIstDateTime(dateObj);
    const effCity = customer?.city || "Varanasi";
    const effBranchId = invoice?.branchId ?? payment.branchId ?? null;
    const bookingId = payment.bookingId ?? invoice?.bookingId ?? null;

    // Check Duplicate
    if (orderId && (paymentByOrderId.get(orderId)?.length ?? 0) > 1) {
      duplicateCount++;
      items.push({
        id: `dup_${payment.id}`,
        category: "DUPLICATE_TRANSACTION",
        severity: "critical",
        transactionDate: dateIso,
        transactionDateIst: dateIst,
        customerId: payment.customerId,
        customerName: customer?.name || "Customer",
        customerPhone: customer?.phone || "—",
        city: effCity,
        branchId: effBranchId,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        bookingId,
        bookingRef: bookingId ? `BK-${bookingId}` : null,
        internalAmount: pAmt,
        gatewayAmount: null,
        discrepancyAmount: pAmt,
        gatewayProvider: payment.method,
        orderId,
        paymentId: `PAY-${payment.id}`,
        internalStatus: payment.status,
        gatewayStatus: null,
        refundStatus: payment.refundStatus || "none",
        actionRequired: "Investigate and reverse duplicate payment credit",
        canAutoReconcile: false,
      });
      continue;
    }

    if (!orderId || payment.method === "cash" || payment.method === "bank_transfer") {
      // Manual or cash internal payment
      missingGatewayCount++;
      items.push({
        id: `rec_internal_only_${payment.id}`,
        category: "INTERNAL_WITHOUT_GATEWAY",
        severity: "info",
        transactionDate: dateIso,
        transactionDateIst: dateIst,
        customerId: payment.customerId,
        customerName: customer?.name || "Customer",
        customerPhone: customer?.phone || "—",
        city: effCity,
        branchId: effBranchId,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        bookingId,
        bookingRef: bookingId ? `BK-${bookingId}` : null,
        internalAmount: pAmt,
        gatewayAmount: null,
        discrepancyAmount: 0,
        gatewayProvider: payment.method,
        orderId: null,
        paymentId: `PAY-${payment.id}`,
        internalStatus: payment.status,
        gatewayStatus: "N/A (Offline/Cash)",
        refundStatus: payment.refundStatus || "none",
        actionRequired: "Manual entry: verify physical cash or bank receipt",
        canAutoReconcile: false,
      });
      continue;
    }

    processedKeys.add(orderId);
    const matchedAttemptWrapper = attemptByOrderId.get(orderId);

    if (!matchedAttemptWrapper) {
      // Internal payment has an online gateway reference, but no attempt row in DB
      missingGatewayCount++;
      items.push({
        id: `rec_no_att_${payment.id}`,
        category: "INTERNAL_WITHOUT_GATEWAY",
        severity: "warning",
        transactionDate: dateIso,
        transactionDateIst: dateIst,
        customerId: payment.customerId,
        customerName: customer?.name || "Customer",
        customerPhone: customer?.phone || "—",
        city: effCity,
        branchId: effBranchId,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        bookingId,
        bookingRef: bookingId ? `BK-${bookingId}` : null,
        internalAmount: pAmt,
        gatewayAmount: null,
        discrepancyAmount: pAmt,
        gatewayProvider: payment.method,
        orderId,
        paymentId: `PAY-${payment.id}`,
        internalStatus: payment.status,
        gatewayStatus: "NOT_FOUND_LOCALLY",
        refundStatus: payment.refundStatus || "none",
        actionRequired: "Re-query Cashfree to verify gateway order existence",
        canAutoReconcile: true,
      });
      continue;
    }

    const { attempt } = matchedAttemptWrapper;
    const gAmt = parseFloat(attempt.amount);

    // Check Amount Discrepancy
    if (Math.abs(pAmt - gAmt) > 0.01) {
      amountMismatchCount++;
      items.push({
        id: `rec_amt_mismatch_${payment.id}`,
        category: "AMOUNT_MISMATCH",
        severity: "critical",
        transactionDate: dateIso,
        transactionDateIst: dateIst,
        customerId: payment.customerId,
        customerName: customer?.name || "Customer",
        customerPhone: customer?.phone || "—",
        city: effCity,
        branchId: effBranchId,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        bookingId,
        bookingRef: bookingId ? `BK-${bookingId}` : null,
        internalAmount: pAmt,
        gatewayAmount: gAmt,
        discrepancyAmount: Math.abs(pAmt - gAmt),
        gatewayProvider: attempt.gatewayProvider,
        orderId,
        paymentId: attempt.cfPaymentId || attempt.rzpPaymentId || `PAY-${payment.id}`,
        internalStatus: payment.status,
        gatewayStatus: attempt.status,
        refundStatus: payment.refundStatus || attempt.refundStatus || "none",
        actionRequired: `Amount discrepancy ₹${Math.abs(pAmt - gAmt).toFixed(2)}. Adjust invoice credit.`,
        canAutoReconcile: false,
      });
      continue;
    }

    // Check Status Discrepancy
    if (attempt.status !== "paid" && payment.status === "completed") {
      statusMismatchCount++;
      items.push({
        id: `rec_status_mismatch_${payment.id}`,
        category: "STATUS_MISMATCH",
        severity: "warning",
        transactionDate: dateIso,
        transactionDateIst: dateIst,
        customerId: payment.customerId,
        customerName: customer?.name || "Customer",
        customerPhone: customer?.phone || "—",
        city: effCity,
        branchId: effBranchId,
        invoiceId: invoice?.id ?? null,
        invoiceNumber: invoice?.invoiceNumber ?? null,
        bookingId,
        bookingRef: bookingId ? `BK-${bookingId}` : null,
        internalAmount: pAmt,
        gatewayAmount: gAmt,
        discrepancyAmount: 0,
        gatewayProvider: attempt.gatewayProvider,
        orderId,
        paymentId: attempt.cfPaymentId || attempt.rzpPaymentId || `PAY-${payment.id}`,
        internalStatus: payment.status,
        gatewayStatus: attempt.status,
        refundStatus: payment.refundStatus || attempt.refundStatus || "none",
        actionRequired: "Attempt status not updated to paid. Run status sync.",
        canAutoReconcile: true,
      });
      continue;
    }

    // Perfectly matched!
    matchedCount++;
    matchedAmount += pAmt;
    items.push({
      id: `rec_matched_${payment.id}`,
      category: "MATCHED",
      severity: "info",
      transactionDate: dateIso,
      transactionDateIst: dateIst,
      customerId: payment.customerId,
      customerName: customer?.name || "Customer",
      customerPhone: customer?.phone || "—",
      city: effCity,
      branchId: effBranchId,
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
      bookingId,
      bookingRef: bookingId ? `BK-${bookingId}` : null,
      internalAmount: pAmt,
      gatewayAmount: gAmt,
      discrepancyAmount: 0,
      gatewayProvider: attempt.gatewayProvider,
      orderId,
      paymentId: attempt.cfPaymentId || attempt.rzpPaymentId || `PAY-${payment.id}`,
      internalStatus: payment.status,
      gatewayStatus: attempt.status,
      refundStatus: payment.refundStatus || attempt.refundStatus || "none",
      actionRequired: "Reconciled. No action needed.",
      canAutoReconcile: false,
    });
  }

  // Cross-Check 2: Check for Gateway attempts that are marked 'paid' but have no payment row
  for (const { attempt, customer, invoice } of attempts) {
    const key = attempt.gatewayOrderId || attempt.cfOrderId || attempt.rzpOrderId;
    if (key && !processedKeys.has(key)) {
      if (attempt.status === "paid") {
        missingInternalCount++;
        const gAmt = parseFloat(attempt.amount);
        const dateObj = attempt.updatedAt || attempt.createdAt;
        const dateIso = (dateObj instanceof Date ? dateObj : new Date(dateObj)).toISOString();
        const dateIst = formatIstDateTime(dateObj);
        const effCity = customer?.city || "Varanasi";
        const effBranchId = attempt.branchId ?? invoice?.branchId ?? null;
        const bookingId = attempt.bookingId ?? invoice?.bookingId ?? null;

        items.push({
          id: `rec_missing_internal_${attempt.id}`,
          category: "GATEWAY_WITHOUT_INTERNAL",
          severity: "critical",
          transactionDate: dateIso,
          transactionDateIst: dateIst,
          customerId: attempt.customerId,
          customerName: customer?.name || "Customer",
          customerPhone: customer?.phone || "—",
          city: effCity,
          branchId: effBranchId,
          invoiceId: invoice?.id ?? attempt.invoiceId ?? null,
          invoiceNumber: invoice?.invoiceNumber ?? null,
          bookingId,
          bookingRef: bookingId ? `BK-${bookingId}` : null,
          internalAmount: null,
          gatewayAmount: gAmt,
          discrepancyAmount: gAmt,
          gatewayProvider: attempt.gatewayProvider,
          orderId: key,
          paymentId: attempt.cfPaymentId || attempt.rzpPaymentId || attempt.attemptId,
          internalStatus: "MISSING",
          gatewayStatus: attempt.status,
          refundStatus: attempt.refundStatus || "none",
          actionRequired: "Gateway payment confirmed but missing internal credit. Click Reconcile to credit.",
          canAutoReconcile: true,
        });
      }
    }
  }

  // Apply in-memory filtering for category, city, branch if passed
  let filteredItems = items;
  if (category && category !== "ALL") {
    filteredItems = filteredItems.filter((it) => it.category === category);
  }
  if (city && city.toLowerCase() !== "all") {
    filteredItems = filteredItems.filter((it) => it.city.toLowerCase() === city.toLowerCase());
  }
  if (branchId) {
    filteredItems = filteredItems.filter((it) => it.branchId === branchId);
  }

  // Sort descending by date
  filteredItems.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

  const totalTxns = items.length;
  const unmatchedCount = totalTxns - matchedCount;
  const healthScore = totalTxns > 0 ? Math.round((matchedCount / totalTxns) * 1000) / 10 : 100;

  const summary: ReconciliationSummary = {
    period: startDate && endDate ? `${startDate} to ${endDate}` : "All Time",
    totalTransactions: totalTxns,
    totalInternalPaidAmount: Math.round(totalInternalAmount * 100) / 100,
    totalMatchedAmount: Math.round(matchedAmount * 100) / 100,
    matchedCount,
    unmatchedCount,
    amountMismatchCount,
    statusMismatchCount,
    missingInternalCount,
    missingGatewayCount,
    refundMismatchCount,
    duplicateCount,
    reconciliationHealthScore: healthScore,
    calculatedAtIst: formatIstDateTime(now),
  };

  return { items: filteredItems, summary };
}

/**
 * Authoritative manual reconciliation action: re-verifies order against gateway and updates ledger atomically.
 */
export async function manualReconcileOrder(params: {
  orderId: string;
  reconciledByUserId: number;
  reason: string;
  ipAddress?: string;
}) {
  const { orderId, reconciledByUserId, reason, ipAddress } = params;

  if (!reason || !reason.trim()) {
    throw new Error("A clear reconciliation reason is mandatory");
  }

  // 1. Look up attempt record
  const [attempt] = await db
    .select()
    .from(paymentAttemptsTable)
    .where(eq(paymentAttemptsTable.cfOrderId, orderId))
    .limit(1);

  if (!attempt) {
    throw new Error(`Payment attempt not found for order ${orderId}`);
  }

  let gatewayPaid = false;
  let cfPaymentId: string | undefined;
  let paymentAmount = parseFloat(attempt.amount);
  let gatewayPayload: any = null;

  // 2. Fetch ground-truth from Cashfree API
  if (attempt.gatewayProvider === "cashfree") {
    const client = new CashfreeClient();
    try {
      const order = await client.getOrder(orderId);
      const payments = await client.getOrderPayments(orderId);
      const successfulPayment = payments.find((p) => p.payment_status === "SUCCESS");

      if (order.order_status === "PAID" || successfulPayment) {
        gatewayPaid = true;
        paymentAmount = successfulPayment ? successfulPayment.payment_amount : order.order_amount;
        cfPaymentId = successfulPayment ? String(successfulPayment.cf_payment_id) : undefined;
        gatewayPayload = { order, payments };
      }
    } catch (err: any) {
      logger.error({ err: err.message, orderId }, "[RECONCILIATION] Failed to query Cashfree gateway");
      throw new Error(`Failed to query Cashfree gateway: ${err.message}`);
    }
  }

  if (!gatewayPaid) {
    throw new Error("Gateway reports order has not been paid. Cannot reconcile as completed payment.");
  }

  // 3. Atomically settle internal ledger
  const settleResult = await reconcileCashfreePayment({
    orderId,
    cfPaymentId,
    paymentAmount,
    paymentMethod: attempt.gatewayProvider,
    paymentTime: new Date().toISOString(),
    customerId: attempt.customerId,
    invoiceId: attempt.invoiceId ?? undefined,
    rawPayload: gatewayPayload,
    source: "verify",
  });

  // 4. Mark attempt as reconciled
  await db
    .update(paymentAttemptsTable)
    .set({
      reconciliationStatus: "reconciled",
      reconciledAt: new Date(),
      reconciliationNotes: reason.trim(),
      updatedAt: new Date(),
    })
    .where(eq(paymentAttemptsTable.id, attempt.id));

  // 5. Audit Logging
  await db.insert(adminAuditLogsTable).values({
    userId: reconciledByUserId,
    action: "payment.reconciliation_applied",
    resourceType: "payment_attempts",
    resourceId: String(attempt.id),
    previousValues: {
      status: attempt.status,
      reconciliationStatus: attempt.reconciliationStatus,
    },
    newValues: {
      orderId,
      status: "paid",
      reconciliationStatus: "reconciled",
      cfPaymentId,
      amount: paymentAmount,
    },
    reason: reason.trim(),
    ipAddress: ipAddress || null,
    userAgent: "Admin Payment Reconciliation Hub",
    createdAt: new Date(),
  });

  return {
    success: true,
    orderId,
    reconciliationStatus: "reconciled",
    settleResult,
  };
}
