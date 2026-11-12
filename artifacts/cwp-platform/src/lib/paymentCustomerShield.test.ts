import { describe, it, expect } from "vitest";
import {
  isCustomerSafeMessage,
  sanitizeCustomerPaymentMessage,
  buildWhatsAppPaymentUrl,
} from "./paymentCustomerShield";

describe("Payment Customer Shield (CUST-016 & CUST-UX)", () => {
  it("rejects technical and alarming error strings", () => {
    expect(isCustomerSafeMessage("authentication Failed")).toBe(false);
    expect(isCustomerSafeMessage("Cashfree Payment Gateway authentication failed")).toBe(false);
    expect(isCustomerSafeMessage("Internal Server Error 500")).toBe(false);
    expect(isCustomerSafeMessage("Invalid CASHFREE_APP_ID or SECRET_KEY")).toBe(false);
    expect(isCustomerSafeMessage("Railway deployment timed out")).toBe(false);
    expect(isCustomerSafeMessage("Postgres connection pool exhausted")).toBe(false);
    expect(isCustomerSafeMessage("TypeError: Cannot read properties of undefined")).toBe(false);
  });

  it("permits calm customer-friendly text", () => {
    expect(isCustomerSafeMessage("All dues have been settled")).toBe(true);
    expect(isCustomerSafeMessage("Doorstep payment confirmed")).toBe(true);
    expect(isCustomerSafeMessage("Welcome back to your dashboard")).toBe(true);
  });

  it("sanitizes raw gateway errors into reassuring customer copy", () => {
    const result = sanitizeCustomerPaymentMessage("Cashfree 401: authentication Failed", "CASHFREE_API_ERROR");
    expect(result.isAllClear).toBe(false);
    expect(result.title).toBe("Alternative Payment Assistance");
    expect(result.description).not.toContain("Cashfree");
    expect(result.description).not.toContain("401");
    expect(result.description).not.toContain("Failed");
  });

  it("maps NO_OUTSTANDING_DUES to an all-clear confirmation", () => {
    const result = sanitizeCustomerPaymentMessage("No outstanding dues found", "NO_OUTSTANDING_DUES");
    expect(result.isAllClear).toBe(true);
    expect(result.title).toBe("All Dues Cleared");
  });

  it("constructs prefilled WhatsApp payment assistance URLs correctly", () => {
    const url = buildWhatsAppPaymentUrl(1300, "917054007733", "ORD_12345");
    expect(url).toContain("https://wa.me/917054007733");
    expect(url).toContain("1%2C300.00");
    expect(url).toContain("ORD_12345");
  });
});
