/**
 * Razorpay Standard Checkout SDK Loader & Modal Trigger
 * Uses Razorpay Checkout JS v1: https://checkout.razorpay.com/v1/checkout.js
 */

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayErrorDetail {
  code: string;
  description: string;
  source: string;
  step: string;
  reason: string;
  metadata?: {
    order_id?: string;
    payment_id?: string;
    [key: string]: unknown;
  };
}

export interface RazorpayPaymentFailurePayload {
  error: RazorpayErrorDetail;
  correlationId: string;
  timestamp: string;
}

export class RazorpayCheckoutError extends Error {
  public readonly code: string;
  public readonly description: string;
  public readonly source: string;
  public readonly step: string;
  public readonly reason: string;
  public readonly orderId?: string;
  public readonly paymentId?: string;
  public readonly correlationId: string;
  public readonly timestamp: string;
  public readonly isDismissal: boolean;

  constructor(payload: {
    message: string;
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    orderId?: string;
    paymentId?: string;
    correlationId: string;
    isDismissal?: boolean;
  }) {
    super(payload.message);
    this.name = "RazorpayCheckoutError";
    this.code = payload.code || "CHECKOUT_FAILED";
    this.description = payload.description || payload.message;
    this.source = payload.source || "checkout_modal";
    this.step = payload.step || "payment_initiation";
    this.reason = payload.reason || "unknown";
    this.orderId = payload.orderId;
    this.paymentId = payload.paymentId;
    this.correlationId = payload.correlationId;
    this.timestamp = new Date().toISOString();
    this.isDismissal = Boolean(payload.isDismissal);
  }
}

export interface LaunchRazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency?: string;
  name?: string;
  description?: string;
  correlationId?: string;
  prefill?: {
    name?: string;
    contact?: string;
    email?: string;
  };
  themeColor?: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (data: unknown) => void) => void;
      close: () => void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.Razorpay) {
    return Promise.resolve();
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Razorpay SDK")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Failed to load Razorpay Payment Gateway SDK. Please check your network connection."));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

/**
 * Reports checkout failure event asynchronously to backend for diagnostic ledger persistence.
 */
async function reportCheckoutFailureBeacon(payload: {
  orderId: string;
  correlationId: string;
  error: RazorpayErrorDetail;
}): Promise<void> {
  try {
    await fetch("/api/payments/razorpay/record-failure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Non-blocking telemetry swallow
    console.warn("[RAZORPAY_CHECKOUT] Failure beacon delivery error", err);
  }
}

/**
 * Initializes Razorpay Standard Checkout modal popup.
 * Resolves with verification tokens upon user completion, or rejects on dismissal/failure.
 */
export async function launchRazorpayCheckout(
  options: LaunchRazorpayCheckoutOptions,
): Promise<RazorpayPaymentSuccessResponse> {
  const correlationId =
    options.correlationId ||
    `cwp_cor_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  console.info("[RAZORPAY_CHECKOUT] Stage 9: CHECKOUT_LAUNCH_REQUESTED", {
    stage: "CHECKOUT_LAUNCH_REQUESTED",
    correlationId,
    orderId: options.orderId,
    keyPrefix: options.keyId?.slice(0, 9),
    amountInPaise: options.amountInPaise,
  });

  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new RazorpayCheckoutError({
      message: "Razorpay SDK could not be initialized in this browser session",
      code: "SDK_INITIALIZATION_FAILED",
      source: "client_environment",
      step: "sdk_loading",
      reason: "window_razorpay_missing",
      orderId: options.orderId,
      correlationId,
      isDismissal: false,
    });
  }

  return new Promise((resolve, reject) => {
    let completed = false;
    let failed = false;

    const rzpOptions = {
      key: options.keyId,
      amount: options.amountInPaise,
      currency: options.currency || "INR",
      name: options.name || "CWP Detailers",
      description: options.description || "Service Payment",
      order_id: options.orderId,
      prefill: {
        name: options.prefill?.name || "",
        contact: options.prefill?.contact || "",
        email: options.prefill?.email || "",
      },
      theme: {
        color: options.themeColor || "#1677FF",
      },
      modal: {
        backdropclose: false,
        escape: true,
        handleback: true,
        confirm_close: true,
        ondismiss: () => {
          if (!completed && !failed) {
            console.info("[RAZORPAY_CHECKOUT] User closed checkout window", {
              stage: "CHECKOUT_USER_DROPPED",
              correlationId,
              orderId: options.orderId,
            });
            reject(
              new RazorpayCheckoutError({
                message: "Payment window was closed by the user",
                code: "USER_DROPPED",
                source: "user_action",
                step: "checkout_modal",
                reason: "modal_dismissed",
                orderId: options.orderId,
                correlationId,
                isDismissal: true,
              }),
            );
          }
        },
      },
      handler: (response: RazorpayPaymentSuccessResponse) => {
        completed = true;
        console.info("[RAZORPAY_CHECKOUT] Stage 12: Checkout handler token received", {
          stage: "PAYMENT_HANDLER_RECEIVED",
          correlationId,
          orderId: response.razorpay_order_id,
          paymentId: response.razorpay_payment_id,
        });
        resolve(response);
      },
    };

    try {
      const rzpInstance = new window.Razorpay(rzpOptions as any);

      // Register explicit payment.failed listener (FINDING 1)
      rzpInstance.on("payment.failed", (response: any) => {
        failed = true;
        const errObj = response?.error || {};
        const safeErrorDetail: RazorpayErrorDetail = {
          code: String(errObj.code || "PAYMENT_FAILED"),
          description: String(errObj.description || "Payment has failed due to a merchant or gateway error"),
          source: String(errObj.source || "gateway"),
          step: String(errObj.step || "payment_authorization"),
          reason: String(errObj.reason || "payment_failed"),
          metadata: {
            order_id: errObj.metadata?.order_id || options.orderId,
            payment_id: errObj.metadata?.payment_id || undefined,
          },
        };

        console.error("[RAZORPAY_CHECKOUT] Stage 11: CHECKOUT_FAILURE_RECEIVED", {
          stage: "CHECKOUT_FAILURE_RECEIVED",
          correlationId,
          code: safeErrorDetail.code,
          description: safeErrorDetail.description,
          source: safeErrorDetail.source,
          step: safeErrorDetail.step,
          reason: safeErrorDetail.reason,
          orderId: safeErrorDetail.metadata?.order_id,
          paymentId: safeErrorDetail.metadata?.payment_id,
          timestamp: new Date().toISOString(),
        });

        // Report failure to backend diagnostic endpoint to update payment attempt status
        reportCheckoutFailureBeacon({
          orderId: safeErrorDetail.metadata?.order_id || options.orderId,
          correlationId,
          error: safeErrorDetail,
        });

        reject(
          new RazorpayCheckoutError({
            message: safeErrorDetail.description,
            code: safeErrorDetail.code,
            description: safeErrorDetail.description,
            source: safeErrorDetail.source,
            step: safeErrorDetail.step,
            reason: safeErrorDetail.reason,
            orderId: safeErrorDetail.metadata?.order_id,
            paymentId: safeErrorDetail.metadata?.payment_id,
            correlationId,
            isDismissal: false,
          }),
        );
      });

      rzpInstance.open();

      console.info("[RAZORPAY_CHECKOUT] Stage 10: CHECKOUT_OPENED", {
        stage: "CHECKOUT_OPENED",
        correlationId,
        orderId: options.orderId,
      });
    } catch (err: any) {
      reject(
        new RazorpayCheckoutError({
          message: err.message || "Could not launch Razorpay checkout modal",
          code: "MODAL_LAUNCH_FAILED",
          source: "client_execution",
          step: "modal_open",
          reason: "exception_during_launch",
          orderId: options.orderId,
          correlationId,
          isDismissal: false,
        }),
      );
    }
  });
}
