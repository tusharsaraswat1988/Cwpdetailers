import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  locationResolver,
  isPointInPolygon,
  isPointInGeoJson,
} from "../../lib/location-intelligence/resolver/LocationResolver";
import { serviceabilityEngine } from "../../lib/location-intelligence/serviceability/ServiceabilityEngine";
import { locationPricingEngine } from "../../lib/location-intelligence/pricing/LocationPricingEngine";
import { computeScope } from "../../middlewares/auth";

// Setup fixture data
const mockData = {
  cities: [
    { id: 1, name: "Varanasi", slug: "varanasi", state: "Uttar Pradesh", status: "active", isActive: true },
    { id: 2, name: "Noida", slug: "noida", state: "Uttar Pradesh", status: "active", isActive: true },
    { id: 3, name: "Kanpur", slug: "kanpur", state: "Uttar Pradesh", status: "inactive", isActive: false },
  ],
  branches: [
    { id: 10, cityId: 1, name: "Varanasi Main Branch", code: "VNS-MAIN", status: "active", isActive: true },
    { id: 20, cityId: 2, name: "Noida Sector 50 Branch", code: "NOIDA-SEC50", status: "active", isActive: true },
  ],
  zones: [
    {
      id: 100,
      cityId: 2,
      branchId: 20,
      name: "Noida Expressway Zone",
      code: "NOIDA-EXP",
      centerLatitude: "28.5355",
      centerLongitude: "77.3910",
      radiusMeters: 10000,
      status: "active",
      isActive: true,
    },
  ],
  societies: [
    {
      id: 201,
      cityId: 2,
      branchId: 20,
      name: "Jaypee Greens Wish Town",
      slug: "jaypee-greens-wish-town",
      googlePlaceId: "ChIJ_fake_jaypee_place_id",
      latitude: "28.5200",
      longitude: "77.3700",
      status: "active",
      isActive: true,
      serviceAvailability: ["car_cleaning", "detailing"],
    },
    {
      id: 202,
      cityId: 2,
      branchId: 20,
      name: "Supertech Capetown",
      slug: "supertech-capetown",
      googlePlaceId: "ChIJ_fake_supertech_id",
      latitude: "28.5600",
      longitude: "77.4100",
      status: "active",
      isActive: true,
      serviceAvailability: ["car_cleaning"],
    },
  ],
  localities: [
    {
      id: 301,
      cityId: 2,
      name: "Sector 128",
      slug: "sector-128",
      code: "SEC-128",
      pincode: "201304",
      latitude: "28.5250",
      longitude: "77.3750",
    },
  ],
  zoneCoverageRules: [
    {
      id: 501,
      zoneId: 100,
      branchId: 20,
      coverageType: "society",
      societyId: 201,
      localityId: null,
      pincode: null,
      propertyType: "ALL",
      serviceId: null,
      status: "serviceable",
      rejectionReason: null,
      priority: 100,
      isActive: true,
    },
    {
      id: 502,
      zoneId: 100,
      branchId: 20,
      coverageType: "society",
      societyId: 202,
      localityId: null,
      pincode: null,
      propertyType: "ALL",
      serviceId: null,
      status: "waitlist",
      rejectionReason: "Daily cleaning operations starting next month. Join waitlist!",
      priority: 90,
      isActive: true,
    },
    {
      id: 503,
      zoneId: 100,
      branchId: 20,
      coverageType: "property_type",
      societyId: null,
      localityId: null,
      pincode: null,
      propertyType: "INDIVIDUAL_HOME",
      serviceId: null,
      status: "serviceable",
      rejectionReason: null,
      priority: 50,
      isActive: true,
    },
  ],
  locationPricingRules: [
    // Rule 1: Explicit Society Override for Jaypee Greens (₹1,200/mo)
    {
      id: 601,
      serviceId: 1,
      packageId: null,
      cityId: 2,
      branchId: 20,
      zoneId: 100,
      societyId: 201,
      locationType: "GATED_SOCIETY",
      vehicleCategoryId: null,
      basePrice: "1200.00",
      gstRate: "18.00",
      pricingType: "FLAT",
      effectiveFrom: "2026-01-01",
      effectiveUntil: null,
      status: "active",
      isActive: true,
      priority: 95,
      notes: "Society cluster pricing",
      createdAt: new Date("2026-01-01"),
    },
    // Rule 2: Zone + Location Type for Individual Home (₹1,500/mo)
    {
      id: 602,
      serviceId: 1,
      packageId: null,
      cityId: 2,
      branchId: 20,
      zoneId: 100,
      societyId: null,
      locationType: "INDIVIDUAL_HOME",
      vehicleCategoryId: null,
      basePrice: "1500.00",
      gstRate: "18.00",
      pricingType: "FLAT",
      effectiveFrom: "2026-01-01",
      effectiveUntil: null,
      status: "active",
      isActive: true,
      priority: 80,
      notes: "Individual doorstep travel surcharge pricing",
      createdAt: new Date("2026-01-01"),
    },
    // Rule 3: City Default Pricing (₹1,350/mo)
    {
      id: 603,
      serviceId: 1,
      packageId: null,
      cityId: 2,
      branchId: null,
      zoneId: null,
      societyId: null,
      locationType: "ALL",
      vehicleCategoryId: null,
      basePrice: "1350.00",
      gstRate: "18.00",
      pricingType: "FLAT",
      effectiveFrom: "2026-01-01",
      effectiveUntil: null,
      status: "active",
      isActive: true,
      priority: 10,
      notes: "Noida city default fallback",
      createdAt: new Date("2026-01-01"),
    },
  ],
  activeCityId: 2,
  activeZoneId: 100,
  activeSocietyId: 201 as number | null,
  multipleSocietiesMatch: false,
};

// Mock Drizzle db for test suite
vi.mock("@workspace/db", () => {
  const queryResult = (items: any[]) => {
    const promise = Promise.resolve(items);
    return Object.assign(promise, {
      orderBy: vi.fn(() => promise),
      limit: vi.fn((lim: number) => Promise.resolve(items.slice(0, lim))),
    });
  };

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          innerJoin: vi.fn(() => ({
            where: vi.fn(() => queryResult([])),
          })),
          where: vi.fn((clause: any) => {
            if (table && table._name === "cities") {
              const c = mockData.cities.find(x => x.id === mockData.activeCityId);
              return queryResult(c ? [c] : []);
            }
            if (table && table._name === "branches") {
              return queryResult(mockData.branches);
            }
            if (table && table._name === "operational_zones") {
              const z = mockData.zones.find(x => x.id === mockData.activeZoneId);
              return queryResult(z ? [z] : []);
            }
            if (table && table._name === "residential_societies") {
              if (mockData.multipleSocietiesMatch) {
                return queryResult([mockData.societies[0], mockData.societies[1]]);
              }
              const s = mockData.societies.find(x => x.id === mockData.activeSocietyId);
              return queryResult(s ? [s] : []);
            }
            if (table && table._name === "zone_coverage_rules") {
              return queryResult(mockData.zoneCoverageRules);
            }
            if (table && table._name === "location_pricing_rules") {
              return queryResult(mockData.locationPricingRules);
            }
            if (table && table._name === "operational_closures") {
              return queryResult([]);
            }
            return queryResult([]);
          }),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((vals: any) => ({
          returning: vi.fn(() => Promise.resolve([{ id: 999, ...vals }])),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(() => Promise.resolve([{ id: 999 }])),
          })),
        })),
      })),
    },
    citiesTable: { id: "id", name: "name", slug: "slug", _name: "cities" },
    branchesTable: { id: "id", name: "name", cityId: "city_id", _name: "branches" },
    operationalZonesTable: { id: "id", cityId: "city_id", branchId: "branch_id", _name: "operational_zones" },
    residentialSocietiesTable: { id: "id", name: "name", cityId: "city_id", _name: "residential_societies" },
    geographicLocalitiesTable: { id: "id", cityId: "city_id", _name: "geographic_localities" },
    locationAliasesTable: { id: "id", entityType: "entity_type", _name: "location_aliases" },
    zoneCoverageRulesTable: { id: "id", zoneId: "zone_id", priority: "priority", _name: "zone_coverage_rules" },
    locationPricingRulesTable: { id: "id", serviceId: "service_id", cityId: "city_id", priority: "priority", createdAt: "createdAt", _name: "location_pricing_rules" },
    pricingRuleAuditTable: { id: "id", ruleId: "rule_id", _name: "pricing_rule_audit_logs" },
    operationalClosuresTable: { id: "id", _name: "operational_closures" },
    serviceCityAvailabilityTable: { id: "id", _name: "service_city_availability" },
    serviceAvailabilityMatrixTable: { id: "id", _name: "service_availability_matrix" },
    servicesTable: { id: "id", _name: "services" },
    addressesTable: { id: "id", _name: "addresses" },
    savedLocationsTable: { id: "id", _name: "saved_locations" },
    branchZoneMappingsTable: { id: "id", _name: "branch_zone_mappings" },
    sessionsTable: { id: "id", _name: "sessions" },
    usersTable: { id: "id", _name: "users" },
    franchiseesTable: { id: "id", _name: "franchisees" },
  };
});

describe("Location, Serviceability, & Location-Based Differential Pricing Framework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData.activeCityId = 2;
    mockData.activeZoneId = 100;
    mockData.activeSocietyId = 201;
    mockData.multipleSocietiesMatch = false;
  });

  describe("1. Location Resolution Pipeline", () => {
    it("normalizes location queries and handles empty/whitespace inputs deterministically", async () => {
      const result = await locationResolver.resolve({
        city: "   ",
        locality: "",
        societyName: "   ",
      });

      expect(result.status).toBe("UNRESOLVED");
      expect(result.confidence).toBe(0);
      expect(result.cityId).toBeNull();
    });

    it("identifies ambiguous input when multiple candidate societies match", async () => {
      mockData.multipleSocietiesMatch = true;

      const result = await locationResolver.resolve({
        city: "Noida",
        societyName: "Wish Town Society",
      });

      expect(result.status).toBe("AMBIGUOUS");
      expect(result.candidates).toBeDefined();
      expect(result.candidates?.length).toBe(2);
    });
  });

  describe("2. Serviceability Engine & Fail-Closed Guardrails", () => {
    it("fails closed when city is inactive or not found", async () => {
      mockData.activeCityId = 3; // Inactive Kanpur

      const evaluation = await serviceabilityEngine.evaluate({
        cityId: 3,
        propertyType: "INDIVIDUAL_HOME",
      });

      expect(evaluation.isServiceable).toBe(false);
      expect(evaluation.status).toBe("NOT_SERVICEABLE");
    });

    it("evaluates explicit society coverage rule with serviceable status", async () => {
      mockData.activeCityId = 2;
      mockData.activeSocietyId = 201;

      const evaluation = await serviceabilityEngine.evaluate({
        cityId: 2,
        zoneId: 100,
        societyId: 201, // Jaypee Greens
        propertyType: "GATED_SOCIETY",
      });

      expect(evaluation.isServiceable).toBe(true);
      expect(evaluation.status).toBe("SERVICEABLE");
      expect(evaluation.matchedRuleId).toBe(501);
    });

    it("returns waitlist status with customer-facing reason for waitlisted society", async () => {
      mockData.activeCityId = 2;
      mockData.activeSocietyId = 202;

      const evaluation = await serviceabilityEngine.evaluate({
        cityId: 2,
        zoneId: 100,
        societyId: 202, // Supertech Capetown (waitlisted)
        propertyType: "GATED_SOCIETY",
      });

      expect(evaluation.isServiceable).toBe(false);
      expect(evaluation.status).toBe("WAITLIST");
      expect(evaluation.rejectionReason).toContain("Daily cleaning operations starting next month");
    });

    it("matches property type coverage for individual residential homes inside an active zone", async () => {
      mockData.activeCityId = 2;
      mockData.activeSocietyId = null;

      const evaluation = await serviceabilityEngine.evaluate({
        cityId: 2,
        zoneId: 100,
        societyId: null,
        propertyType: "INDIVIDUAL_HOME",
      });

      expect(evaluation.isServiceable).toBe(true);
      expect(evaluation.status).toBe("SERVICEABLE");
      expect(evaluation.matchedRuleId).toBe(503);
    });

    it("fails closed when no matching zone coverage rule exists for an unconfigured location", async () => {
      mockData.activeCityId = 2;
      mockData.activeSocietyId = null;

      const evaluation = await serviceabilityEngine.evaluate({
        cityId: 2,
        zoneId: 100,
        societyId: null,
        propertyType: "COMMERCIAL_PROPERTY",
      });

      expect(evaluation.isServiceable).toBe(false);
      expect(evaluation.rejectionReason).toContain("Doorstep car cleaning is not currently active");
    });
  });

  describe("3. Location-Based Differential Pricing Engine & 5-Tier Priority", () => {
    it("resolves Tier 1 Society Override price for society customers (₹1,200/mo)", async () => {
      const priceQuote = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        branchId: 20,
        zoneId: 100,
        societyId: 201, // Jaypee Greens
        locationType: "GATED_SOCIETY",
      });

      expect(priceQuote.basePrice).toBe(1200);
      expect(priceQuote.gstRate).toBe(18);
      expect(priceQuote.gst).toBe(216);
      expect(priceQuote.total).toBe(1416);
      expect(priceQuote.ruleId).toBe(601);
      expect(priceQuote.priorityName).toBe("society_override");
      expect(priceQuote.priorityLevel).toBe(1);
    });

    it("resolves Tier 2 Zone + Location Type price for individual home customers (₹1,500/mo)", async () => {
      const priceQuote = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        branchId: 20,
        zoneId: 100,
        societyId: null,
        locationType: "INDIVIDUAL_HOME",
      });

      expect(priceQuote.basePrice).toBe(1500);
      expect(priceQuote.gstRate).toBe(18);
      expect(priceQuote.gst).toBe(270);
      expect(priceQuote.total).toBe(1770);
      expect(priceQuote.ruleId).toBe(602);
      expect(priceQuote.priorityName).toBe("zone_location_type");
      expect(priceQuote.priorityLevel).toBe(2);
    });

    it("falls back to Tier 5 City Default price when no society or zone override matches (₹1,350/mo)", async () => {
      const priceQuote = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        branchId: null,
        zoneId: null,
        societyId: null,
        locationType: "COMMERCIAL_PROPERTY",
      });

      expect(priceQuote.basePrice).toBe(1350);
      expect(priceQuote.ruleId).toBe(603);
      expect(priceQuote.priorityName).toBe("city_default");
      expect(priceQuote.priorityLevel).toBe(5);
    });

    it("embeds immutable price snapshot preserving rule ID, zone, and location type", async () => {
      const priceQuote = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        branchId: 20,
        zoneId: 100,
        societyId: 201,
        locationType: "GATED_SOCIETY",
      });

      const snapshot = priceQuote.snapshot;
      expect(snapshot).toBeDefined();
      expect(snapshot.ruleId).toBe(601);
      expect(snapshot.basePrice).toBe(1200);
      expect(snapshot.total).toBe(1416);
      expect(snapshot.zoneId).toBe(100);
      expect(snapshot.locationType).toBe("GATED_SOCIETY");
      expect(snapshot.resolvedAt).toBeDefined();
    });

    it("fails closed with descriptive error if service pricing is missing", async () => {
      // Empty rules mock
      const originalRules = mockData.locationPricingRules;
      mockData.locationPricingRules = [];

      try {
        await expect(
          locationPricingEngine.resolvePrice({
            serviceId: 9999,
            cityId: 2,
            locationType: "GATED_SOCIETY",
          }),
        ).rejects.toThrow("MISSING_PRICE_CONFIGURATION");
      } finally {
        mockData.locationPricingRules = originalRules;
      }
    });
  });

  describe("4. Security, Scope Enforcement & Multi-Branch IDOR Protection", () => {
    it("restricts branch admin to their authorized branch scope", async () => {
      const scope = await computeScope({
        id: 10,
        role: "admin",
        branchId: 20, // Noida branch
        companyId: 1,
      } as any);

      expect(scope.isSuperAdmin).toBe(false);
      expect(scope.branchIds).toEqual([20]);
      expect(scope.branchIds?.includes(20)).toBe(true);
      expect(scope.branchIds?.includes(10)).toBe(false); // Cannot access Varanasi branch
    });

    it("allows superadmin cross-branch operations", async () => {
      const scope = await computeScope({
        id: 1,
        role: "superadmin",
        branchId: null,
        companyId: null,
      } as any);

      expect(scope.isSuperAdmin).toBe(true);
      expect(scope.branchIds).toBeNull(); // Superadmin has unrestricted branch access
    });

    it("locks field staff to assigned branch and prevents cross-branch access", async () => {
      const staffScope = await computeScope({
        id: 55,
        role: "staff",
        branchId: 20,
        staffId: 55,
        companyId: 1,
      } as any);

      expect(staffScope.branchIds).toEqual([20]);
      expect(staffScope.branchIds?.includes(20)).toBe(true);
      expect(staffScope.branchIds?.includes(10)).toBe(false);
    });
  });

  describe("5. Point-In-Polygon (PIP) & GeoJSON Spatial Boundary Matching", () => {
    // Square polygon in Noida: [ [lng, lat], ... ]
    // Min Lat: 28.50, Max Lat: 28.60, Min Lng: 77.30, Max Lng: 77.40
    const testPolygon = [
      [77.30, 28.50],
      [77.40, 28.50],
      [77.40, 28.60],
      [77.30, 28.60],
      [77.30, 28.50],
    ];

    it("correctly identifies point inside polygon", () => {
      // (28.55, 77.35) is right inside
      const inside = isPointInPolygon(28.55, 77.35, testPolygon);
      expect(inside).toBe(true);
    });

    it("correctly identifies point outside polygon", () => {
      // (28.70, 77.50) is well outside
      const outside = isPointInPolygon(28.70, 77.50, testPolygon);
      expect(outside).toBe(false);
    });

    it("correctly verifies GeoJSON Polygon object", () => {
      const geoJson = {
        type: "Polygon",
        coordinates: [testPolygon],
      };
      expect(isPointInGeoJson(28.55, 77.35, geoJson)).toBe(true);
      expect(isPointInGeoJson(28.70, 77.50, geoJson)).toBe(false);
    });

    it("handles invalid or empty GeoJSON gracefully", () => {
      expect(isPointInGeoJson(28.55, 77.35, null)).toBe(false);
      expect(isPointInGeoJson(28.55, 77.35, {})).toBe(false);
      expect(isPointInGeoJson(28.55, 77.35, { type: "Point", coordinates: [77.35, 28.55] })).toBe(false);
    });
  });

  describe("6. Customer Address Edit Regression & Differential Pricing Transition (Workflow D)", () => {
    it("recalculates pricing tier when customer edits address from Gated Society to Individual Home", async () => {
      // 1. Initial State: Gated Society customer at Jaypee Greens Wish Town
      const societyPrice = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        zoneId: 100,
        societyId: 201,
        locationType: "GATED_SOCIETY",
      });
      expect(societyPrice.priorityName).toBe("society_override");
      expect(societyPrice.basePrice).toBe(1200);
      expect(societyPrice.total).toBe(1416);

      // 2. Customer edits address: switches property type to Individual Home in same zone
      // Old societyId (201) must be cleared so it no longer receives the society cluster discount!
      const individualPrice = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        zoneId: 100,
        societyId: null, // cleared on switch to individual home
        locationType: "INDIVIDUAL_HOME",
      });
      expect(individualPrice.priorityName).toBe("zone_location_type");
      expect(individualPrice.basePrice).toBe(1500);
      expect(individualPrice.total).toBe(1770);
    });

    it("clears stale society and resets to city default pricing if edited to uncovered locality outside zones", async () => {
      const cityDefaultPrice = await locationPricingEngine.resolvePrice({
        serviceId: 1,
        cityId: 2,
        zoneId: null,
        societyId: null,
        locationType: "ALL",
      });
      expect(cityDefaultPrice.priorityName).toBe("city_default");
      expect(cityDefaultPrice.basePrice).toBe(1350);
      expect(cityDefaultPrice.total).toBe(1593);
    });
  });
});
