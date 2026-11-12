/**
 * Cashfree Hosted Web Checkout SDK Loader & Checkout Helper
 * Uses Cashfree PG JS SDK v3: https://sdk.cashfree.com/js/v3/cashfree.js
 */

declare global {
  interface Window {
    Cashfree?: (config: { mode: "sandbox" | "production" }) => {
      checkout: (options: {
        paymentSessionId: string;
        redirectTarget?: "_self" | "_blank" | "_top";
      }) => Promise<{ error?: { message?: string } }>;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

export function loadCashfreeScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.Cashfree) {
    return Promise.resolve();
  }

  if (sdkPromise) {
    return sdkPromise;
  }

  sdkPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="cashfree.js"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Cashfree SDK")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Failed to load Cashfree Payment Gateway SDK. Please check your network connection."));
    };
    document.head.appendChild(script);
  });

  return sdkPromise;
}

export interface LaunchCashfreeCheckoutParams {
  paymentSessionId: string;
  environment?: "sandbox" | "production";
  redirectTarget?: "_self" | "_blank" | "_top";
}

/**
 * Initializes Cashfree PG JS SDK and launches Hosted Web Checkout
 */
export async function launchCashfreeCheckout(params: LaunchCashfreeCheckoutParams): Promise<void> {
  const { paymentSessionId, environment = "sandbox", redirectTarget = "_self" } = params;

  await loadCashfreeScript();

  if (!window.Cashfree) {
    throw new Error("Cashfree SDK failed to initialize");
  }

  const cashfree = window.Cashfree({
    mode: environment === "production" ? "production" : "sandbox",
  });

  const result = await cashfree.checkout({
    paymentSessionId,
    redirectTarget,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Failed to open Cashfree Checkout");
  }
}
