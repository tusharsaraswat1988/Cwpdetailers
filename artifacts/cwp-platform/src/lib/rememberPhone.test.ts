import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadRememberedPhone,
  saveRememberedPhone,
  clearRememberedPhone,
  hasRememberedPhone,
} from "./rememberPhone";

describe("rememberPhone", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] ?? null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value;
      },
      removeItem(key: string) {
        delete this.store[key];
      },
    });
    clearRememberedPhone();
  });

  it("stores phone with timestamp", () => {
    saveRememberedPhone("9876543210");
    const raw = localStorage.getItem("cwp_remember_phone");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.phone).toBe("9876543210");
    expect(parsed.savedAt).toBeTypeOf("number");
  });

  it("loads saved phone", () => {
    saveRememberedPhone("9876543210");
    expect(loadRememberedPhone()).toBe("9876543210");
    expect(hasRememberedPhone()).toBe(true);
  });

  it("clears remembered phone", () => {
    saveRememberedPhone("9876543210");
    clearRememberedPhone();
    expect(loadRememberedPhone()).toBe("");
    expect(hasRememberedPhone()).toBe(false);
  });
});
