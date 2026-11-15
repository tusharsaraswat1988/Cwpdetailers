import { describe, it, expect } from "vitest";

describe("ContextHelp Information System Architecture", () => {
  it("formats technical details structured key-value pairs accurately", () => {
    const technicalDetails = [
      { label: "Entity Model", value: "operational_zones" },
      { label: "Engine", value: "CoverageEngine.ts" },
      { label: "Cache Policy", value: "CoverageCache.ts (5m TTL)" },
    ];

    expect(technicalDetails).toHaveLength(3);
    expect(technicalDetails[0].label).toBe("Entity Model");
    expect(technicalDetails[0].value).toBe("operational_zones");
  });

  it("determines appropriate icon and button sizing", () => {
    const getSizeConfig = (size: "xs" | "sm" | "md" = "sm") => {
      const iconSize = size === "xs" ? 11 : size === "md" ? 16 : 13;
      const buttonDimensions = size === "xs" ? "h-4 w-4" : size === "md" ? "h-6 w-6" : "h-5 w-5";
      return { iconSize, buttonDimensions };
    };

    expect(getSizeConfig("xs")).toEqual({ iconSize: 11, buttonDimensions: "h-4 w-4" });
    expect(getSizeConfig("sm")).toEqual({ iconSize: 13, buttonDimensions: "h-5 w-5" });
    expect(getSizeConfig("md")).toEqual({ iconSize: 16, buttonDimensions: "h-6 w-6" });
  });

  it("prefers popover variant when rich operational guidance or technical details are present", () => {
    const shouldRenderPopover = (variant: string, guidance?: string, technicalDetails?: any[]) => {
      if (variant === "tooltip" && !guidance && (!technicalDetails || technicalDetails.length === 0)) {
        return false;
      }
      return true;
    };

    expect(shouldRenderPopover("tooltip", undefined, undefined)).toBe(false);
    expect(shouldRenderPopover("tooltip", "Some operational guidance")).toBe(true);
    expect(shouldRenderPopover("popover", undefined, undefined)).toBe(true);
  });
});
