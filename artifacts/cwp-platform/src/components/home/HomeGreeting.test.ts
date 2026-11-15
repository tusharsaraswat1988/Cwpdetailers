import { describe, it, expect } from "vitest";

describe("HomeGreeting & Name Formatting (CUX-014.2 / Task 1)", () => {
  function formatCustomerName(rawName?: string | null): string | null {
    if (!rawName) return null;
    const trimmed = rawName.trim();
    if (
      !trimmed ||
      trimmed.toLowerCase() === "there" ||
      trimmed.toLowerCase() === "undefined" ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "customer"
    ) {
      return null;
    }
    const firstWord = trimmed.split(/\s+/)[0];
    if (
      !firstWord ||
      firstWord.toLowerCase() === "there" ||
      firstWord.toLowerCase() === "undefined" ||
      firstWord.toLowerCase() === "null" ||
      firstWord.toLowerCase() === "customer"
    ) {
      return null;
    }
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  }

  function getGreeting(hour: number): string {
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function renderGreeting(customerName?: string | null, hour: number = 14): string {
    const greeting = getGreeting(hour);
    const displayName = formatCustomerName(customerName);
    return displayName ? `${greeting}, ${displayName}` : greeting;
  }

  it("handles standard customer names on a single greeting line with comma", () => {
    expect(renderGreeting("Tushar")).toBe("Good afternoon, Tushar");
    expect(renderGreeting("Arjun Sharma")).toBe("Good afternoon, Arjun");
    expect(renderGreeting("sunita")).toBe("Good afternoon, Sunita");
  });

  it("gracefully displays only greeting without comma when name is missing or empty", () => {
    expect(renderGreeting(undefined)).toBe("Good afternoon");
    expect(renderGreeting(null)).toBe("Good afternoon");
    expect(renderGreeting("")).toBe("Good afternoon");
    expect(renderGreeting("   ")).toBe("Good afternoon");
  });

  it("strictly suppresses literal fallback strings like 'there', 'undefined', 'null'", () => {
    expect(renderGreeting("there")).toBe("Good afternoon");
    expect(renderGreeting("THERE")).toBe("Good afternoon");
    expect(renderGreeting("undefined")).toBe("Good afternoon");
    expect(renderGreeting("null")).toBe("Good afternoon");
    expect(renderGreeting("there ")).toBe("Good afternoon");
  });

  it("correctly resolves time-based greetings across morning, afternoon and evening", () => {
    expect(renderGreeting("Arjun", 9)).toBe("Good morning, Arjun");
    expect(renderGreeting("Arjun", 14)).toBe("Good afternoon, Arjun");
    expect(renderGreeting("Arjun", 19)).toBe("Good evening, Arjun");
    expect(renderGreeting(undefined, 9)).toBe("Good morning");
    expect(renderGreeting(undefined, 19)).toBe("Good evening");
  });

  it("ensures zero line breaks or secondary name rows", () => {
    const greeting = renderGreeting("Tushar Saraswat", 14);
    expect(greeting).not.toContain("\n");
    expect(greeting).not.toContain("\r");
    expect(greeting).toBe("Good afternoon, Tushar");
  });
});
