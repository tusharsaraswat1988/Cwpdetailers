import { describe, expect, it } from "vitest";
import { sizeClasses, type EntityDrawerSize } from "./EntityDrawer";

describe("EntityDrawer Responsive Configuration (P0-A)", () => {
  it("preserves sm:max-w-lg for default and md sizes to guarantee backward compatibility", () => {
    expect(sizeClasses.default).toBe("sm:max-w-lg");
    expect(sizeClasses.md).toBe("sm:max-w-lg");
  });

  it("provides widened breakpoint limits for lg size to accommodate complex multi-task assignment workflows", () => {
    expect(sizeClasses.lg).toBe("sm:max-w-xl md:max-w-2xl");
  });

  it("provides maximum width for xl size", () => {
    expect(sizeClasses.xl).toBe("sm:max-w-2xl md:max-w-3xl");
  });

  it("ensures all defined size keys map to non-empty tailwind responsive width strings", () => {
    const keys: EntityDrawerSize[] = ["default", "md", "lg", "xl"];
    for (const key of keys) {
      expect(typeof sizeClasses[key]).toBe("string");
      expect(sizeClasses[key].length).toBeGreaterThan(0);
      expect(sizeClasses[key]).toContain("sm:max-w-");
    }
  });
});
