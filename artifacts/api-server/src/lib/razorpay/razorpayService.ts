import { randomBytes } from "node:crypto";
import {
  db,
  customersTable,
  invoicesTable,
  paymentsTable,
  paymentAttemptsTable,
  paymentWebhookEventsTable,
  dcmsSubscriptionsTable,
} from "@workspace/db";
import { normalizeIndianMobile } from "@workspace/validation";
import { eq, and, sql, desc, isNull, inArray } from "drizzle-orm";
import { getCustomerOutstandingDues, recordPayment } from "../billing/invoiceService";
import { RazorpayClient } from "./razorpayClient";
import { getRazorpayConfig, type RazorpayEnvironment } from "./razorpayConfig";
import {
  verifyRazorpayPaymentSignature,
  verifyRazorpayWebhookSignature,
} from "./razorpayWebhook";
import type {
  RazorpayOrderEntity,
  RazorpayPaymentEntity,
  RazorpayWebhookPayload,
} from "./types";
import { logger } from "../logger";

export interface CreateRazorpayOrderParams {
  customerId: number;
  invoiceId?: number;
  subscriptionId?: number;
  cityId?: number;
  branchId?: number;
  legalEntityId?: number;
  idempotencyKey?: string;
  correlationId?: string;
}

export interface CreateRazorpayOrderResult {
  success: true;
  gateway: "razorpay";
  orderId: string;
  keyId: string;
  orderAmount: number; // in Rupees
  amountInPaise: number;
  orderCurrency: "INR";
  customer: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  environment: RazorpayEnvironment;
  correlationId: string;
}

export class RazorpayPaymentServiceError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly stageName?: string;
  public readonly correlationId?: string;

  constructor(
    message: string,
    code: string,
    statusCode = 400,
    stageName?: string,
    correlationId?: string,
  ) {
    super(message);
    this.name = "RazorpayPaymentServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.stageName = stageName;
    this.correlationId = correlationId;
  }

  get status(): number {
    return this.statusCode;
  }
}

export interface ReceiptData {
  paymentId: number;
  receiptNumber: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  date: string;
  paymentMethod: string;
  transactionId: string;
}

async function buildReceiptObject(
  payment: typeof paymentsTable.$inferSelect | undefined,
  customerId: number,
  tx: any,
): Promise<ReceiptData | undefined> {
  if (!payment) return undefined;

  const [customer] = await tx
    .select({ name: customersTable.name, phone: customersTable.phone })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  let invoiceNumber = "INV-GEN";
  if (payment.invoiceId) {
    const [inv] = await tx
      .select({ invoiceNumber: invoicesTable.invoiceNumber })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, payment.invoiceId))
      .limit(1);
    if (inv?.invoiceNumber) {
      invoiceNumber = inv.invoiceNumber;
    } else {
      invoiceNumber = `INV-${payment.invoiceId}`;
    }
  }

  const paymentYear = payment.receivedAt ? new Date(payment.receivedAt).getFullYear() : new Date().getFullYear();
  const receiptNumber = `REC-${paymentYear}-${String(payment.id).padStart(4, "0")}`;

  return {
    paymentId: payment.id,
    receiptNumber,
    invoiceNumber,
    customerName: customer?.name || "Customer",
    amount: parseFloat(payment.amount),
    date: payment.receivedAt ? new Date(payment.receivedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    paymentMethod: "razorpay",
    transactionId: payment.transactionId || "",
  };
}

/**
 * Creates or reuses a Razorpay payment order session for an authenticated customer.
 * Strictly calculates payable amount on the server from invoices or total outstanding dues.
 */
export async function createRazorpayPaymentOrder(
  params: CreateRazorpayOrderParams,
): Promise<CreateRazorpayOrderResult> {
  const { customerId, invoiceId } = params;
  const correlationId =
    params.correlationId ||
    `cwp_cor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Stage 2: CUSTOMER_AUTHENTICATED
  const [customer] = await db
    .select({
      id: customersTable.id,
      name: customersTable.name,
      phone: customersTable.phone,
      email: customersTable.email,
    })
    .from(customersTable)
    .where(eq(customersTable.id, customerId))
    .limit(1);

  if (!customer) {
    logger.warn(
      { stage: "CUSTOMER_AUTHENTICATED", stageStatus: "FAILED", correlationId, customerId },
      "[RAZORPAY_SERVICE] Customer record not found",
    );
    throw new RazorpayPaymentServiceError(
      "Customer not found",
      "CUSTOMER_NOT_FOUND",
      404,
      "CUSTOMER_AUTHENTICATED",
      correlationId,
    );
  }

  logger.info(
    { stage: "CUSTOMER_AUTHENTICATED", stageStatus: "SUCCESS", correlationId, customerId },
    "[RAZORPAY_SERVICE] Stage 2: CUSTOMER_AUTHENTICATED",
  );

  let phone = normalizeIndianMobile(customer.phone);
  if (!phone) {
    const digits = customer.phone.replace(/\D/g, "");
    phone = digits.slice(-10);
  }
  if (!phone || phone.length !== 10) {
    phone = "9999999999";
  }

  const customerName = customer.name?.trim() || "Valued Customer";
  const customerEmail = customer.email?.trim() || undefined;

  // Stage 3: INVOICE_VALIDATED & Stage 4: PAYABLE_AMOUNT_RESOLVED
  let payableAmount = 0;
  let targetInvoiceId: number | null = null;

  if (invoiceId !== undefined && invoiceId !== null) {
    const [invoice] = await db
      .select({
        id: invoicesTable.id,
        customerId: invoicesTable.customerId,
        balanceDue: invoicesTable.balanceDue,
        status: invoicesTable.status,
        documentType: invoicesTable.documentType,
      })
      .from(invoicesTable)
      .where(eq(invoicesTable.id, invoiceId))
      .limit(1);

    if (!invoice) {
      logger.warn(
        { stage: "INVOICE_VALIDATED", stageStatus: "FAILED", correlationId, invoiceId },
        "[RAZORPAY_SERVICE] Target invoice not found",
      );
      throw new RazorpayPaymentServiceError(
        "Invoice not found",
        "INVOICE_NOT_FOUND",
        404,
        "INVOICE_VALIDATED",
        correlationId,
      );
    }

    if (invoice.customerId !== customerId) {
      logger.warn(
        { stage: "INVOICE_VALIDATED", stageStatus: "FAILED", correlationId, invoiceId, customerId, invoiceCustomerId: invoice.customerId },
        "[RAZORPAY_SERVICE] Forbidden invoice access",
      );
      throw new RazorpayPaymentServiceError(
        "Unauthorized access to invoice",
        "FORBIDDEN_INVOICE_ACCESS",
        403,
        "INVOICE_VALIDATED",
        correlationId,
      );
    }

    const balanceDue = parseFloat(invoice.balanceDue);
    if (
      invoice.documentType !== "tax_invoice" ||
      invoice.status === "paid" ||
      invoice.status === "cancelled" ||
      balanceDue <= 0
    ) {
      logger.info(
        { stage: "INVOICE_VALIDATED", stageStatus: "ZERO_BALANCE", correlationId, invoiceId, status: invoice.status, balanceDue },
        "[RAZORPAY_SERVICE] Invoice has zero balance or is already settled",
      );
      throw new RazorpayPaymentServiceError(
        "Invoice has no outstanding balance",
        "NO_OUTSTANDING_BALANCE",
        200,
        "INVOICE_VALIDATED",
        correlationId,
      );
    }

    payableAmount = balanceDue;
    targetInvoiceId = invoice.id;
    logger.info(
      { stage: "INVOICE_VALIDATED", stageStatus: "SUCCESS", correlationId, invoiceId: invoice.id, balanceDue },
      "[RAZORPAY_SERVICE] Stage 3: INVOICE_VALIDATED",
    );
  } else {
    const outstandingDues = await getCustomerOutstandingDues(customerId);
    if (outstandingDues <= 0) {
      logger.info(
        { stage: "INVOICE_VALIDATED", stageStatus: "ZERO_BALANCE", correlationId, customerId, outstandingDues },
        "[RAZORPAY_SERVICE] Customer has no outstanding balance",
      );
      throw new RazorpayPaymentServiceError(
        "No outstanding balance to pay",
        "NO_OUTSTANDING_BALANCE",
        200,
        "INVOICE_VALIDATED",
        correlationId,
      );
    }
    payableAmount = outstandingDues;
    targetInvoiceId = null;
    logger.info(
      { stage: "INVOICE_VALIDATED", stageStatus: "SUCCESS", correlationId, customerId, outstandingDues },
      "[RAZORPAY_SERVICE] Stage 3: INVOICE_VALIDATED (account-level dues)",
    );
  }

  payableAmount = Math.round(payableAmount * 100) / 100;
  if (payableAmount <= 0) {
    throw new RazorpayPaymentServiceError(
      "No outstanding balance to pay",
      "NO_OUTSTANDING_BALANCE",
      200,
      "PAYABLE_AMOUNT_RESOLVED",
      correlationId,
    );
  }

  const amountInPaise = Math.round(payableAmount * 100);
  logger.info(
    { stage: "PAYABLE_AMOUNT_RESOLVED", stageStatus: "SUCCESS", correlationId, payableAmount, amountInPaise },
    "[RAZORPAY_SERVICE] Stage 4: PAYABLE_AMOUNT_RESOLVED",
  );

  // Stage 5: RAZORPAY_CREDENTIALS_VALIDATED
  let cfg;
  try {
    cfg = getRazorpayConfig();
    logger.info(
      {
        stage: "RAZORPAY_CREDENTIALS_VALIDATED",
        stageStatus: "SUCCESS",
        correlationId,
        keyPrefix: cfg.keyId?.slice(0, 9),
        env: cfg.env,
      },
      "[RAZORPAY_SERVICE] Stage 5: RAZORPAY_CREDENTIALS_VALIDATED",
    );
  } catch (cfgErr: any) {
    logger.error(
      { stage: "RAZORPAY_CREDENTIALS_VALIDATED", stageStatus: "FAILED", correlationId, err: cfgErr.message },
      "[RAZORPAY_SERVICE] Razorpay credentials validation failed",
    );
    throw new RazorpayPaymentServiceError(
      cfgErr.message || "Razorpay credentials unconfigured",
      cfgErr.code || "UNCONFIGURED_RAZORPAY_CREDENTIALS",
      500,
      "RAZORPAY_CREDENTIALS_VALIDATED",
      correlationId,
    );
  }

  // Check for existing session by client-provided idempotencyKey
  let existingFailedAttempt: typeof paymentAttemptsTable.$inferSelect | null = null;

  if (params.idempotencyKey) {
    const [existingByKey] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.idempotencyKey, params.idempotencyKey))
      .limit(1);

    if (existingByKey) {
      if (existingByKey.customerId !== customerId) {
        throw new RazorpayPaymentServiceError(
          "Idempotency key belongs to another customer",
          "IDEMPOTENCY_KEY_COLLISION",
          409,
          "PAYMENT_ATTEMPT_REUSE",
          correlationId,
        );
      }

      if (existingByKey.invoiceId !== (targetInvoiceId ?? null)) {
        throw new RazorpayPaymentServiceError(
          "Idempotency key was used for a different invoice target",
          "IDEMPOTENCY_KEY_REUSE_MISMATCH",
          409,
          "PAYMENT_ATTEMPT_REUSE",
          correlationId,
        );
      }

      if (Math.abs(parseFloat(existingByKey.amount) - payableAmount) >= 0.01) {
        throw new RazorpayPaymentServiceError(
          "Idempotency key was used for a different amount",
          "IDEMPOTENCY_KEY_REUSE_MISMATCH",
          409,
          "PAYMENT_ATTEMPT_REUSE",
          correlationId,
        );
      }

      if (existingByKey.status === "paid") {
        throw new RazorpayPaymentServiceError(
          "Payment already completed for this attempt",
          "PAYMENT_ALREADY_COMPLETED",
          400,
          "PAYMENT_ATTEMPT_REUSE",
          correlationId,
        );
      }

      if (existingByKey.status === "failed") {
        existingFailedAttempt = existingByKey;
      } else if (existingByKey.rzpOrderId) {
        const attemptKeyId = (existingByKey.metadata as any)?.keyId;
        // Key consistency verification: do not reuse if order was created with a different key
        if (!attemptKeyId || attemptKeyId === cfg.keyId) {
          logger.info(
            {
              stage: "PAYMENT_ATTEMPT_REUSED",
              correlationId,
              orderId: existingByKey.rzpOrderId,
              keyId: cfg.keyId,
            },
            "[RAZORPAY_SERVICE] Reusing attempt by idempotency key",
          );
          return {
            success: true,
            gateway: "razorpay",
            orderId: existingByKey.rzpOrderId,
            keyId: cfg.keyId,
            orderAmount: parseFloat(existingByKey.amount),
            amountInPaise: Math.round(parseFloat(existingByKey.amount) * 100),
            orderCurrency: existingByKey.currency as "INR",
            customer: {
              id: customerId,
              name: customerName,
              phone,
              email: customerEmail,
            },
            environment: cfg.env,
            correlationId,
          };
        }
      }
    }
  }

  // Active session reuse window (within 20 minutes)
  if (!params.idempotencyKey) {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
    const reuseCondition = targetInvoiceId !== null
      ? and(
          eq(paymentAttemptsTable.customerId, customerId),
          eq(paymentAttemptsTable.invoiceId, targetInvoiceId),
          eq(paymentAttemptsTable.gatewayProvider, "razorpay"),
          inArray(paymentAttemptsTable.status, ["initiated", "active"]),
          sql`${paymentAttemptsTable.rzpOrderId} IS NOT NULL`,
          sql`${paymentAttemptsTable.createdAt} > ${twentyMinutesAgo}`,
        )
      : and(
          eq(paymentAttemptsTable.customerId, customerId),
          isNull(paymentAttemptsTable.invoiceId),
          eq(paymentAttemptsTable.gatewayProvider, "razorpay"),
          inArray(paymentAttemptsTable.status, ["initiated", "active"]),
          sql`${paymentAttemptsTable.rzpOrderId} IS NOT NULL`,
          sql`${paymentAttemptsTable.createdAt} > ${twentyMinutesAgo}`,
        );

    const [activeAttempt] = await db
      .select()
      .from(paymentAttemptsTable)
      .where(reuseCondition)
      .orderBy(desc(paymentAttemptsTable.createdAt))
      .limit(1);

    if (activeAttempt && activeAttempt.rzpOrderId) {
      const attemptAmount = parseFloat(activeAttempt.amount);
      const attemptKeyId = (activeAttempt.metadata as any)?.keyId;
      // Key consistency check: only reuse if attempt was generated with the current active key
      if (Math.abs(attemptAmount - payableAmount) < 0.01 && (!attemptKeyId || attemptKeyId === cfg.keyId)) {
        logger.info(
          {
            stage: "PAYMENT_ATTEMPT_REUSED",
            correlationId,
            orderId: activeAttempt.rzpOrderId,
            attemptId: activeAttempt.attemptId,
          },
          "[RAZORPAY_SERVICE] Reusing active non-failed Razorpay order attempt",
        );
        return {
          success: true,
          gateway: "razorpay",
          orderId: activeAttempt.rzpOrderId,
          keyId: cfg.keyId,
          orderAmount: attemptAmount,
          amountInPaise: Math.round(attemptAmount * 100),
          orderCurrency: activeAttempt.currency as "INR",
          customer: {
            id: customerId,
            name: customerName,
            phone,
            email: customerEmail,
          },
          environment: cfg.env,
          correlationId,
        };
      }
    }
  }

  // Generate unique IDs
  const randomSuffix = randomBytes(4).toString("hex");
  const attemptId = `cwp_att_${Date.now()}_${randomSuffix}`;
  const effectiveIdempotencyKey = params.idempotencyKey?.trim() || attemptId;
  const formattedAmount = payableAmount.toFixed(2);

  // Invoke Razorpay API Client to create order (Stages 6 and 7 logged inside RazorpayClient)
  const client = new RazorpayClient();

  const notes: Record<string, string> = {
    customer_id: String(customerId),
    attempt_id: attemptId,
    correlation_id: correlationId,
    ...(targetInvoiceId ? { invoice_id: String(targetInvoiceId) } : {}),
    ...(params.subscriptionId ? { subscription_id: String(params.subscriptionId) } : {}),
    ...(params.cityId ? { city_id: String(params.cityId) } : {}),
    ...(params.branchId ? { branch_id: String(params.branchId) } : {}),
  };

  let rzpOrder: RazorpayOrderEntity;
  try {
    rzpOrder = await client.createOrder(
      {
        amount: amountInPaise,
        currency: "INR",
        receipt: attemptId.slice(0, 40),
        notes,
        payment_capture: 1, // Auto-capture payment on authorization
      },
      { correlationId },
    );
  } catch (err: any) {
    logger.error(
      {
        stage: "RAZORPAY_ORDER_RESPONSE_RECEIVED",
        stageStatus: "FAILED",
        correlationId,
        err: err.message,
        code: err.code,
        customerId,
        amountInPaise,
      },
      "[RAZORPAY_SERVICE] Failed to create order on Razorpay gateway",
    );
    throw err;
  }

  const metadataObj = {
    correlationId,
    keyId: cfg.keyId,
    environment: cfg.env,
    stages: [
      "PAYMENT_INITIATED",
      "CUSTOMER_AUTHENTICATED",
      "INVOICE_VALIDATED",
      "PAYABLE_AMOUNT_RESOLVED",
      "RAZORPAY_CREDENTIALS_VALIDATED",
      "RAZORPAY_ORDER_REQUEST_SENT",
      "RAZORPAY_ORDER_RESPONSE_RECEIVED",
      "PAYMENT_ATTEMPT_PERSISTED",
    ],
  };

  // Stage 8: PAYMENT_ATTEMPT_PERSISTED
  if (existingFailedAttempt) {
    await db
      .update(paymentAttemptsTable)
      .set({
        gatewayProvider: "razorpay",
        rzpOrderId: rzpOrder.id,
        gatewayOrderId: rzpOrder.id,
        status: "initiated",
        amount: formattedAmount,
        invoiceId: targetInvoiceId,
        subscriptionId: params.subscriptionId ?? null,
        cityId: params.cityId ?? null,
        branchId: params.branchId ?? null,
        legalEntityId: params.legalEntityId ?? null,
        metadata: metadataObj,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttemptsTable.id, existingFailedAttempt.id));
  } else {
    try {
      await db
        .insert(paymentAttemptsTable)
        .values({
          attemptId,
          gatewayProvider: "razorpay",
          rzpOrderId: rzpOrder.id,
          gatewayOrderId: rzpOrder.id,
          customerId,
          invoiceId: targetInvoiceId,
          subscriptionId: params.subscriptionId ?? null,
          cityId: params.cityId ?? null,
          branchId: params.branchId ?? null,
          legalEntityId: params.legalEntityId ?? null,
          amount: formattedAmount,
          currency: "INR",
          status: "initiated",
          idempotencyKey: effectiveIdempotencyKey,
          paymentMethod: "razorpay",
          metadata: metadataObj,
        });
    } catch (err: any) {
      if (err?.code === "23505" || err?.cause?.code === "23505") {
        const [existing] = await db
          .select()
          .from(paymentAttemptsTable)
          .where(eq(paymentAttemptsTable.idempotencyKey, effectiveIdempotencyKey))
          .limit(1);

        if (existing?.rzpOrderId) {
          return {
            success: true,
            gateway: "razorpay",
            orderId: existing.rzpOrderId,
            keyId: cfg.keyId,
            orderAmount: parseFloat(existing.amount),
            amountInPaise: Math.round(parseFloat(existing.amount) * 100),
            orderCurrency: existing.currency as "INR",
            customer: {
              id: customerId,
              name: customerName,
              phone,
              email: customerEmail,
            },
            environment: cfg.env,
            correlationId,
          };
        }
      }
      throw err;
    }
  }

  logger.info(
    {
      stage: "PAYMENT_ATTEMPT_PERSISTED",
      stageStatus: "SUCCESS",
      correlationId,
      attemptId,
      orderId: rzpOrder.id,
      amount: payableAmount,
    },
    "[RAZORPAY_SERVICE] Stage 8: PAYMENT_ATTEMPT_PERSISTED",
  );

  return {
    success: true,
    gateway: "razorpay",
    orderId: rzpOrder.id,
    keyId: cfg.keyId,
    orderAmount: payableAmount,
    amountInPaise,
    orderCurrency: "INR",
    customer: {
      id: customerId,
      name: customerName,
      phone,
      email: customerEmail,
    },
    environment: cfg.env,
    correlationId,
  };
}

export interface ReconcileRazorpayPaymentParams {
  orderId: string;
  paymentId: string;
  signature?: string;
  customerId?: number;
  invoiceId?: number;
  rawPayload?: Record<string, unknown>;
  source: "webhook" | "verify";
}

/**
 * Atomically reconciles a successful Razorpay payment with the billing ledger.
 * Guarantees idempotency: duplicate executions will never duplicate payments or ledger adjustments.
 */
export async function reconcileRazorpayPayment(params: ReconcileRazorpayPaymentParams) {
  const { orderId, paymentId } = params;

  return await db.transaction(async (tx) => {
    // 1. Lock payment attempt record
    let [attempt] = await tx
      .select()
      .from(paymentAttemptsTable)
      .where(eq(paymentAttemptsTable.rzpOrderId, orderId))
      .for("update")
      .limit(1);

    if (!attempt) {
      // Also check gateway_order_id in case orderId was stored there
      [attempt] = await tx
        .select()
        .from(paymentAttemptsTable)
        .where(eq(paymentAttemptsTable.gatewayOrderId, orderId))
        .for("update")
        .limit(1);
    }

    let effectiveAmount = attempt ? parseFloat(attempt.amount) : 0;
    let effectiveCustomerId = attempt?.customerId ?? params.customerId;
    let effectiveInvoiceId = attempt?.invoiceId ?? params.invoiceId ?? null;

    // If attempt is already paid, return existing payment record idempotently
    if (attempt && attempt.status === "paid") {
      const [existingPayment] = await tx
        .select()
        .from(paymentsTable)
        .where(and(
          eq(paymentsTable.customerId, attempt.customerId),
          eq(paymentsTable.transactionId, orderId),
        ))
        .orderBy(desc(paymentsTable.id))
        .limit(1);

      const receipt = await buildReceiptObject(existingPayment, attempt.customerId, tx);
      return {
        settled: true,
        alreadyPaid: true,
        attempt,
        payment: existingPayment,
        receipt,
      };
    }

    // Check if payment already exists in paymentsTable (concurrent webhook vs verify race defense)
    const [existingPayment] = await tx
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.transactionId, orderId))
      .limit(1);

    if (existingPayment) {
      const receipt = await buildReceiptObject(existingPayment, effectiveCustomerId || existingPayment.customerId, tx);
      return {
        settled: true,
        alreadyPaid: true,
        attempt: attempt || null,
        payment: existingPayment,
        receipt,
      };
    }

    if (!effectiveCustomerId) {
      const [firstCust] = await tx.select({ id: customersTable.id }).from(customersTable).limit(1);
      effectiveCustomerId = firstCust?.id ?? 1;
    }

    // If effectiveAmount is 0 and we have an invoice, resolve balance from invoice
    if (effectiveAmount <= 0 && effectiveInvoiceId) {
      const [inv] = await tx
        .select({ balanceDue: invoicesTable.balanceDue })
        .from(invoicesTable)
        .where(eq(invoicesTable.id, effectiveInvoiceId))
        .limit(1);
      if (inv) {
        effectiveAmount = parseFloat(inv.balanceDue);
      }
    }

    // 2. Call recordPayment to update invoice and sync dues atomically
    const paymentRecord = await recordPayment({
      customerId: effectiveCustomerId,
      amount: effectiveAmount,
      method: "razorpay",
      invoiceId: effectiveInvoiceId,
      transactionId: orderId,
      notes: `Razorpay payment for order ${orderId} (Payment ID: ${paymentId})`,
    }, tx);

    // 3. Update or create payment attempt record
    if (attempt) {
      const [updated] = await tx
        .update(paymentAttemptsTable)
        .set({
          status: "paid",
          gatewayProvider: "razorpay",
          rzpPaymentId: paymentId,
          rzpSignature: params.signature || attempt.rzpSignature || null,
          paymentMethod: "razorpay",
          rawWebhookPayload: params.source === "webhook" ? (params.rawPayload ?? attempt.rawWebhookPayload) : attempt.rawWebhookPayload,
          rawVerificationPayload: params.source === "verify" ? (params.rawPayload ?? attempt.rawVerificationPayload) : attempt.rawVerificationPayload,
          updatedAt: new Date(),
        })
        .where(eq(paymentAttemptsTable.id, attempt.id))
        .returning();
      attempt = updated;
    } else {
      const randomSuffix = randomBytes(4).toString("hex");
      const [upserted] = await tx
        .insert(paymentAttemptsTable)
        .values({
          attemptId: `cwp_att_${Date.now()}_${randomSuffix}`,
          gatewayProvider: "razorpay",
          rzpOrderId: orderId,
          gatewayOrderId: orderId,
          customerId: effectiveCustomerId,
          invoiceId: effectiveInvoiceId,
          amount: effectiveAmount.toFixed(2),
          currency: "INR",
          status: "paid",
          rzpPaymentId: paymentId,
          rzpSignature: params.signature || null,
          paymentMethod: "razorpay",
          idempotencyKey: `auto_rec_rzp_${orderId}`,
          rawWebhookPayload: params.source === "webhook" ? params.rawPayload : null,
          rawVerificationPayload: params.source === "verify" ? params.rawPayload : null,
        })
        .onConflictDoUpdate({
          target: paymentAttemptsTable.idempotencyKey,
          set: {
            status: "paid",
            rzpPaymentId: paymentId,
            updatedAt: new Date(),
          },
        })
        .returning();
      attempt = upserted;
    }

    const receipt = await buildReceiptObject(paymentRecord, effectiveCustomerId, tx);

    // 4. Activate pending subscription post authoritative payment
    const targetSubId = attempt?.subscriptionId;
    if (targetSubId) {
      const [sub] = await tx
        .select()
        .from(dcmsSubscriptionsTable)
        .where(eq(dcmsSubscriptionsTable.id, targetSubId))
        .limit(1);

      if (sub && sub.status === "pending_payment") {
        await tx
          .update(dcmsSubscriptionsTable)
          .set({
            status: "active",
            version: (sub.version || 1) + 1,
            updatedAt: new Date(),
          })
          .where(eq(dcmsSubscriptionsTable.id, sub.id));

        try {
          const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
          await enqueuePendingFromDcmsSubscription(sub.id);
        } catch (enqueueErr) {
          logger.warn({ err: enqueueErr, subscriptionId: sub.id }, "[RAZORPAY_SERVICE] Failed to enqueue cleaner assignments post payment");
        }

        try {
          const { logDcmsActivity } = await import("../dcms/auditLog");
          await logDcmsActivity({
            subscriptionId: sub.id,
            action: "subscription_activated_post_payment",
            entityType: "subscription",
            entityId: sub.id,
            performedBy: effectiveCustomerId,
            metadata: { orderId, paymentId, amount: effectiveAmount, paymentRecordId: paymentRecord?.id },
          });
        } catch {
          // non-fatal audit log
        }
      }
    } else if (effectiveInvoiceId) {
      // Fallback: check if invoice was generated for a pending DCMS subscription
      const [pendingSub] = await tx
        .select()
        .from(dcmsSubscriptionsTable)
        .where(
          and(
            eq(dcmsSubscriptionsTable.customerId, effectiveCustomerId),
            eq(dcmsSubscriptionsTable.status, "pending_payment"),
          )
        )
        .orderBy(desc(dcmsSubscriptionsTable.id))
        .limit(1);

      if (pendingSub) {
        await tx
          .update(dcmsSubscriptionsTable)
          .set({
            status: "active",
            version: (pendingSub.version || 1) + 1,
            updatedAt: new Date(),
          })
          .where(eq(dcmsSubscriptionsTable.id, pendingSub.id));

        try {
          const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
          await enqueuePendingFromDcmsSubscription(pendingSub.id);
        } catch (enqueueErr) {
          logger.warn({ err: enqueueErr, subscriptionId: pendingSub.id }, "[RAZORPAY_SERVICE] Failed to enqueue cleaner assignments post payment");
        }
      }
    }

    return {
      settled: true,
      alreadyPaid: false,
      attempt,
      payment: paymentRecord,
      receipt,
    };
  });
}

/**
 * Records checkout failure received from client-side modal (Finding 1 & Finding 2: Stage 11).
 * Updates payment_attempts table status to 'failed' and stores diagnostic failure payload in metadata.
 */
export async function recordRazorpayCheckoutFailure(params: {
  orderId: string;
  customerId?: number;
  correlationId: string;
  error: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}) {
  const { orderId, customerId, correlationId, error } = params;

  logger.warn(
    {
      stage: "CHECKOUT_FAILURE_RECEIVED",
      stageStatus: "RECORDING",
      correlationId,
      orderId,
      customerId,
      code: error.code,
      description: error.description,
      source: error.source,
      step: error.step,
      reason: error.reason,
    },
    "[RAZORPAY_SERVICE] Stage 11: Recording CHECKOUT_FAILURE_RECEIVED",
  );

  const [attempt] = await db
    .select()
    .from(paymentAttemptsTable)
    .where(
      and(
        eq(paymentAttemptsTable.rzpOrderId, orderId),
        customerId ? eq(paymentAttemptsTable.customerId, customerId) : sql`TRUE`,
      ),
    )
    .limit(1);

  if (attempt) {
    const existingMeta = (attempt.metadata as Record<string, unknown>) || {};
    const failureMeta = {
      ...existingMeta,
      lastFailure: {
        code: error.code || "CHECKOUT_FAILURE",
        description: error.description || "Checkout failed",
        source: error.source || "gateway",
        step: error.step || "payment_authorization",
        reason: error.reason || "unknown",
        paymentId: error.metadata?.payment_id,
        correlationId,
        failedAt: new Date().toISOString(),
      },
    };

    await db
      .update(paymentAttemptsTable)
      .set({
        status: "failed",
        metadata: failureMeta,
        updatedAt: new Date(),
      })
      .where(eq(paymentAttemptsTable.id, attempt.id));

    logger.info(
      {
        stage: "CHECKOUT_FAILURE_PERSISTED",
        stageStatus: "SUCCESS",
        correlationId,
        orderId,
        attemptId: attempt.attemptId,
      },
      "[RAZORPAY_SERVICE] Transitioned payment attempt to failed status",
    );

    return { recorded: true, attemptId: attempt.attemptId };
  }

  return { recorded: false };
}

/**
 * Verifies client-submitted Razorpay payment completion tokens.
 */
export async function verifyRazorpayPayment(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  customerId: number;
  correlationId?: string;
}) {
  const { orderId, paymentId, signature, customerId } = params;
  const correlationId = params.correlationId || `cwp_cor_${Date.now()}`;

  logger.info(
    {
      stage: "PAYMENT_VERIFICATION_RECEIVED",
      stageStatus: "RECEIVED",
      correlationId,
      orderId,
      paymentId,
      customerId,
    },
    "[RAZORPAY_SERVICE] Stage 12: PAYMENT_VERIFICATION_RECEIVED",
  );

  // 1. Verify cryptographic payment signature
  const isValidSignature = verifyRazorpayPaymentSignature(orderId, paymentId, signature);
  if (!isValidSignature) {
    logger.warn(
      { stage: "PAYMENT_VERIFICATION_RECEIVED", stageStatus: "FAILED", correlationId, orderId, paymentId },
      "[RAZORPAY_SERVICE] Client submitted invalid payment signature",
    );
    throw new RazorpayPaymentServiceError(
      "Payment signature verification failed",
      "INVALID_PAYMENT_SIGNATURE",
      400,
      "PAYMENT_VERIFICATION_RECEIVED",
      correlationId,
    );
  }

  // 2. Query Razorpay API to confirm payment entity is captured
  const client = new RazorpayClient();
  let paymentEntity: RazorpayPaymentEntity;
  try {
    paymentEntity = await client.getPayment(paymentId, { correlationId });
  } catch (err: any) {
    logger.error(
      { stage: "PAYMENT_VERIFICATION_RECEIVED", stageStatus: "GATEWAY_ERROR", err: err.message, paymentId, orderId, correlationId },
      "[RAZORPAY_SERVICE] Failed to fetch payment from Razorpay API",
    );
    throw new RazorpayPaymentServiceError(
      "Could not confirm payment with Razorpay gateway",
      "GATEWAY_VERIFICATION_FAILED",
      502,
      "PAYMENT_VERIFICATION_RECEIVED",
      correlationId,
    );
  }

  if (paymentEntity.order_id !== orderId) {
    throw new RazorpayPaymentServiceError(
      "Payment does not match the specified order",
      "ORDER_MISMATCH",
      400,
      "PAYMENT_VERIFICATION_RECEIVED",
      correlationId,
    );
  }

  if (paymentEntity.status !== "captured" && paymentEntity.status !== "authorized") {
    return {
      success: false,
      status: paymentEntity.status.toUpperCase(),
      orderId,
      paymentId,
      correlationId,
      message: `Payment is in ${paymentEntity.status} status`,
    };
  }

  // 3. Atomically reconcile with ledger (Stage 13: LEDGER_RECONCILIATION_COMPLETED)
  const result = await reconcileRazorpayPayment({
    orderId,
    paymentId,
    signature,
    customerId,
    source: "verify",
    rawPayload: paymentEntity as any,
  });

  logger.info(
    {
      stage: "LEDGER_RECONCILIATION_COMPLETED",
      stageStatus: "SUCCESS",
      correlationId,
      orderId,
      paymentId,
      paymentRecordId: result.payment?.id,
    },
    "[RAZORPAY_SERVICE] Stage 13: LEDGER_RECONCILIATION_COMPLETED",
  );

  return {
    success: true,
    status: "PAID",
    orderId,
    paymentId,
    amount: paymentEntity.amount / 100,
    receipt: result.receipt,
    correlationId,
  };
}

/**
 * Processes incoming Razorpay Webhook events.
 */
export async function handleRazorpayWebhookPayload(
  rawBody: Buffer,
  signature: string,
  eventId?: string,
) {
  const isValid = verifyRazorpayWebhookSignature(rawBody, signature);
  if (!isValid) {
    logger.warn("[RAZORPAY_WEBHOOK] Received webhook with invalid signature");
    throw new RazorpayPaymentServiceError("Invalid webhook signature", "INVALID_SIGNATURE", 400);
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    throw new RazorpayPaymentServiceError("Malformed JSON webhook body", "INVALID_JSON", 400);
  }

  const event = payload.event;
  logger.info({ event, accountId: payload.account_id, eventId }, "[RAZORPAY_WEBHOOK] Ingested webhook event");

  // 1. Durable event-level deduplication using x-razorpay-event-id
  if (eventId) {
    try {
      const [existingEvent] = await db
        .select()
        .from(paymentWebhookEventsTable)
        .where(eq(paymentWebhookEventsTable.eventId, eventId))
        .limit(1);

      if (existingEvent) {
        logger.info(
          { eventId, event },
          "[RAZORPAY_WEBHOOK] Duplicate webhook event detected, skipping idempotent processing",
        );
        return { received: true, duplicate: true, status: existingEvent.status };
      }
    } catch (checkErr) {
      logger.warn({ checkErr, eventId }, "[RAZORPAY_WEBHOOK] Event deduplication check warning");
    }
  }

  let orderId: string | undefined;
  let paymentId: string | undefined;

  // 2. Settlement event handling: captured, order.paid, or auto-captured authorization
  if (
    event === "payment.captured" ||
    event === "order.paid" ||
    (event === "payment.authorized" &&
      (payload.payload.payment?.entity?.status === "captured" || payload.payload.payment?.entity?.captured))
  ) {
    const payment = payload.payload.payment?.entity;
    const order = payload.payload.order?.entity;
    orderId = order?.id || payment?.order_id;
    paymentId = payment?.id;

    if (!orderId || !paymentId) {
      logger.warn({ payload }, "[RAZORPAY_WEBHOOK] Webhook missing orderId or paymentId");
      return { received: true, ignored: true };
    }

    await reconcileRazorpayPayment({
      orderId,
      paymentId,
      source: "webhook",
      rawPayload: payload as any,
    });

    if (eventId) {
      try {
        await db.insert(paymentWebhookEventsTable).values({
          eventId,
          gatewayProvider: "razorpay",
          eventType: event,
          orderId,
          paymentId,
          payload: payload as any,
          status: "processed",
        });
      } catch (insertErr) {
        logger.warn({ insertErr, eventId }, "[RAZORPAY_WEBHOOK] Webhook event recording note");
      }
    }

    return { received: true, settled: true };
  }

  // 3. Authorization event handling
  if (event === "payment.authorized") {
    const payment = payload.payload.payment?.entity;
    orderId = payment?.order_id;
    paymentId = payment?.id;

    if (orderId) {
      await db
        .update(paymentAttemptsTable)
        .set({
          status: "active",
          rzpPaymentId: paymentId || null,
          updatedAt: new Date(),
        })
        .where(eq(paymentAttemptsTable.rzpOrderId, orderId));
    }

    if (eventId) {
      try {
        await db.insert(paymentWebhookEventsTable).values({
          eventId,
          gatewayProvider: "razorpay",
          eventType: event,
          orderId: orderId || null,
          paymentId: paymentId || null,
          payload: payload as any,
          status: "authorized",
        });
      } catch {}
    }

    return { received: true, authorized: true };
  }

  // 4. Failure event handling
  if (event === "payment.failed") {
    const payment = payload.payload.payment?.entity;
    orderId = payment?.order_id;
    paymentId = payment?.id;

    if (orderId) {
      await db
        .update(paymentAttemptsTable)
        .set({
          status: "failed",
          rzpPaymentId: paymentId || null,
          updatedAt: new Date(),
        })
        .where(eq(paymentAttemptsTable.rzpOrderId, orderId));
    }

    if (eventId) {
      try {
        await db.insert(paymentWebhookEventsTable).values({
          eventId,
          gatewayProvider: "razorpay",
          eventType: event,
          orderId: orderId || null,
          paymentId: paymentId || null,
          payload: payload as any,
          status: "failed",
        });
      } catch {}
    }

    return { received: true, failed: true };
  }

  // 5. Durably record unhandled event for audit trail
  if (eventId) {
    try {
      await db.insert(paymentWebhookEventsTable).values({
        eventId,
        gatewayProvider: "razorpay",
        eventType: event,
        orderId: payload.payload.order?.entity?.id || payload.payload.payment?.entity?.order_id || null,
        paymentId: payload.payload.payment?.entity?.id || null,
        payload: payload as any,
        status: "unhandled",
      });
    } catch {}
  }

  return { received: true, unhandledEvent: event };
}
