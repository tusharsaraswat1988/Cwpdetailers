/**
 * Customer Shielding for Payment Flows (PRD CUST-016 & CUST-UX)
 *
 * Guarantees that customers never see technical gateway errors, authentication failures,
 * environment variable names, or confusing alerts during payment checkout.
 */

export interface PaymentAssistanceOptions {
  whatsAppUrl: string;
  doorstepSupported: boolean;
  supportPhone: string;
}

const FORBIDDEN_CUSTOMER_PATTERNS = [
  /authentication\s*failed/i,
  /cashfree/i,
  /railway/i,
  /cwpdetailers-production/i,
  /api[_-]?key/i,
  /secret[_-]?key/i,
  /app[_-]?id/i,
  /x-client/i,
  /stack\s*trace/i,
  /internal\s*server\s*error/i,
  /syntaxerror/i,
  /typeerror/i,
  /referenceerror/i,
  /database\s*error/i,
  /drizzle/i,
  /postgres/i,
  /pnpm/i,
  /401/i,
  /500/i,
  /502/i,
  /503/i,
];

/**
 * Checks whether an error or message is safe to display to an end-customer.
 * Returns false if it contains raw technical jargon or alarming terms.
 */
export function isCustomerSafeMessage(message?: string | null): boolean {
  if (!message || typeof message !== "string") return true;
  return !FORBIDDEN_CUSTOMER_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Normalizes any error message into a reassuring customer copy.
 * If the input contains technical jargon, it returns a calm, reassuring fallback.
 */
export function sanitizeCustomerPaymentMessage(
  rawMessage?: string | null,
  code?: string | null,
): { title: string; description: string; isAllClear?: boolean } {
  if (code === "NO_OUTSTANDING_DUES") {
    return {
      title: "All Dues Cleared",
      description: "Your account has no outstanding balance at this time. Thank you!",
      isAllClear: true,
    };
  }

  // Under no circumstances should technical errors be returned
  return {
    title: "Alternative Payment Assistance",
    description:
      "You can complete your payment via WhatsApp UPI QR code or pay our detailing specialist directly upon service delivery.",
    isAllClear: false,
  };
}

/**
 * Generates direct WhatsApp concierge link for instant payment assistance.
 */
export function buildWhatsAppPaymentUrl(
  payableAmount: number,
  supportPhone = "917054007733",
  referenceId?: string,
): string {
  const cleanPhone = supportPhone.replace(/\D/g, "");
  const formattedAmount = Math.max(0, payableAmount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const refPart = referenceId ? ` (Ref: ${referenceId})` : "";
  const text = `Hi CWP Detailers, I would like to complete my payment of ₹${formattedAmount}${refPart}. Please share the UPI QR code.`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
}
