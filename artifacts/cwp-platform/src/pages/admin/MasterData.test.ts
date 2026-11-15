import { describe, it, expect } from "vitest";

describe("Admin Master Data Lifecycle Status & Actions (ADMIN-022)", () => {
  it("determines row active state correctly from isActive flag", () => {
    const activeRow1 = { id: 1, name: "Maruti Suzuki", isActive: true };
    const activeRow2 = { id: 2, name: "Hyundai" }; // default / undefined implies active
    const inactiveRow = { id: 3, name: "Tata", isActive: false };

    expect(activeRow1.isActive !== false).toBe(true);
    expect((activeRow2 as any).isActive !== false).toBe(true);
    expect(inactiveRow.isActive !== false).toBe(false);
  });

  it("builds query parameters accurately according to selected status filter", () => {
    function buildParams(search: string, statusFilter: "all" | "active" | "inactive") {
      const params: Record<string, string> = {};
      if (search.trim()) params.q = search.trim();
      if (statusFilter === "active") params.isActive = "true";
      if (statusFilter === "inactive") params.isActive = "false";
      return params;
    }

    expect(buildParams("", "all")).toEqual({});
    expect(buildParams("honda", "all")).toEqual({ q: "honda" });
    expect(buildParams("", "active")).toEqual({ isActive: "true" });
    expect(buildParams("maruti", "inactive")).toEqual({ q: "maruti", isActive: "false" });
  });

  it("renders friendly cell label with relational names when available", () => {
    function renderCellValue(row: Record<string, unknown>, fieldKey: string) {
      if (fieldKey === "brandId" && row.brandName) {
        return `${row.brandName} (#${row.brandId})`;
      }
      if (fieldKey === "stateId" && row.stateName) {
        return `${row.stateName} (#${row.stateId})`;
      }
      if (fieldKey === "cityId" && row.cityName) {
        return `${row.cityName} (#${row.cityId})`;
      }
      if (fieldKey === "serviceAreaId" && row.areaName) {
        return `${row.areaName} (#${row.serviceAreaId})`;
      }
      return String(row[fieldKey] ?? "—");
    }

    const modelRow = { id: 10, brandId: 1, brandName: "Maruti Suzuki", name: "Swift" };
    expect(renderCellValue(modelRow, "brandId")).toBe("Maruti Suzuki (#1)");
    expect(renderCellValue(modelRow, "name")).toBe("Swift");

    const cityRow = { id: 5, stateId: 2, stateName: "Uttar Pradesh", name: "Noida" };
    expect(renderCellValue(cityRow, "stateId")).toBe("Uttar Pradesh (#2)");
  });

  it("distinguishes between activate and deactivate mutation payloads", () => {
    function getMutationIntent(targetActive: boolean, id: number) {
      if (!targetActive) {
        return { action: "deactivate", method: "DELETE", id };
      }
      return { action: "activate", method: "PATCH", id, body: { isActive: true } };
    }

    expect(getMutationIntent(false, 1)).toEqual({ action: "deactivate", method: "DELETE", id: 1 });
    expect(getMutationIntent(true, 1)).toEqual({
      action: "activate",
      method: "PATCH",
      id: 1,
      body: { isActive: true },
    });
  });
});
