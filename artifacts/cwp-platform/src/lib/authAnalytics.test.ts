import { describe, it, expect } from "vitest";
import { trackAuthEvent, onAuthEvent } from "./authAnalytics";

describe("authAnalytics", () => {
  it("notifies subscribers without throwing", () => {
    const events: string[] = [];
    const unsub = onAuthEvent(e => events.push(e));
    trackAuthEvent("otp_sent", { method: "otp", portal: "customer" });
    unsub();
    expect(events).toContain("otp_sent");
  });
});
