import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLimit, mockIsAvailable } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockIsAvailable: vi.fn(),
}));

vi.mock("@workspace/db", () => {
  const chain: { innerJoin: ReturnType<typeof vi.fn>; where: ReturnType<typeof vi.fn> } = {} as never;
  chain.innerJoin = vi.fn(() => chain);
  chain.where = vi.fn(() => ({ limit: mockLimit }));
  return {
    db: {
      select: vi.fn(() => ({ from: vi.fn(() => chain) })),
    },
    pincodesTable: {},
    serviceAreasTable: {},
    citiesTable: {},
    statesTable: {},
    servicesTable: {},
    serviceCityAvailabilityTable: {},
  };
});

vi.mock("./repositories/ServiceAvailabilityRepository", async importOriginal => {
  const actual = await importOriginal<typeof import("./repositories/ServiceAvailabilityRepository")>();
  return {
    ...actual,
    serviceAvailabilityRepository: {
      isServiceAvailableInCity: mockIsAvailable,
      getCityServiceCatalog: vi.fn().mockResolvedValue({
        availableServices: [{ id: 10, name: "Wash", slug: "wash" }],
        comingSoonServices: [],
        unavailableServices: [{ id: 99, name: "Other", slug: "other" }],
      }),
    },
  };
});

import { resetCoverageCacheForTests } from "./CoverageCache";
import { coverageEngine, toCoverageCheckResponse } from "./CoverageEngine";

const baseRequest = {
  address: "Lanka, Varanasi, Uttar Pradesh 221005, India",
  locationLat: 25.28,
  locationLng: 82.99,
  serviceId: 10,
  customerId: 1,
};

const activePinRow = {
  pincode: "221005",
  pincodeId: 1,
  pincodeActive: true,
  serviceAreaId: 5,
  serviceAreaName: "Lanka",
  serviceAreaActive: true,
  cityId: 7,
  cityName: "Varanasi",
  citySlug: "varanasi",
  cityActive: true,
  stateName: "Uttar Pradesh",
  stateCode: "UP",
};

const activeCityRow = {
  id: 7,
  name: "Varanasi",
  slug: "varanasi",
  isActive: true,
  stateName: "Uttar Pradesh",
};

describe("CoverageEngine", () => {
  beforeEach(() => {
    resetCoverageCacheForTests();
    mockLimit.mockReset();
    mockIsAvailable.mockReset();
  });

  it("returns SUCCESS with service catalog and correlation IDs", async () => {
    mockLimit.mockResolvedValueOnce([activePinRow]);
    mockIsAvailable.mockResolvedValue(true);

    const result = await coverageEngine.check(baseRequest, { requestSource: "test" });

    expect(result.success).toBe(true);
    expect(result.coverageStatus).toBe("AVAILABLE");
    expect(result.correlation.coverageValidationId).toBeTruthy();
    expect(result.correlation.traceId).toBeTruthy();
    expect(result.confidenceScore).toBeGreaterThan(0);
    expect(result.locationContext?.validationId).toBe(result.correlation.coverageValidationId);
    expect(result.availableServices?.length).toBeGreaterThan(0);
    expect(result.cityResolutionSource).toBe("pin");
  });

  it("maps failure to legacy booking status", async () => {
    mockLimit.mockResolvedValueOnce([activePinRow]);
    mockIsAvailable.mockResolvedValue(false);

    const result = await coverageEngine.validateForBooking(baseRequest);

    expect(result.success).toBe(false);
    expect(result.legacyStatus).toBe("SERVICE_NOT_AVAILABLE");
    expect(result.status).toBe("SERVICE_UNAVAILABLE");
  });

  it("returns SERVICE_AREA_NOT_SUPPORTED for unknown PIN", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await coverageEngine.check(baseRequest);

    expect(result.status).toBe("SERVICE_AREA_NOT_SUPPORTED");
  });

  it("prefers parsed Google city over citySlug when PIN absent", async () => {
    mockLimit.mockResolvedValueOnce([{
      ...activeCityRow,
      name: "Mumbai",
      slug: "mumbai",
    }]);

    const result = await coverageEngine.check({
      address: "Some street, Mumbai",
      locationLat: 25.28,
      locationLng: 82.99,
      citySlug: "varanasi",
      addressComponents: [
        { long_name: "Mumbai", short_name: "Mumbai", types: ["locality"] },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.cityResolutionSource).toBe("google_city");
    expect(result.cityName).toBe("Mumbai");
  });

  it("formats coverage check API response", async () => {
    mockLimit.mockResolvedValueOnce([activePinRow]);
    mockIsAvailable.mockResolvedValue(true);

    const result = await coverageEngine.check(baseRequest);
    const api = toCoverageCheckResponse(result);

    expect(api.success).toBe(true);
    expect(api.coverageStatus).toBe("AVAILABLE");
    expect(api.postalCode).toBe("221005");
    expect(api.city?.name).toBe("Varanasi");
    expect(Array.isArray(api.availableServices)).toBe(true);
  });

  it("returns INVALID_ADDRESS when coordinates missing", async () => {
    const result = await coverageEngine.check({
      address: "test",
      locationLat: null,
      locationLng: null,
    });
    expect(result.status).toBe("INVALID_ADDRESS");
  });
});
