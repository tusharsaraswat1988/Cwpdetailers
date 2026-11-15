import { describe, it, expect, vi } from "vitest";

describe("SearchableCombobox logic & filtering architecture", () => {
  const sampleItems = [
    { value: "1", label: "Noida", sublabel: "Uttar Pradesh" },
    { value: "2", label: "Varanasi", sublabel: "Uttar Pradesh" },
    { value: "3", label: "Greater Noida", sublabel: "NCR" },
    { value: "4", label: "Ghaziabad", sublabel: "NCR" },
    { value: "5", label: "Gurgaon", sublabel: "Haryana" },
  ];

  it("filters items by partial match case-insensitively on label", () => {
    const filter = (query: string, items = sampleItems) => {
      const q = query.trim().toLowerCase();
      if (!q) return items;
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
          item.value.toLowerCase().includes(q)
      );
    };

    expect(filter("noi")).toEqual([
      { value: "1", label: "Noida", sublabel: "Uttar Pradesh" },
      { value: "3", label: "Greater Noida", sublabel: "NCR" },
    ]);

    expect(filter("VARANASI")).toEqual([
      { value: "2", label: "Varanasi", sublabel: "Uttar Pradesh" },
    ]);
  });

  it("filters items by sublabel (e.g. state or region)", () => {
    const filter = (query: string, items = sampleItems) => {
      const q = query.trim().toLowerCase();
      if (!q) return items;
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
          item.value.toLowerCase().includes(q)
      );
    };

    expect(filter("NCR")).toEqual([
      { value: "3", label: "Greater Noida", sublabel: "NCR" },
      { value: "4", label: "Ghaziabad", sublabel: "NCR" },
    ]);

    expect(filter("Haryana")).toEqual([
      { value: "5", label: "Gurgaon", sublabel: "Haryana" },
    ]);
  });

  it("includes allOptionLabel when provided", () => {
    const compileItems = (allLabel?: string, items = sampleItems) => {
      const list = [];
      if (allLabel) {
        list.push({ value: "all", label: allLabel });
      }
      return [...list, ...items];
    };

    const withAll = compileItems("All Cities");
    expect(withAll[0]).toEqual({ value: "all", label: "All Cities" });
    expect(withAll.length).toBe(sampleItems.length + 1);
  });

  it("returns empty array when search query matches no items", () => {
    const filter = (query: string, items = sampleItems) => {
      const q = query.trim().toLowerCase();
      if (!q) return items;
      return items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          (item.sublabel && item.sublabel.toLowerCase().includes(q)) ||
          item.value.toLowerCase().includes(q)
      );
    };

    expect(filter("NonExistentCity")).toHaveLength(0);
  });
});
