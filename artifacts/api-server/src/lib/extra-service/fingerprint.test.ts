import { describe, expect, it } from "vitest";
import {
  extraServiceFingerprint,
  extraServiceOtpBindingHash,
  isOtpExpired,
  normalizeAddonIds,
  normalizeAmount,
} from "./fingerprint";

describe("extra service request fingerprint", () => {
  const base = {
    customerId: 10,
    staffId: 3,
    vehicleId: 44,
    serviceId: 7,
    addonIds: [2, 9],
    amount: "650.00",
    commercialSource: "PAID_EXTRA" as const,
    dcmsSubscriptionId: null,
  };

  it("is stable when addon order and amount formatting change", () => {
    const a = extraServiceFingerprint(base);
    const b = extraServiceFingerprint({
      ...base,
      addonIds: [9, 2, 2],
      amount: 650,
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("changes when vehicle, service, addons, amount, or source changes", () => {
    const original = extraServiceFingerprint(base);
    expect(extraServiceFingerprint({ ...base, vehicleId: 45 })).not.toBe(original);
    expect(extraServiceFingerprint({ ...base, serviceId: 8 })).not.toBe(original);
    expect(extraServiceFingerprint({ ...base, addonIds: [2] })).not.toBe(original);
    expect(extraServiceFingerprint({ ...base, amount: "500.00" })).not.toBe(original);
    expect(extraServiceFingerprint({
      ...base,
      commercialSource: "DCC_INCLUDED",
      amount: "0.00",
      dcmsSubscriptionId: 1,
    })).not.toBe(original);
  });

  it("binds OTP to the exact request id and fingerprint", () => {
    const fp = extraServiceFingerprint(base);
    const hash = extraServiceOtpBindingHash("4827", 91, fp);
    expect(hash).not.toBe(extraServiceOtpBindingHash("4827", 92, fp));
    expect(hash).not.toBe(extraServiceOtpBindingHash("4827", 91, extraServiceFingerprint({ ...base, amount: "0.00" })));
    expect(hash).not.toBe(extraServiceOtpBindingHash("4828", 91, fp));
    expect(hash).toHaveLength(64);
  });
});

describe("normalize helpers", () => {
  it("sorts and dedupes addon ids", () => {
    expect(normalizeAddonIds([3, 1, 3, 0, -2])).toEqual([1, 3]);
  });

  it("normalizes amount to two decimals", () => {
    expect(normalizeAmount(650)).toBe("650.00");
    expect(normalizeAmount("0")).toBe("0.00");
  });

  it("treats missing OTP expiry as expired", () => {
    expect(isOtpExpired(null)).toBe(true);
    expect(isOtpExpired(new Date(Date.now() + 60_000), new Date())).toBe(false);
    expect(isOtpExpired(new Date(Date.now() - 1000), new Date())).toBe(true);
  });
});
