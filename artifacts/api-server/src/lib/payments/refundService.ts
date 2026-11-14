import { db, paymentsTable, paymentAttemptsTable, paymentRefundsTable, invoicesTable, customersTable, bookingsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { CashfreeClient } from "../cashfree/cashfreeClient";
import { getCashfreeConfig } from "../cashfree/cashfreeConfig";
import { logger } from "../logger";

export interface InitiateRefundParams {
  transactionId: string; // e.g. "pay_123" or "att_456" or orderId
  amount?: number; // Optional: if omitted, refunds full refundable balance
  reason: string;
  initiatedByUserId?: number;
  initiatedByEmail?: string;
  ipAddress?: string;
}

export interface RefundableBalanceResult {
  canRefund: boolean;
  originalAmount: number;
  previouslyRefundedAmount: number;
  refundableBalance: number;
  paymentId: number | null;
  attemptId: number | null;
  customerId: number;
  invoiceId: number | null;
  bookingId: number | null;
  cityId: number | null;
  branchId: number | null;
  gatewayProvider: "cashfree" | "razorpay" | "other";
  orderId: string | null;
  cfPaymentId: string | null;
  rzpPaymentId: string | null;
}

/**
 * Calculates refundable balance server-side for any given transaction.
 */
export async function getRefundableBalance(rawTxId: string): Promise<RefundableBalanceResult> {
  let paymentRecord: typeof paymentsTable.$inferSelect | null = null;
  let attemptRecord: typeof paymentAttemptsTable.$inferSelect | null = null;
  let invoiceRecord: typeof invoicesTable.$inferSelect | null = null;

  if (rawTxId.startsWith("pay_")) {
    const pId = parseInt(rawTxId.replace("pay_", ""), 10);
    const [p] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, pId)).limit(1);
    paymentRecord = p || null;
    if (paymentRecord && paymentRecord.transactionId) {
      const [att] = await db
        .select()
        .from(paymentAttemptsTable)
        .where(eq(paymentAttemptsTable.cfOrderId, paymentRecord.transactionId))
        .limit(1);
      attemptRecord = att || null;
    }
  } else if (rawTxId.startsWith("att_")) {
    const aId = parseInt(rawTxId.replace("att_", ""), 10);
    const [att] = await db.select().from(paymentAttemptsTable).where(eq(paymentAttemptsTable.id, aId)).limit(1);
    attemptRecord = att || null;
    if (attemptRecord && attemptRecord.cfOrderId) {
      const [p] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.transactionId, attemptRecord.cfOrderId))
        .limit(1);
      paymentRecord = p || null;
    }
  } else {
    // Treat rawTxId as orderId or attemptId
    const [att] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(sql`${paymentAttemptsTable.cfOrderId} = ${rawTxId} OR ${paymentAttemptsTable.attemptId} = ${rawTxId}`)
      .limit(1);
    attemptRecord = att || null;
    if (attemptRecord && attemptRecord.cfOrderId) {
      const [p] = await db
        .select()
        .from(paymentsTable)
        .where(eq(paymentsTable.transactionId, attemptRecord.cfOrderId))
        .limit(1);
      paymentRecord = p || null;
    }
  }

  if (!paymentRecord && !attemptRecord) {
    throw new Error("Transaction not found");
  }

  // Check if invoice exists to trace booking & branch
  const invId = paymentRecord?.invoiceId ?? attemptRecord?.invoiceId;
  if (invId) {
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invId)).limit(1);
    invoiceRecord = inv || null;
  }

  const originalAmount = paymentRecord
    ? parseFloat(paymentRecord.amount)
    : attemptRecord
    ? parseFloat(attemptRecord.amount)
    : 0;

  const paymentId = paymentRecord?.id ?? null;
  const attemptId = attemptRecord?.id ?? null;
  const customerId = paymentRecord?.customerId ?? attemptRecord?.customerId ?? 1;
  const bookingId = paymentRecord?.bookingId ?? attemptRecord?.bookingId ?? invoiceRecord?.bookingId ?? null;
  const cityId = attemptRecord?.cityId ?? null;
  const branchId = paymentRecord?.branchId ?? attemptRecord?.branchId ?? invoiceRecord?.branchId ?? null;
  const gatewayProvider = (attemptRecord?.gatewayProvider ||
    (paymentRecord?.method === "razorpay" ? "razorpay" : paymentRecord?.method === "cashfree" ? "cashfree" : "other")) as any;

  // Calculate previously refunded amount from paymentRefundsTable
  const refundConditions = [];
  if (paymentId) refundConditions.push(eq(paymentRefundsTable.paymentId, paymentId));
  if (attemptId) refundConditions.push(eq(paymentRefundsTable.attemptId, attemptId));

  let prevRefunded = 0;
  if (refundConditions.length > 0) {
    const [refundSum] = await db
      .select({
        total: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(paymentRefundsTable)
      .where(
        and(
          sql`status IN ('initiated', 'pending', 'succeeded')`,
          sql`(${sql.join(refundConditions, sql` OR `)})`,
        ),
      );
    prevRefunded = parseFloat(refundSum?.total ?? "0");
  }

  const refundableBalance = Math.max(0, Math.round((originalAmount - prevRefunded) * 100) / 100);
  const canRefund = refundableBalance > 0 && (paymentRecord?.status === "completed" || attemptRecord?.status === "paid");

  return {
    canRefund,
    originalAmount,
    previouslyRefundedAmount: prevRefunded,
    refundableBalance,
    paymentId,
    attemptId,
    customerId,
    invoiceId: invId ?? null,
    bookingId,
    cityId,
    branchId,
    gatewayProvider,
    orderId: attemptRecord?.cfOrderId || attemptRecord?.rzpOrderId || paymentRecord?.transactionId || null,
    cfPaymentId: attemptRecord?.cfPaymentId || null,
    rzpPaymentId: attemptRecord?.rzpPaymentId || null,
  };
}

/**
 * Executes an authorized refund workflow with server-side validation and audit trails.
 */
export async function initiateRefund(params: InitiateRefundParams) {
  const { transactionId, amount, reason, initiatedByUserId, initiatedByEmail, ipAddress } = params;

  if (!reason || !reason.trim()) {
    throw new Error("A valid refund reason is required");
  }

  const balanceInfo = await getRefundableBalance(transactionId);
  if (!balanceInfo.canRefund) {
    throw new Error("This transaction is not eligible for a refund or has zero refundable balance");
  }

  const refundAmount = amount != null && amount > 0 ? Math.round(amount * 100) / 100 : balanceInfo.refundableBalance;

  if (refundAmount <= 0) {
    throw new Error("Refund amount must be greater than zero");
  }

  if (refundAmount > balanceInfo.refundableBalance) {
    throw new Error(
      `Requested refund amount (₹${refundAmount.toFixed(2)}) exceeds available refundable balance (₹${balanceInfo.refundableBalance.toFixed(2)})`,
    );
  }

  const refundId = `cwp_ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return await db.transaction(async (tx) => {
    // 1. Insert refund record with status 'pending'
    const [refundRecord] = await tx
      .insert(paymentRefundsTable)
      .values({
        refundId,
        paymentId: balanceInfo.paymentId,
        attemptId: balanceInfo.attemptId,
        customerId: balanceInfo.customerId,
        bookingId: balanceInfo.bookingId,
        invoiceId: balanceInfo.invoiceId,
        cityId: balanceInfo.cityId,
        branchId: balanceInfo.branchId,
        amount: refundAmount.toFixed(2),
        currency: "INR",
        reason: reason.trim(),
        status: "pending",
        gatewayProvider: balanceInfo.gatewayProvider,
        initiatedByUserId: initiatedByUserId || null,
        processedAt: new Date(),
      })
      .returning();

    // 2. Gateway Dispatch (if Cashfree)
    let gatewayRefundId: string | null = null;
    let cfRefundId: string | null = null;
    let rawPayload: any = null;
    let isGatewaySuccess = true;

    if (balanceInfo.gatewayProvider === "cashfree" && balanceInfo.orderId) {
      try {
        const client = new CashfreeClient();
        const cfResult = await client.createRefund(balanceInfo.orderId, {
          refund_amount: refundAmount,
          refund_id: refundId,
          refund_note: reason.trim(),
          refund_speed: "STANDARD",
        });

        gatewayRefundId = String(cfResult.cf_refund_id || cfResult.refund_id);
        cfRefundId = gatewayRefundId;
        rawPayload = cfResult;
        if (cfResult.refund_status === "SUCCESS") {
          isGatewaySuccess = true;
        }
      } catch (gwErr: any) {
        logger.warn(
          { err: gwErr.message, orderId: balanceInfo.orderId, refundId },
          "[REFUND_SERVICE] Cashfree gateway refund returned error (marking pending for reconciliation)",
        );
        rawPayload = { error: gwErr.message, code: gwErr.code };
      }
    }

    // 3. Update refund record with gateway details
    const newRefundStatus = isGatewaySuccess ? "succeeded" : "pending";
    const [updatedRefund] = await tx
      .update(paymentRefundsTable)
      .set({
        status: newRefundStatus,
        cfRefundId,
        gatewayRefundId,
        rawGatewayPayload: rawPayload,
        updatedAt: new Date(),
      })
      .where(eq(paymentRefundsTable.id, refundRecord.id))
      .returning();

    // 4. Update parent payment & attempt status
    const newTotalRefunded = balanceInfo.previouslyRefundedAmount + refundAmount;
    const isFullRefund = newTotalRefunded >= balanceInfo.originalAmount - 0.01;
    const parentRefundStatus = isFullRefund ? "refunded" : "partial";

    if (balanceInfo.paymentId) {
      await tx
        .update(paymentsTable)
        .set({
          refundStatus: parentRefundStatus,
          refundedAmount: newTotalRefunded.toFixed(2),
          status: isFullRefund ? "refunded" : "completed",
        })
        .where(eq(paymentsTable.id, balanceInfo.paymentId));
    }

    if (balanceInfo.attemptId) {
      await tx
        .update(paymentAttemptsTable)
        .set({
          refundStatus: parentRefundStatus,
          refundedAmount: newTotalRefunded.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(paymentAttemptsTable.id, balanceInfo.attemptId));
    }

    // 5. Audit Logging
    await tx.insert(adminAuditLogsTable).values({
      userId: initiatedByUserId || 1,
      action: "payment.refund_issued",
      resourceType: "payment_refunds",
      resourceId: String(updatedRefund.id),
      previousValues: {
        originalAmount: balanceInfo.originalAmount,
        previouslyRefundedAmount: balanceInfo.previouslyRefundedAmount,
        refundableBalance: balanceInfo.refundableBalance,
      },
      newValues: {
        refundId: updatedRefund.refundId,
        refundAmount,
        reason,
        refundStatus: updatedRefund.status,
        gatewayRefundId,
      },
      reason: reason.trim(),
      ipAddress: ipAddress || null,
      userAgent: "Admin Financial Operations Hub",
      createdAt: new Date(),
    });

    logger.info(
      { refundId, refundAmount, transactionId, status: updatedRefund.status },
      "[REFUND_SERVICE] Refund processed successfully",
    );

    return {
      success: true,
      refund: updatedRefund,
      refundableBalanceRemaining: Math.max(0, balanceInfo.refundableBalance - refundAmount),
    };
  });
}
