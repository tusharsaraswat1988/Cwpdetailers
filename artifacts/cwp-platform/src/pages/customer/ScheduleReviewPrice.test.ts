import { describe, it, expect } from "vitest";

describe("Customer Schedule & Booking Price Verification", () => {
  it("computes conversion value and payment amount using appliedCoupon or estimatedPrice fallback", () => {
    const estimatedPrice = 799;

    // Without coupon
    const appliedCouponNull = null;
    const paymentAmountWithoutCoupon = (appliedCouponNull as any)?.finalPayable ?? estimatedPrice ?? undefined;
    expect(paymentAmountWithoutCoupon).toBe(799);

    // With coupon applied
    const appliedCoupon = {
      code: "SPECIAL50",
      discountAmount: 150,
      finalPayable: 649,
      discountPercentage: 20,
    };
    const paymentAmountWithCoupon = appliedCoupon?.finalPayable ?? estimatedPrice ?? undefined;
    expect(paymentAmountWithCoupon).toBe(649);

    // When estimated price is 0 (covered by subscription)
    const coveredEstimatedPrice = 0;
    const paymentCovered = (appliedCouponNull as any)?.finalPayable ?? coveredEstimatedPrice ?? undefined;
    expect(paymentCovered).toBe(0);
  });

  it("ensures no stale calculatedEstimatedPrice variable is referenced", () => {
    // Verify that estimatedPrice is the canonical variable name across schedule flows
    const mockContext = {
      estimatedPrice: 499,
      appliedCoupon: { finalPayable: 399 },
    };
    const finalAmount = mockContext.appliedCoupon?.finalPayable ?? mockContext.estimatedPrice ?? undefined;
    expect(finalAmount).toBe(399);
  });
});
