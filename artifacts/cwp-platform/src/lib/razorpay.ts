/**
 * Razorpay Standard Checkout SDK Loader & Modal Trigger
 * Uses Razorpay Checkout JS v1: https://checkout.razorpay.com/v1/checkout.js
 */

export interface RazorpayPaymentSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface LaunchRazorpayCheckoutOptions {
  keyId: string;
  orderId: string;
  amountInPaise: number;
  currency?: string;
  name?: string;
  description?: string;
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
 * Initializes Razorpay Standard Checkout modal popup.
 * Resolves with verification tokens upon user completion, or rejects on dismissal/failure.
 */
export async function launchRazorpayCheckout(
  options: LaunchRazorpayCheckoutOptions,
): Promise<RazorpayPaymentSuccessResponse> {
  await loadRazorpayScript();

  if (!window.Razorpay) {
    throw new Error("Razorpay SDK could not be initialized");
  }

  return new Promise((resolve, reject) => {
    let completed = false;

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
          if (!completed) {
            reject(new Error("Payment window was closed by the user"));
          }
        },
      },
      handler: (response: RazorpayPaymentSuccessResponse) => {
        completed = true;
        resolve(response);
      },
    };

    try {
      const rzpInstance = new window.Razorpay(rzpOptions as any);
      rzpInstance.open();
    } catch (err: any) {
      reject(new Error(err.message || "Could not launch Razorpay checkout modal"));
    }
  });
}
