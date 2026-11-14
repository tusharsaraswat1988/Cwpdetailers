import { getActivePaymentGateway, type PaymentGatewayType } from "../razorpay/razorpayConfig";
import { createRazorpayPaymentOrder, type CreateRazorpayOrderParams } from "../razorpay/razorpayService";
import { createCashfreePaymentOrder, type CreateOrderParams as CreateCashfreeOrderParams } from "../cashfree/cashfreeService";
import { logger } from "../logger";

export interface UnifiedCreateOrderParams {
  customerId: number;
  invoiceId?: number;
  subscriptionId?: number;
  cityId?: number;
  branchId?: number;
  legalEntityId?: number;
  returnUrl?: string;
  baseUrl?: string;
  idempotencyKey?: string;
  forceGateway?: PaymentGatewayType;
}

export type UnifiedCreateOrderResult =
  | {
      success: true;
      gateway: "razorpay";
      orderId: string;
      keyId: string;
      orderAmount: number;
      amountInPaise: number;
      orderCurrency: "INR";
      customer: {
        id: number;
        name: string;
        phone: string;
        email?: string;
      };
      environment: "sandbox" | "production";
    }
  | {
      success: true;
      gateway: "cashfree";
      orderId: string;
      paymentSessionId: string;
      orderAmount: number;
      orderCurrency: "INR";
      environment: "sandbox" | "production";
    };

/**
 * Creates an authoritative payment order using the active payment gateway defined in environment (.env).
 * Supports seamless failover between Razorpay and Cashfree without client disruption.
 */
export async function createUnifiedPaymentOrder(
  params: UnifiedCreateOrderParams,
): Promise<UnifiedCreateOrderResult> {
  const activeGateway = params.forceGateway || getActivePaymentGateway();

  logger.info(
    { activeGateway, customerId: params.customerId, invoiceId: params.invoiceId, subscriptionId: params.subscriptionId },
    "[UNIFIED_PAYMENTS] Dispatching payment order creation to active gateway",
  );

  if (activeGateway === "razorpay") {
    try {
      const result = await createRazorpayPaymentOrder({
        customerId: params.customerId,
        invoiceId: params.invoiceId,
        subscriptionId: params.subscriptionId,
        cityId: params.cityId,
        branchId: params.branchId,
        legalEntityId: params.legalEntityId,
        idempotencyKey: params.idempotencyKey,
      });

      return result;
    } catch (err: any) {
      logger.warn(
        { err: err.message, code: err.code, customerId: params.customerId },
        "[UNIFIED_PAYMENTS] Primary gateway (Razorpay) order creation failed",
      );
      throw err;
    }
  }

  // Otherwise route to Cashfree
  const result = await createCashfreePaymentOrder({
    customerId: params.customerId,
    invoiceId: params.invoiceId,
    subscriptionId: params.subscriptionId,
    cityId: params.cityId,
    branchId: params.branchId,
    legalEntityId: params.legalEntityId,
    returnUrl: params.returnUrl,
    baseUrl: params.baseUrl,
    idempotencyKey: params.idempotencyKey,
  });

  return {
    ...result,
    gateway: "cashfree",
  };
}
