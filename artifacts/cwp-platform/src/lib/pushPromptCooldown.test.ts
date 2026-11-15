import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COOLDOWN_DAYS_MS,
  PUSH_PROMPT_COOLDOWN_KEY,
  clearPromptCooldown,
  isPromptInCooldown,
  setPromptCooldown,
} from "./pushNotifications";

describe("Push Notification Prompt Cooldown Logic (CUX-014.2.1)", () => {
  let mockStore: Record<string, string> = {};

  beforeEach(() => {
    mockStore = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStore[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    });
    vi.restoreAllMocks();
  });

  it("returns false when no prompt cooldown is set", () => {
    expect(isPromptInCooldown()).toBe(false);
  });

  it("sets prompt cooldown timestamp and returns true immediately", () => {
    const now = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    setPromptCooldown();
    expect(localStorage.getItem(PUSH_PROMPT_COOLDOWN_KEY)).toBe(now.toString());
    expect(isPromptInCooldown()).toBe(true);
  });

  it("returns true while within the 7-day cooldown period", () => {
    const baseTime = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(baseTime);
    setPromptCooldown();

    // Advance 6 days (within 7 days)
    const sixDaysLater = baseTime + 6 * 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(sixDaysLater);

    expect(isPromptInCooldown()).toBe(true);
  });

  it("returns false after the 7-day cooldown period has elapsed", () => {
    const baseTime = 1700000000000;
    vi.spyOn(Date, "now").mockReturnValue(baseTime);
    setPromptCooldown();

    // Advance 7 days + 1 minute
    const pastCooldown = baseTime + COOLDOWN_DAYS_MS + 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(pastCooldown);

    expect(isPromptInCooldown()).toBe(false);
  });

  it("clears prompt cooldown on user explicit enablement", () => {
    setPromptCooldown();
    expect(isPromptInCooldown()).toBe(true);

    clearPromptCooldown();
    expect(isPromptInCooldown()).toBe(false);
    expect(localStorage.getItem(PUSH_PROMPT_COOLDOWN_KEY)).toBeNull();
  });

  it("preserves cooldown timestamp across simulated portal logout/session clearance", () => {
    setPromptCooldown();
    const stored = localStorage.getItem(PUSH_PROMPT_COOLDOWN_KEY);

    // Simulate session clearance (only removes tokens/user keys)
    localStorage.removeItem("cwp:auth:token:customer");
    localStorage.removeItem("cwp:auth:user:customer");

    // Push prompt cooldown must NOT be wiped
    expect(localStorage.getItem(PUSH_PROMPT_COOLDOWN_KEY)).toBe(stored);
    expect(isPromptInCooldown()).toBe(true);
  });
});
