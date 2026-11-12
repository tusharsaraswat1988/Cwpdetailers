import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import express from "express";
import type { AddressInfo } from "net";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────────────────
const mockCities = [
  { id: 1, name: "Varanasi", slug: "varanasi", isActive: true },
  { id: 2, name: "Noida", slug: "noida", isActive: true },
];

const mockServiceAreas = [
  { id: 11, cityId: 1, name: "Lanka", isActive: true },
  { id: 21, cityId: 2, name: "Sector 104", isActive: true },
  { id: 22, cityId: 2, name: "Sector 108", isActive: true },
];

let mockSocieties = [
  {
    id: 101,
    cityId: 2,
    serviceAreaId: 21,
    name: "ATS One Hamlet",
    code: "ATS-ONE-HAMLET",
    address: "Sector 104, Noida",
    pincode: "201304",
    latitude: 28.5355,
    longitude: 77.3685,
    gateSecurityNotes: "Gate 1 cleaner entry pass required",
    totalTowers: 14,
    totalFlats: 900,
    isActive: true,
    companyId: 1,
    branchId: 2,
    franchiseeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 102,
    cityId: 2,
    serviceAreaId: 22,
    name: "Parx Laureate",
    code: "PARX-LAUREATE",
    address: "Sector 108, Noida",
    pincode: "201304",
    latitude: 28.5300,
    longitude: 77.3620,
    gateSecurityNotes: "RFID tag for service staff",
    totalTowers: 18,
    totalFlats: 1100,
    isActive: true,
    companyId: 1,
    branchId: 2,
    franchiseeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 201,
    cityId: 1,
    serviceAreaId: 11,
    name: "Mahamana Enclave",
    code: "MAHAMANA-ENCLAVE",
    address: "Lanka, Varanasi",
    pincode: "221005",
    latitude: 25.2800,
    longitude: 82.9900,
    gateSecurityNotes: "Open colony entry",
    totalTowers: 4,
    totalFlats: 120,
    isActive: true,
    companyId: 1,
    branchId: 1,
    franchiseeId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

let mockTowers = [
  {
    id: 1,
    societyId: 101,
    name: "Tower 1",
    code: "T1",
    totalFloors: 26,
    totalFlats: 104,
    parkingLevels: "B1, B2, Ground",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    societyId: 101,
    name: "Tower 2",
    code: "T2",
    totalFloors: 26,
    totalFlats: 104,
    parkingLevels: "B1, B2, Ground",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    societyId: 102,
    name: "Tower Alpha",
    code: "T-ALPHA",
    totalFloors: 22,
    totalFlats: 88,
    parkingLevels: "B1, Ground",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockServices = [
  { id: 1, name: "Standard Car Wash", slug: "car-wash", category: "car_wash", basePrice: "499", isActive: true },
  { id: 5, name: "Ceramic Coating", slug: "ceramic-coating", category: "ceramic_coating", basePrice: "19999", isActive: true },
  { id: 10, name: "Daily Car Cleaning", slug: "daily-car-cleaning", category: "subscription", basePrice: "799", isActive: true },
];

const mockServiceCityAvailability = [
  // Varanasi: all 3 active
  { serviceId: 1, cityId: 1, isActive: true, basePriceOverride: null },
  { serviceId: 5, cityId: 1, isActive: true, basePriceOverride: null },
  { serviceId: 10, cityId: 1, isActive: true, basePriceOverride: null },
  // Noida: ONLY Daily Car Cleaning active with price override
  { serviceId: 10, cityId: 2, isActive: true, basePriceOverride: "899" },
];

const mockDcmsPlans = [
  { id: 1, name: "Varanasi Hatchback Plan", price: "799", cityId: 1, includedCleanings: 24, includedWashes: 1, isActive: true },
  { id: 2, name: "Noida High-Rise Premium Plan", price: "899", cityId: 2, includedCleanings: 26, includedWashes: 2, isActive: true },
  { id: 3, name: "Standard Global DCMS Plan", price: "749", cityId: null, includedCleanings: 22, includedWashes: 0, isActive: true },
];

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
  const residentialSocietiesTableMock = { _name: "residential_societies" };
  const societyTowersTableMock = { _name: "society_towers" };
  const citiesTableMock = { _name: "cities" };
  const serviceAreasTableMock = { _name: "service_areas" };
  const servicesTableMock = { _name: "services" };
  const serviceCategoriesTableMock = { _name: "service_categories" };
  const serviceAddonLinksTableMock = { _name: "service_addon_links" };
  const serviceCityAvailabilityTableMock = { _name: "service_city_availability" };
  const dcmsPlansTableMock = { _name: "dcms_plans" };
  const dcmsSubscriptionsTableMock = { _name: "dcms_subscriptions" };

  return {
    db: {
      select: vi.fn((fields?: any) => {
        let currentTable: any = null;
        let whereFn: any = null;
        let joins: any[] = [];
        let limitCount: number | null = null;
        let offsetCount: number | null = null;

        const chain: any = {
          from: vi.fn((table: any) => {
            currentTable = table;
            return chain;
          }),
          leftJoin: vi.fn((table: any, on: any) => {
            joins.push({ type: "left", table, on });
            return chain;
          }),
          innerJoin: vi.fn((table: any, on: any) => {
            joins.push({ type: "inner", table, on });
            return chain;
          }),
          where: vi.fn((predicate: any) => {
            whereFn = predicate;
            return chain;
          }),
          orderBy: vi.fn(() => chain),
          limit: vi.fn((num: number) => {
            limitCount = num;
            return chain;
          }),
          offset: vi.fn((num: number) => {
            offsetCount = num;
            return chain;
          }),
          groupBy: vi.fn(() => chain),
          then: (resolve: any, reject: any) => {
            const chunks = extractChunks(whereFn);
            const lim = limitCount ?? 1000;
            const off = offsetCount ?? 0;

            if (currentTable === citiesTableMock) {
              for (const chunk of chunks) {
                if (typeof chunk === "string") {
                  const c = mockCities.find((city) => city.slug === chunk || city.name.toLowerCase() === chunk.toLowerCase());
                  if (c) return Promise.resolve([c]).then(resolve, reject);
                }
                if (typeof chunk === "number") {
                  const c = mockCities.find((city) => city.id === chunk);
                  if (c) return Promise.resolve([c]).then(resolve, reject);
                }
              }
              return Promise.resolve(mockCities.slice(off, off + lim)).then(resolve, reject);
            }

            if (currentTable === residentialSocietiesTableMock) {
              if (fields && fields.count) {
                let count = mockSocieties.length;
                const cityId = chunks.find((c) => c === 1 || c === 2);
                if (cityId) {
                  count = mockSocieties.filter((s) => s.cityId === cityId).length;
                }
                return Promise.resolve([{ count }]).then(resolve, reject);
              }

              // Check if specific ID is queried (e.g. GET /societies/:id)
              const idChunk = chunks.find((c) => typeof c === "number" && c > 10);
              if (idChunk) {
                const s = mockSocieties.find((soc) => soc.id === idChunk);
                return Promise.resolve(s ? [s] : []).then(resolve, reject);
              }

              let result = [...mockSocieties];
              for (const chunk of chunks) {
                if (typeof chunk === "number" && (chunk === 1 || chunk === 2)) {
                  result = result.filter((s) => s.cityId === chunk);
                }
              }
              return Promise.resolve(result.slice(off, off + lim)).then(resolve, reject);
            }

            if (currentTable === societyTowersTableMock) {
              let result = [...mockTowers];
              for (const chunk of chunks) {
                if (typeof chunk === "number") {
                  const bySoc = result.filter((t) => t.societyId === chunk);
                  if (bySoc.length > 0) return Promise.resolve(bySoc.slice(off, off + lim)).then(resolve, reject);
                }
              }
              return Promise.resolve(result.slice(off, off + lim)).then(resolve, reject);
            }

            if (currentTable === serviceAddonLinksTableMock) {
              return Promise.resolve([]).then(resolve, reject);
            }

            if (currentTable === servicesTableMock) {
              const hasInnerJoinWithCityAvailability = joins.some(
                (j) => j.type === "inner" && (j.table === serviceCityAvailabilityTableMock || j.table?._name === "service_city_availability")
              );
              if (hasInnerJoinWithCityAvailability) {
                const cityId = chunks.find((c) => c === 1 || c === 2) ?? 2;
                const allowedServiceIds = mockServiceCityAvailability
                  .filter((a) => a.cityId === cityId && a.isActive)
                  .map((a) => a.serviceId);
                const filteredServices = mockServices.filter((s) => allowedServiceIds.includes(s.id));
                return Promise.resolve(filteredServices.slice(off, off + lim)).then(resolve, reject);
              }
              return Promise.resolve(mockServices.slice(off, off + lim)).then(resolve, reject);
            }

            if (currentTable === dcmsPlansTableMock) {
              let plans = [...mockDcmsPlans];
              const cityId = chunks.find((c) => c === 1 || c === 2);
              if (cityId) {
                plans = plans.filter((p) => p.cityId === cityId || p.cityId === null);
              }
              return Promise.resolve(plans.slice(off, off + lim)).then(resolve, reject);
            }

            return Promise.resolve([]).then(resolve, reject);
          },
        };
        return chain;
      }),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (table === residentialSocietiesTableMock || table?._name === "residential_societies") {
            const newSoc = {
              id: 100 + mockSocieties.length + 1,
              ...vals,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockSocieties.push(newSoc);
            return {
              returning: vi.fn().mockResolvedValue([newSoc]),
            };
          }
          if (table === societyTowersTableMock || table?._name === "society_towers") {
            const newTower = {
              id: 10 + mockTowers.length + 1,
              ...vals,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            mockTowers.push(newTower);
            return {
              returning: vi.fn().mockResolvedValue([newTower]),
            };
          }
          return {
            returning: vi.fn().mockResolvedValue([{ id: 1 }]),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((vals: any) => ({
          where: vi.fn((predicate: any) => {
            const chunks = extractChunks(predicate);
            const id = chunks.find((c) => typeof c === "number");
            if (table === residentialSocietiesTableMock || table?._name === "residential_societies") {
              const soc = mockSocieties.find((s) => s.id === id);
              if (soc) Object.assign(soc, vals);
              return {
                returning: vi.fn().mockResolvedValue([soc ?? { id }]),
              };
            }
            return {
              returning: vi.fn().mockResolvedValue([{ id }]),
            };
          }),
        })),
      })),
    },
    residentialSocietiesTable: residentialSocietiesTableMock,
    societyTowersTable: societyTowersTableMock,
    citiesTable: citiesTableMock,
    serviceAreasTable: serviceAreasTableMock,
    servicesTable: servicesTableMock,
    serviceCategoriesTable: serviceCategoriesTableMock,
    serviceAddonLinksTable: serviceAddonLinksTableMock,
    serviceCityAvailabilityTable: serviceCityAvailabilityTableMock,
    dcmsPlansTable: dcmsPlansTableMock,
    dcmsSubscriptionsTable: dcmsSubscriptionsTableMock,
  };
});

// Import routers under test
import societiesRouter from "../../routes/societies";
import servicesRouter from "../../routes/services";

describe("Residential Societies & Multi-City Service Catalog Suite", () => {
  let app: express.Express;
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    // Inject authenticated user and logger
    app.use((req, res, next) => {
      req.log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
      req.user = { id: 1, role: "admin", companyId: 1, branchId: 2 } as any;
      req.scope = {
        isSuperAdmin: true,
        companyId: 1,
        branchIds: [2],
        cityId: 2,
        franchiseeId: null,
        customerId: null,
        staffId: null,
      } as any;
      next();
    });

    app.use("/api", societiesRouter);
    app.use("/api", servicesRouter);

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

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Societies Listing & City Scoping
  // ───────────────────────────────────────────────────────────────────────────
  describe("1. Society Discovery & City Scoping", () => {
    it("lists societies filtered by cityId = 2 (Noida)", async () => {
      const res = await fetch(`${baseUrl}/societies?cityId=2`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data).toBeDefined();
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.every((s: any) => s.cityId === 2)).toBe(true);
      expect(body.data.some((s: any) => s.name === "ATS One Hamlet")).toBe(true);
      expect(body.data.some((s: any) => s.name === "Mahamana Enclave")).toBe(false);
    });

    it("lists societies filtered by citySlug = noida", async () => {
      const res = await fetch(`${baseUrl}/societies?citySlug=noida`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.every((s: any) => s.cityId === 2)).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Society Details & Associated Towers
  // ───────────────────────────────────────────────────────────────────────────
  describe("2. Society Details & Towers", () => {
    it("returns society detail with its active towers", async () => {
      const res = await fetch(`${baseUrl}/societies/101`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.id).toBe(101);
      expect(body.name).toBe("ATS One Hamlet");
      expect(body.towers).toBeDefined();
      expect(body.towers.length).toBeGreaterThan(0);
      expect(body.towers[0].parkingLevels).toContain("B1");
    });

    it("returns 404 for non-existent society", async () => {
      const res = await fetch(`${baseUrl}/societies/99999`);
      expect(res.status).toBe(404);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Society & Tower Creation
  // ───────────────────────────────────────────────────────────────────────────
  describe("3. Society & Tower Management", () => {
    it("creates a new society with initial towers", async () => {
      const res = await fetch(`${baseUrl}/societies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Cleo County",
          cityId: 2,
          serviceAreaId: 21,
          address: "Sector 121, Noida",
          pincode: "201301",
          gateSecurityNotes: "Gate 2 vendor entrance",
          towers: [
            { name: "Tower C1", code: "C1", totalFloors: 24, totalFlats: 96, parkingLevels: "B1, B2" },
            { name: "Tower C2", code: "C2", totalFloors: 24, totalFlats: 96, parkingLevels: "B1, B2" },
          ],
        }),
      });

      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Cleo County");
      expect(body.code).toBe("CLEO-COUNTY");
      expect(body.towers.length).toBe(2);
    });

    it("adds a new tower to an existing society", async () => {
      const res = await fetch(`${baseUrl}/societies/101/towers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Tower 3",
          totalFloors: 26,
          totalFlats: 104,
          parkingLevels: "B1, B2, Ground",
        }),
      });

      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.name).toBe("Tower 3");
      expect(body.societyId).toBe(101);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Dynamic City Catalog Filtering (SVC-004)
  // ───────────────────────────────────────────────────────────────────────────
  describe("4. Dynamic City Catalog Filtering (SVC-004)", () => {
    it("filters services by cityId = 2 (Noida) — returns ONLY Daily Car Cleaning", async () => {
      const res = await fetch(`${baseUrl}/services?cityId=2`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      // In Noida, only Daily Car Cleaning (id 10) is active
      expect(body.length).toBe(1);
      expect(body[0].slug).toBe("daily-car-cleaning");
      expect(body.some((s: any) => s.slug === "ceramic-coating")).toBe(false);
      expect(body.some((s: any) => s.slug === "car-wash")).toBe(false);
    });

    it("returns all active services when cityId is omitted (Varanasi / global backward compatible)", async () => {
      const res = await fetch(`${baseUrl}/services`);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.length).toBe(3);
    });
  });
});
