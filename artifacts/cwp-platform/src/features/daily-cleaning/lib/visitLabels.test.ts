import { describe, expect, it } from "vitest";
import {
  adminVisitLabel,
  customerVisitHeadline,
  CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE,
  CUSTOMER_HEADLINE_COMPLETED,
} from "./visitLabels";

describe("customer DCC visit copy", () => {
  it("distinguishes completed from car not available", () => {
    expect(customerVisitHeadline("completed", "cleaning")).toBe(CUSTOMER_HEADLINE_COMPLETED);
    expect(customerVisitHeadline("car_not_available")).toBe(CUSTOMER_HEADLINE_CAR_NOT_AVAILABLE);
  });
});

describe("admin DCC visit labels", () => {
  it("does not collapse car not available into missed", () => {
    expect(adminVisitLabel("car_not_available")).toBe("Car Not Available");
    expect(adminVisitLabel("missed")).toBe("Missed");
    expect(adminVisitLabel("completed")).toBe("Completed");
    expect(adminVisitLabel("pending")).toBe("Pending");
  });
});
