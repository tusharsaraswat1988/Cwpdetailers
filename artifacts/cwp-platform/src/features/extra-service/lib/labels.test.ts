import { describe, expect, it } from "vitest";
import {
  extraServiceApproveLabel,
  extraServiceConsumptionOn,
  extraServiceStaffHeadline,
} from "./labels";

describe("extra service staff headlines", () => {
  it("keeps DCC cleaning language out of the extra-wash states", () => {
    expect(extraServiceStaffHeadline("pending_customer_approval")).toBe("Waiting for customer approval");
    expect(extraServiceStaffHeadline("customer_approved")).toBe("Customer approved — enter OTP");
    expect(extraServiceStaffHeadline("otp_verified")).toBe("Service added");
  });
});

describe("customer approve CTA", () => {
  it("shows included wash vs paid amount", () => {
    expect(extraServiceApproveLabel(0, "DCC_INCLUDED")).toBe("Approve included wash");
    expect(extraServiceApproveLabel(650, "PAID_EXTRA")).toBe("Approve ₹650");
  });
});

describe("consumption", () => {
  it("does not consume on OTP verify — only on completion", () => {
    expect(extraServiceConsumptionOn("otp_verify")).toBe("none");
    expect(extraServiceConsumptionOn("completion")).toBe("entitlement");
  });
});
