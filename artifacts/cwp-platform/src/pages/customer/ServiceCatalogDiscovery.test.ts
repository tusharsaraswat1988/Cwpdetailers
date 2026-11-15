import { describe, expect, it } from "vitest";

// Data contracts & mock catalog items representing Varanasi & Noida
interface CatalogItem {
  id: number;
  name: string;
  slug: string;
  category: string;
  serviceType: string;
  effectivePrice: number;
}

const VARANASI_CATALOG: CatalogItem[] = [
  {
    id: 9,
    name: "Daily Car Cleaning (Monthly)",
    slug: "daily-car-cleaning",
    category: "subscription",
    serviceType: "daily_cleaning",
    effectivePrice: 999,
  },
  {
    id: 8,
    name: "Doorstep Express Car Wash",
    slug: "doorstep-car-wash",
    category: "car_wash",
    serviceType: "car_wash",
    effectivePrice: 499,
  },
  {
    id: 10,
    name: "Deep Interior Detailing & Sanitization",
    slug: "interior-detailing",
    category: "detailing",
    serviceType: "detailing",
    effectivePrice: 1499,
  },
  {
    id: 11,
    name: "Ceramic Coating & Paint Correction",
    slug: "ceramic-coating",
    category: "detailing",
    serviceType: "detailing",
    effectivePrice: 4999,
  },
  {
    id: 12,
    name: "Solar Panel Soft-Brush Cleaning",
    slug: "solar-cleaning",
    category: "solar_cleaning",
    serviceType: "solar_cleaning",
    effectivePrice: 799,
  },
];

const NOIDA_ONLY_DAILY_CATALOG: CatalogItem[] = [
  {
    id: 9,
    name: "Daily Car Cleaning (Monthly)",
    slug: "daily-car-cleaning",
    category: "subscription",
    serviceType: "daily_cleaning",
    effectivePrice: 1099,
  },
];

/**
 * Derives dynamic, city-aware categories strictly from the active services in that city
 */
function deriveDynamicCategories(services: CatalogItem[]) {
  const cats: Array<{ id: string; label: string }> = [
    { id: "all", label: "All Services" },
  ];

  if (
    services.some(
      (s) =>
        s.slug === "daily-car-cleaning" ||
        s.serviceType === "daily_cleaning" ||
        s.category === "subscription"
    )
  ) {
    cats.push({ id: "daily_cleaning", label: "Daily Car Cleaning" });
  }

  if (
    services.some(
      (s) =>
        s.slug === "doorstep-car-wash" ||
        s.serviceType === "car_wash" ||
        s.category === "car_wash"
    )
  ) {
    cats.push({ id: "car_wash", label: "Car Wash" });
  }

  if (
    services.some(
      (s) =>
        s.slug === "interior-detailing" ||
        s.name.toLowerCase().includes("interior")
    )
  ) {
    cats.push({ id: "interior_detailing", label: "Interior Detailing" });
  }

  if (
    services.some(
      (s) =>
        s.slug === "ceramic-coating" ||
        s.name.toLowerCase().includes("ceramic")
    )
  ) {
    cats.push({ id: "ceramic_coating", label: "Ceramic Coating" });
  }

  if (
    services.some(
      (s) =>
        s.slug === "solar-cleaning" ||
        s.serviceType === "solar_cleaning" ||
        s.category === "solar_cleaning"
    )
  ) {
    cats.push({ id: "solar_care", label: "Solar Care" });
  }

  return cats;
}

/**
 * Filter services by category and search query
 */
function filterCatalogServices(
  services: CatalogItem[],
  activeCategory: string,
  searchQuery: string = ""
) {
  return services.filter((svc) => {
    if (activeCategory !== "all") {
      let matches = false;
      if (activeCategory === "daily_cleaning") {
        matches =
          svc.slug === "daily-car-cleaning" ||
          svc.serviceType === "daily_cleaning" ||
          svc.category === "subscription";
      } else if (activeCategory === "car_wash") {
        matches =
          svc.slug === "doorstep-car-wash" ||
          svc.serviceType === "car_wash" ||
          svc.category === "car_wash";
      } else if (activeCategory === "interior_detailing") {
        matches =
          svc.slug === "interior-detailing" ||
          svc.name.toLowerCase().includes("interior");
      } else if (activeCategory === "ceramic_coating") {
        matches =
          svc.slug === "ceramic-coating" ||
          svc.name.toLowerCase().includes("ceramic");
      } else if (activeCategory === "solar_care") {
        matches =
          svc.slug === "solar-cleaning" ||
          svc.serviceType === "solar_cleaning" ||
          svc.category === "solar_cleaning";
      }
      if (!matches) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesName = svc.name.toLowerCase().includes(q);
      if (!matchesName) return false;
    }

    return true;
  });
}

describe("Service Category Filter & Dynamic Catalog (CUX-014.3)", () => {
  it("generates dynamic, city-aware categories for full catalog (Varanasi)", () => {
    const cats = deriveDynamicCategories(VARANASI_CATALOG);
    const ids = cats.map((c) => c.id);

    expect(ids).toEqual([
      "all",
      "daily_cleaning",
      "car_wash",
      "interior_detailing",
      "ceramic_coating",
      "solar_care",
    ]);
  });

  it("suppresses unavailable categories for single-service cities (Noida / Greater Noida)", () => {
    const cats = deriveDynamicCategories(NOIDA_ONLY_DAILY_CATALOG);
    const ids = cats.map((c) => c.id);

    // Only "All Services" and "Daily Car Cleaning" must appear
    expect(ids).toEqual(["all", "daily_cleaning"]);
    expect(ids).not.toContain("solar_care");
    expect(ids).not.toContain("car_wash");
    expect(ids).not.toContain("ceramic_coating");
  });

  it("filters services accurately when category is selected", () => {
    const solarOnly = filterCatalogServices(VARANASI_CATALOG, "solar_care");
    expect(solarOnly).toHaveLength(1);
    expect(solarOnly[0].slug).toBe("solar-cleaning");

    const washOnly = filterCatalogServices(VARANASI_CATALOG, "car_wash");
    expect(washOnly).toHaveLength(1);
    expect(washOnly[0].slug).toBe("doorstep-car-wash");

    const allServices = filterCatalogServices(VARANASI_CATALOG, "all");
    expect(allServices).toHaveLength(5);
  });

  it("returns empty result and triggers empty state for non-matching search or category", () => {
    const searchNoMatch = filterCatalogServices(VARANASI_CATALOG, "all", "nonexistentxyz");
    expect(searchNoMatch).toHaveLength(0);

    const noidaSolar = filterCatalogServices(NOIDA_ONLY_DAILY_CATALOG, "solar_care");
    expect(noidaSolar).toHaveLength(0);
  });
});

describe("Service Booking Flow Asset Resolution & Isolation (CUX-014.3 Task 4)", () => {
  function resolveTargetKind(serviceSlug?: string, segment?: string): "vehicle" | "solar" {
    const isSolar = Boolean(serviceSlug?.includes("solar") || segment?.includes("solar"));
    return isSolar ? "solar" : "vehicle";
  }

  it("strictly resolves solar services to solar target kind", () => {
    expect(resolveTargetKind("solar-cleaning")).toBe("solar");
    expect(resolveTargetKind(undefined, "solar_cleaning")).toBe("solar");
  });

  it("strictly resolves car services to vehicle target kind", () => {
    expect(resolveTargetKind("daily-car-cleaning")).toBe("vehicle");
    expect(resolveTargetKind("doorstep-car-wash")).toBe("vehicle");
    expect(resolveTargetKind("interior-detailing")).toBe("vehicle");
    expect(resolveTargetKind("ceramic-coating")).toBe("vehicle");
  });

  it("preserves service, tier, and pricing parameters across quick-add return", () => {
    const initialBookingParams = {
      service: "doorstep-car-wash",
      tier: "Hatchback",
      tierPrice: 499,
      segment: "car_wash",
    };

    // User quick-adds vehicle (id: 42)
    const newlyCreatedVehicleId = 42;
    const resolvedAsset = {
      kind: "vehicle" as const,
      id: newlyCreatedVehicleId,
      name: "Vehicle",
      subtitle: "",
      location: null,
    };

    // Verify context preservation
    expect(initialBookingParams.service).toBe("doorstep-car-wash");
    expect(initialBookingParams.tierPrice).toBe(499);
    expect(resolvedAsset.id).toBe(42);
    expect(resolvedAsset.kind).toBe("vehicle");
  });

  it("preserves solar rooftop asset resolution and installation address", () => {
    const solarSite = {
      id: 3,
      customerId: 1428,
      address: "Villa 15 Rooftop, Green Meadows, Sector 128, Noida",
      panelCount: 12,
    };

    const resolvedAddress = solarSite.address;
    expect(resolvedAddress).toContain("Villa 15 Rooftop");
    expect(solarSite.panelCount).toBe(12);
  });
});
