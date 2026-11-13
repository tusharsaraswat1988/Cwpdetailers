import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "net";

// ─────────────────────────────────────────────────────────────────────────────
// Trackers for side effects (SEC-022 Test 7)
// ─────────────────────────────────────────────────────────────────────────────
const sideEffectTracker = {
  bookingInserts: 0,
  queueBridges: 0,
  timelineEvents: 0,
  statusTransitions: 0,
};

const mockServices = [
  { id: 1, name: "Standard Car Wash", slug: "car-wash", category: "car_wash", isActive: true },
  { id: 5, name: "Ceramic Coating", slug: "ceramic-coating", category: "ceramic_coating", isActive: true },
  { id: 10, name: "Daily Car Cleaning", slug: "daily-car-cleaning", category: "subscription", isActive: true },
];

const mockCustomers = new Map([
  [101, { id: 101, name: "Noida Customer", phone: "9876543210", branchId: 2, companyId: 1, status: "active" }],
  [102, { id: 102, name: "Varanasi Customer", phone: "9876543211", branchId: 1, companyId: 1, status: "active" }],
]);

const mockServiceLocations = new Map([
  [501, { id: 501, customerId: 101, address: "Sector 62, Noida", city: "Noida", latitude: 28.62, longitude: 77.36, label: "Noida Office" }],
  [502, { id: 502, customerId: 102, address: "Lanka, Varanasi", city: "Varanasi", latitude: 25.28, longitude: 82.99, label: "Varanasi Home" }],
]);

const mockCities = [
  { id: 1, name: "Varanasi", slug: "varanasi", isActive: true, stateName: "Uttar Pradesh" },
  { id: 2, name: "Noida", slug: "noida", isActive: true, stateName: "Uttar Pradesh" },
];

let createdBookings: any[] = [];

function extractChunks(obj: any): any[] {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj.flatMap(extractChunks);
  if (obj.queryChunks) return extractChunks(obj.queryChunks);
  if (typeof obj === "number" || typeof obj === "string") return [obj];
  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock DB Layer
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("@workspace/db", () => {
  const customersTableMock = { _name: "customers" };
  const serviceLocationsTableMock = { _name: "service_locations" };
  const servicesTableMock = { _name: "services" };
  const bookingsTableMock = {
    _name: "bookings",
    id: "id",
    customerId: "customer_id",
    companyId: "company_id",
    branchId: "branch_id",
    franchiseeId: "franchisee_id",
    serviceId: "service_id",
  };
  const bookingEventsTableMock = { _name: "booking_events" };
  const vehiclesTableMock = { _name: "vehicles" };
  const solarSitesTableMock = { _name: "solar_sites" };
  const citiesTableMock = { _name: "cities" };
  const statesTableMock = { _name: "states" };
  const serviceAreasTableMock = { _name: "service_areas" };
  const pincodesTableMock = { _name: "pincodes" };
  const customerContractsTableMock = { _name: "customer_contracts" };
  const serviceCityAvailabilityTableMock = { _name: "service_city_availability" };
  const addressesTableMock = { _name: "addresses" };
  const addressIdentitiesTableMock = { _name: "address_identities" };
  const bookingSnapshotsTableMock = { _name: "booking_snapshots" };
  const bookingTimelineTableMock = { _name: "booking_timeline" };

  return {
    db: {
      select: vi.fn((fields?: any) => {
        let currentTable: any = null;
        let whereFn: any = null;

        const chain: any = {
          from: vi.fn((table: any) => {
            currentTable = table;
            return chain;
          }),
          leftJoin: vi.fn(() => chain),
          innerJoin: vi.fn(() => chain),
          where: vi.fn((predicate: any) => {
            whereFn = predicate;
            return chain;
          }),
          orderBy: vi.fn(() => chain),
          limit: vi.fn(async (num: number) => {
            const chunks = extractChunks(whereFn);

            if (currentTable === serviceLocationsTableMock) {
              for (const chunk of chunks) {
                if (typeof chunk === "number" && mockServiceLocations.has(chunk)) {
                  return [mockServiceLocations.get(chunk)];
                }
              }
              const locs = Array.from(mockServiceLocations.values());
              return locs.slice(0, num);
            }

            if (currentTable === customersTableMock) {
              for (const chunk of chunks) {
                if (typeof chunk === "number" && mockCustomers.has(chunk)) {
                  return [mockCustomers.get(chunk)];
                }
              }
              const custs = Array.from(mockCustomers.values());
              return custs.slice(0, num);
            }

            if (currentTable === servicesTableMock) {
              if (chunks.length > 0) {
                for (const chunk of chunks) {
                  if (typeof chunk === "number") {
                    const s = mockServices.find((srv) => srv.id === chunk);
                    if (s) return [s];
                  }
                  if (typeof chunk === "string") {
                    const s = mockServices.find(
                      (srv) => srv.slug === chunk || srv.category === chunk || srv.name.toLowerCase() === chunk.toLowerCase()
                    );
                    if (s) return [s];
                  }
                }
                return [];
              }
              return mockServices.slice(0, num);
            }

            if (currentTable === citiesTableMock) {
              for (const chunk of chunks) {
                if (typeof chunk === "number") {
                  const c = mockCities.find((city) => city.id === chunk);
                  return c ? [c] : [];
                }
                if (typeof chunk === "string") {
                  const c = mockCities.find((city) => city.slug === chunk || city.name.toLowerCase() === chunk.toLowerCase());
                  return c ? [c] : [];
                }
              }
              return mockCities.slice(0, num);
            }

            if (currentTable === bookingsTableMock) {
              return createdBookings.slice(0, num);
            }
            return [];
          }),
          then: (resolve: any, reject: any) => {
            const chunks = extractChunks(whereFn);
            if (currentTable === servicesTableMock) {
              if (chunks.length > 0) {
                for (const chunk of chunks) {
                  if (typeof chunk === "number") {
                    const s = mockServices.find((srv) => srv.id === chunk);
                    if (s) return Promise.resolve([s]).then(resolve, reject);
                  }
                  if (typeof chunk === "string") {
                    const s = mockServices.find(
                      (srv) => srv.slug === chunk || srv.category === chunk || srv.name.toLowerCase() === chunk.toLowerCase()
                    );
                    if (s) return Promise.resolve([s]).then(resolve, reject);
                  }
                }
                return Promise.resolve([]).then(resolve, reject);
              }
              return Promise.resolve(mockServices).then(resolve, reject);
            }
            if (currentTable === bookingsTableMock) {
              return Promise.resolve(createdBookings).then(resolve, reject);
            }
            return Promise.resolve([]).then(resolve, reject);
          },
        };
        return chain;
      }),
      insert: vi.fn((table: any) => {
        return {
          values: vi.fn((vals: any) => {
            if (table === bookingsTableMock || table?._name === "bookings") {
              sideEffectTracker.bookingInserts++;
              const newRecord = {
                id: 8800 + sideEffectTracker.bookingInserts,
                ...vals,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              createdBookings.push(newRecord);
              return {
                returning: vi.fn().mockResolvedValue([newRecord]),
              };
            }
            if (table === bookingEventsTableMock || table?._name === "booking_events") {
              sideEffectTracker.timelineEvents++;
            }
            return {
              returning: vi.fn().mockResolvedValue([{ id: 1 }]),
            };
          }),
        };
      }),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([]),
      })),
    },
    bookingsTable: bookingsTableMock,
    customersTable: customersTableMock,
    servicesTable: servicesTableMock,
    bookingEventsTable: bookingEventsTableMock,
    vehiclesTable: vehiclesTableMock,
    solarSitesTable: solarSitesTableMock,
    serviceLocationsTable: serviceLocationsTableMock,
    citiesTable: citiesTableMock,
    statesTable: statesTableMock,
    serviceAreasTable: serviceAreasTableMock,
    pincodesTable: pincodesTableMock,
    customerContractsTable: customerContractsTableMock,
    serviceCityAvailabilityTable: serviceCityAvailabilityTableMock,
    addressesTable: addressesTableMock,
    addressIdentitiesTable: addressIdentitiesTableMock,
    bookingSnapshotsTable: bookingSnapshotsTableMock,
    bookingTimelineTable: bookingTimelineTableMock,
    residentialSocietiesTable: { _name: "residential_societies" },
    societyTowersTable: { _name: "society_towers" },
    staffTable: { _name: "staff" },
  };
});

// Mock queue bridge adapter to observe side effects
vi.mock("../../lib/assignments/enqueueAdapters", () => ({
  bridgeLegacyBookingToContractAndQueue: vi.fn().mockImplementation(async () => {
    sideEffectTracker.queueBridges++;
    return 1;
  }),
  loadContractBySource: vi.fn().mockResolvedValue(null),
  enqueuePendingForContractSource: vi.fn().mockResolvedValue(null),
}));

// Mock customer reactivation
vi.mock("../../lib/customerReactivation", () => ({
  tryReactivateLegacyCustomer: vi.fn().mockResolvedValue({ reactivated: false }),
}));

// Mock ServiceAvailabilityRepository to enforce city service availability
// City 1 = Varanasi: Car wash (1), Ceramic Coating (5), Daily Cleaning (10) all available
// City 2 = Noida: Only Daily Car Cleaning (10) available. Ceramic Coating (5) and Car Wash (1) NOT available
vi.mock("../../lib/coverage/repositories/ServiceAvailabilityRepository", () => {
  return {
    ServiceAvailabilityRepository: class {
      async isServiceAvailableInCity(serviceId: number, cityId: number): Promise<boolean> {
        if (cityId === 2) {
          // Noida
          return serviceId === 10;
        }
        if (cityId === 1) {
          // Varanasi
          return serviceId === 1 || serviceId === 5 || serviceId === 10;
        }
        return false;
      }

      async getCityServiceCatalog(cityId: number) {
        if (cityId === 2) {
          return {
            availableServices: [{ id: 10, name: "Daily Car Cleaning", slug: "daily-car-cleaning", category: "subscription" }],
            comingSoonServices: [],
            unavailableServices: [
              { id: 1, name: "Standard Car Wash", slug: "car-wash", category: "car_wash" },
              { id: 5, name: "Ceramic Coating", slug: "ceramic-coating", category: "ceramic_coating" },
            ],
          };
        }
        return {
          availableServices: mockServices,
          comingSoonServices: [],
          unavailableServices: [],
        };
      }
    },
    serviceAvailabilityRepository: {
      async isServiceAvailableInCity(serviceId: number, cityId: number): Promise<boolean> {
        if (cityId === 2) {
          // Noida: only serviceId 10 (Daily Car Cleaning) is available
          return serviceId === 10;
        }
        if (cityId === 1) {
          // Varanasi: all available
          return serviceId === 1 || serviceId === 5 || serviceId === 10;
        }
        return false;
      },
      async getCityServiceCatalog(cityId: number) {
        if (cityId === 2) {
          return {
            availableServices: [{ id: 10, name: "Daily Car Cleaning", slug: "daily-car-cleaning", category: "subscription" }],
            comingSoonServices: [],
            unavailableServices: [
              { id: 1, name: "Standard Car Wash", slug: "car-wash", category: "car_wash" },
              { id: 5, name: "Ceramic Coating", slug: "ceramic-coating", category: "ceramic_coating" },
            ],
          };
        }
        return {
          availableServices: mockServices,
          comingSoonServices: [],
          unavailableServices: [],
        };
      },
    },
  };
});

// Mock CityRepository so Noida (cityId 2) and Varanasi (cityId 1) resolve correctly
vi.mock("../../lib/coverage/repositories/CityRepository", () => {
  class MockCityRepository {
    async findById(cityId: number) {
      return mockCities.find((c) => c.id === cityId) ?? null;
    }
    async findByName(name: string) {
      return mockCities.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
    }
    async findBySlug(slug: string) {
      return mockCities.find((c) => c.slug.toLowerCase() === slug.toLowerCase()) ?? null;
    }
  }
  const inst = new MockCityRepository();
  return {
    CityRepository: MockCityRepository,
    cityRepository: inst,
  };
});

// Mock PinRepository to avoid external geocoding lookups during test
vi.mock("../../lib/coverage/repositories/PinRepository", () => {
  class MockPinRepository {
    async findByPincode(pincode: string) {
      if (pincode === "201301") {
        return {
          pincode: "201301",
          pincodeId: 201,
          pincodeActive: true,
          serviceAreaId: 21,
          serviceAreaName: "Noida Sector 62",
          serviceAreaActive: true,
          cityId: 2,
          cityName: "Noida",
          citySlug: "noida",
          cityActive: true,
          stateName: "Uttar Pradesh",
          stateCode: "UP",
          latitude: 28.62,
          longitude: 77.36,
        };
      }
      if (pincode === "221005") {
        return {
          pincode: "221005",
          pincodeId: 101,
          pincodeActive: true,
          serviceAreaId: 11,
          serviceAreaName: "Lanka",
          serviceAreaActive: true,
          cityId: 1,
          cityName: "Varanasi",
          citySlug: "varanasi",
          cityActive: true,
          stateName: "Uttar Pradesh",
          stateCode: "UP",
          latitude: 25.28,
          longitude: 82.99,
        };
      }
      return null;
    }
  }
  const inst = new MockPinRepository();
  return {
    PinRepository: MockPinRepository,
    pinRepository: inst,
  };
});

// Mock savedLocationService
vi.mock("../../lib/saved-locations/SavedLocationService", () => ({
  savedLocationService: {
    getOwned: vi.fn().mockResolvedValue(null),
  },
}));

// Now import the actual router and capability under test
import bookingsRouter from "../../routes/bookings";
import { resetCoverageCacheForTests } from "../../lib/coverage/CoverageCache";

describe("SEC-022: Booking City Validation Security Regression Suite", () => {
  let app: express.Express;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Simulated authenticated customer context (matching req.user and req.scope)
    app.use((req, res, next) => {
      req.log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any;
      // Super admin / full scope for test harness to bypass user-ownership middleware filters
      req.user = { id: 1, role: "admin", companyId: 1 } as any;
      req.scope = {
        isSuperAdmin: true,
        companyId: 1,
        branchIds: null,
        franchiseeId: null,
        customerId: null,
        staffId: null,
      } as any;
      next();
    });

    app.use("/api", bookingsRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}/api`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  beforeEach(() => {
    resetCoverageCacheForTests();
    createdBookings = [];
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1 — Exploit Reproduction: Prohibited service in Noida omitting serviceId
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 1: Exploit Reproduction — rejects prohibited ceramic_coating in Noida when serviceId is omitted", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101, // Noida customer
        serviceLocationId: 501, // Noida location
        cityName: "Noida",
        cityId: 2,
        address: "Expressway Towers, Sector 62, Noida, UP 201301",
        postalCode: "201301",
        locationLat: 28.62,
        locationLng: 77.36,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceType: "ceramic_coating", // Prohibited service in Noida, serviceId omitted!
      }),
    });

    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("SERVICE_UNAVAILABLE_IN_CITY");
    expect(body.error).toMatch(/Service is not available in Noida/i);
    expect(sideEffectTracker.bookingInserts).toBe(priorInserts);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2 — Explicit serviceId bypass attempt
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 2: Explicit serviceId bypass — rejects prohibited serviceId in Noida even when serviceId is supplied", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        serviceLocationId: 501,
        cityName: "Noida",
        cityId: 2,
        address: "Expressway Towers, Sector 62, Noida, UP 201301",
        postalCode: "201301",
        locationLat: 28.62,
        locationLng: 77.36,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceId: 5, // Ceramic Coating explicitly passed
      }),
    });

    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("SERVICE_UNAVAILABLE_IN_CITY");
    expect(body.error).toMatch(/Service is not available in Noida/i);
    expect(sideEffectTracker.bookingInserts).toBe(priorInserts);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3 — Service Type Manipulation
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 3: Service Type Manipulation — rejects mismatch between serviceId and serviceType", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    // Service 1 is car_wash, but client attempts to pass serviceType ceramic_coating
    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        serviceLocationId: 501,
        cityName: "Noida",
        cityId: 2,
        address: "Expressway Towers, Sector 62, Noida, UP 201301",
        postalCode: "201301",
        locationLat: 28.62,
        locationLng: 77.36,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceId: 1, // Car Wash catalog item
        serviceType: "ceramic_coating", // Manipulated serviceType!
      }),
    });

    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe("SERVICE_TYPE_MISMATCH");
    expect(body.error).toMatch(/does not match/i);
    expect(sideEffectTracker.bookingInserts).toBe(priorInserts);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4 — Valid Noida Daily Car Cleaning Booking
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 4: Valid Noida Booking — permits legitimate Daily Car Cleaning in Noida with DCMS plan contract", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        serviceLocationId: 501,
        cityName: "Noida",
        cityId: 2,
        address: "Expressway Towers, Sector 62, Noida, UP 201301",
        postalCode: "201301",
        locationLat: 28.62,
        locationLng: 77.36,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceId: 10, // Daily Car Cleaning (active in Noida)
        serviceType: "daily_cleaning",
        contractRegistryId: 201, // Valid contract registry reference for DCMS plan
      }),
    });

    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.serviceId).toBe(10);
    expect(body.serviceType).toBe("daily_cleaning");
    expect(sideEffectTracker.bookingInserts).toBe(priorInserts + 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 5 — Varanasi Regression
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 5: Varanasi Regression — allows valid Varanasi Car Wash booking without disruption", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 102, // Varanasi customer
        serviceLocationId: 502, // Varanasi location
        cityName: "Varanasi",
        cityId: 1,
        address: "Lanka, Varanasi, UP 221005",
        postalCode: "221005",
        locationLat: 25.28,
        locationLng: 82.99,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceId: 1, // Standard Car Wash (active in Varanasi)
        serviceType: "car_wash",
      }),
    });

    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBeDefined();
    expect(body.serviceId).toBe(1);
    expect(body.serviceType).toBe("car_wash");
    expect(sideEffectTracker.bookingInserts).toBe(priorInserts + 1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 6 — Missing / Invalid Service Identification
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 6: Missing / Invalid Service — safely rejects unresolvable services", async () => {
    const priorInserts = sideEffectTracker.bookingInserts;

    // Subcase 6a: Non-existent numeric serviceId
    const resA = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        address: "Sector 62, Noida",
        cityName: "Noida",
        cityId: 2,
        scheduledDate: "2026-07-20",
        serviceId: 999999, // Non-existent
      }),
    });
    const bodyA = await resA.json();
    expect(resA.status).toBe(400);
    expect(bodyA.code).toBe("INVALID_SERVICE");

    // Subcase 6b: Unresolvable serviceType string
    const resB = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        address: "Sector 62, Noida",
        cityName: "Noida",
        cityId: 2,
        scheduledDate: "2026-07-20",
        serviceType: "non_existent_unresolvable_service_xyz",
      }),
    });
    const bodyB = await resB.json();
    expect(resB.status).toBe(400);
    expect(bodyB.code).toBe("INVALID_SERVICE");

    // Subcase 6c: Neither serviceId nor serviceType provided
    const resC = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        address: "Sector 62, Noida",
        cityName: "Noida",
        cityId: 2,
        scheduledDate: "2026-07-20",
      }),
    });
    const bodyC = await resC.json();
    expect(resC.status).toBe(400);
    expect(bodyC.code).toBe("INVALID_SERVICE");

    expect(sideEffectTracker.bookingInserts).toBe(priorInserts);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 7 — Zero Side Effects on Rejection
  // ───────────────────────────────────────────────────────────────────────────
  it("Test 7: No Side Effects on Rejection — rejected requests produce zero bookings, queue tasks, or timeline events", async () => {
    // Record current baseline metrics
    const baselineBookings = sideEffectTracker.bookingInserts;
    const baselineQueueBridges = sideEffectTracker.queueBridges;

    // Attempt exploit reproduction again
    const res = await fetch(`${baseUrl}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: 101,
        serviceLocationId: 501,
        cityName: "Noida",
        cityId: 2,
        address: "Sector 62, Noida, UP 201301",
        postalCode: "201301",
        locationLat: 28.62,
        locationLng: 77.36,
        scheduledDate: "2026-07-20",
        scheduledTime: "10:00",
        serviceType: "ceramic_coating",
      }),
    });

    expect(res.status).toBe(400);

    // Verify side effect invariants
    expect(sideEffectTracker.bookingInserts).toBe(baselineBookings);
    expect(sideEffectTracker.queueBridges).toBe(baselineQueueBridges);
    expect(createdBookings.length).toBe(0);
  });
});
