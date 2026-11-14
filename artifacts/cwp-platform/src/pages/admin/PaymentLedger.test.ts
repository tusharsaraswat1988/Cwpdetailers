import { describe, it, expect } from "vitest";

describe("Phase 26: Financial Command Center Frontend Logic", () => {
  it("formats IST timestamps consistently", () => {
    const d = new Date("2026-11-14T08:30:00.000Z"); // 2:00 PM IST
    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(d);

    expect(formatted).toContain("14 Nov 2026");
    expect(formatted).toContain("02:00 pm");
  });

  it("calculates refundable balance safely preventing negative amounts", () => {
    const originalAmount = 2500;
    const previouslyRefunded = 1000;
    const balance = Math.max(0, originalAmount - previouslyRefunded);
    expect(balance).toBe(1500);

    const fullRefundBalance = Math.max(0, originalAmount - 2500);
    expect(fullRefundBalance).toBe(0);

    const overRefundDefense = Math.max(0, originalAmount - 3000);
    expect(overRefundDefense).toBe(0);
  });

  it("builds composable query parameters for ledger filters", () => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "25");
    params.set("search", "Noida Customer");
    params.set("status", "paid");
    params.set("refundStatus", "none");
    params.set("method", "cashfree");
    params.set("city", "Noida");
    params.set("startDate", "2026-11-01");
    params.set("endDate", "2026-11-14");

    const qs = params.toString();
    expect(qs).toContain("search=Noida+Customer");
    expect(qs).toContain("status=paid");
    expect(qs).toContain("refundStatus=none");
    expect(qs).toContain("method=cashfree");
    expect(qs).toContain("city=Noida");
    expect(qs).toContain("startDate=2026-11-01");
    expect(qs).toContain("endDate=2026-11-14");
  });

  it("correctly identifies refund status badges", () => {
    const getRefundBadgeType = (status: string, refundedAmount: number) => {
      if (status === "refunded") return { label: "Refunded", color: "purple" };
      if (status === "partial" || refundedAmount > 0) return { label: "Partially Refunded", color: "amber" };
      return { label: "None", color: "slate" };
    };

    expect(getRefundBadgeType("refunded", 1500).label).toBe("Refunded");
    expect(getRefundBadgeType("partial", 500).label).toBe("Partially Refunded");
    expect(getRefundBadgeType("none", 0).label).toBe("None");
  });
});
