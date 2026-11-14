import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashString,
  resolveVariantForSession,
} from "../../lib/ux/uxExperimentService";
import {
  FUNNEL_MILESTONES,
  logFunnelEvent,
  getBookingFunnelAnalytics,
} from "../../lib/marketing/bookingFunnelAnalyticsService";
import type { UxExperiment } from "@workspace/db";

describe("Phase 23: UX Experimentation & Deterministic Variant Hashing", () => {
  it("hashString produces deterministic 32-bit positive integers", () => {
    const h1 = hashString("homepage_primary_cta:variant:session_123");
    const h2 = hashString("homepage_primary_cta:variant:session_123");
    const h3 = hashString("homepage_primary_cta:variant:session_456");

    expect(h1).toBe(h2);
    expect(h1).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(h1)).toBe(true);
    expect(h1).not.toBe(h3);
  });

  it("resolveVariantForSession assigns control when traffic allocation is 0%", () => {
    const experiment: Partial<UxExperiment> = {
      key: "test_cta",
      trafficAllocation: 0,
      variants: [
        { id: "control", name: "Control", weight: 50, config: {} },
        { id: "variant_b", name: "Variant B", weight: 50, config: {} },
      ],
    };

    const res = resolveVariantForSession(experiment as UxExperiment, "sess_abc");
    expect(res.variantId).toBe("control");
    expect(res.inExperiment).toBe(false);
  });

  it("resolveVariantForSession deterministically assigns consistent variant for same session", () => {
    const experiment: Partial<UxExperiment> = {
      key: "homepage_primary_cta",
      trafficAllocation: 100,
      variants: [
        { id: "control", name: "Control", weight: 50, config: { text: "Book Now" } },
        { id: "variant_b", name: "Variant B", weight: 50, config: { text: "Claim Offer" } },
      ],
    };

    const run1 = resolveVariantForSession(experiment as UxExperiment, "customer_sess_42");
    const run2 = resolveVariantForSession(experiment as UxExperiment, "customer_sess_42");
    const run3 = resolveVariantForSession(experiment as UxExperiment, "customer_sess_42");

    expect(run1.variantId).toBe(run2.variantId);
    expect(run2.variantId).toBe(run3.variantId);
    expect(["control", "variant_b"]).toContain(run1.variantId);
    expect(run1.inExperiment).toBe(true);
  });

  it("resolveVariantForSession distributes sessions across both variants according to weights", () => {
    const experiment: Partial<UxExperiment> = {
      key: "service_card_layout",
      trafficAllocation: 100,
      variants: [
        { id: "control", name: "Control", weight: 50, config: {} },
        { id: "variant_b", name: "Variant B", weight: 50, config: {} },
      ],
    };

    const counts: Record<string, number> = { control: 0, variant_b: 0 };
    for (let i = 0; i < 200; i++) {
      const res = resolveVariantForSession(experiment as UxExperiment, `session_${i}`);
      counts[res.variantId]++;
    }

    expect(counts.control).toBeGreaterThan(60);
    expect(counts.variant_b).toBeGreaterThan(60);
  });
});

describe("Phase 23: Booking Conversion Funnel Analytics", () => {
  it("FUNNEL_MILESTONES contains all 13 core customer journey milestones", () => {
    expect(FUNNEL_MILESTONES).toContain("service_viewed");
    expect(FUNNEL_MILESTONES).toContain("service_selected");
    expect(FUNNEL_MILESTONES).toContain("vehicle_selected");
    expect(FUNNEL_MILESTONES).toContain("address_selected");
    expect(FUNNEL_MILESTONES).toContain("slot_selected");
    expect(FUNNEL_MILESTONES).toContain("checkout_started");
    expect(FUNNEL_MILESTONES).toContain("coupon_applied");
    expect(FUNNEL_MILESTONES).toContain("loyalty_redeemed");
    expect(FUNNEL_MILESTONES).toContain("payment_initiated");
    expect(FUNNEL_MILESTONES).toContain("payment_failed");
    expect(FUNNEL_MILESTONES).toContain("payment_completed");
    expect(FUNNEL_MILESTONES).toContain("booking_confirmed");
    expect(FUNNEL_MILESTONES).toContain("booking_cancelled");
    expect(FUNNEL_MILESTONES.length).toBe(13);
  });
});
