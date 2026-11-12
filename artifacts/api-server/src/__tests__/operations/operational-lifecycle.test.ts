import { describe, it, expect, vi, beforeEach } from "vitest";
import { distanceMeters, isWithinRadius, DEFAULT_RADIUS_METERS, BASEMENT_EXTRA_TOLERANCE_METERS } from "../../lib/dcms/geoFence";
import {
  notifyBookingConfirmed,
  notifyStaffAssigned,
  notifyVisitCompleted,
  notifyCarNotAvailable,
  dispatchNotification,
} from "../../lib/notifications/dispatcher";

// Mock brandIdentityService to avoid database call in unit test
vi.mock("../../lib/brandIdentityService", () => ({
  getBrandName: vi.fn().mockResolvedValue("CWP Detailers"),
}));

function extractClauseValue(clause: any): string | undefined {
  if (!clause) return undefined;
  if (typeof clause.right === "string") return clause.right;
  if (clause.right && typeof clause.right.value === "string") return clause.right.value;
  if (clause.right && clause.right.value !== undefined) return String(clause.right.value);
  if (Array.isArray(clause.queryChunks)) {
    for (const chunk of clause.queryChunks) {
      if (chunk && typeof chunk.value === "string") return chunk.value;
    }
  }
  return undefined;
}

// Mock database for dispatcher queries with original exports preserved
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();
  const notifications: any[] = [];
  return {
    ...actual,
    db: {
      select: vi.fn((fields: any) => ({
        from: vi.fn((table: any) => ({
          where: vi.fn((clause: any) => ({
            limit: vi.fn(() => {
              // If querying notificationsTable for duplicates
              if (table === actual.notificationsTable) {
                const key = extractClauseValue(clause);
                const match = key ? notifications.find(n => n.dedupeKey === key) : undefined;
                return Promise.resolve(match ? [match] : []);
              }
              // User / staff query
              return Promise.resolve([{ userId: 42, phone: "9876543210" }]);
            }),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((val: any) => {
          const row = { id: notifications.length + 1, ...val, createdAt: new Date() };
          notifications.push(row);
          return {
            returning: vi.fn(() => Promise.resolve([row])),
          };
        }),
      })),
    },
  };
});

describe("Geofence Validation & High-Rise Basement Tolerance (GEO-003, GEO-004, GEO-006)", () => {
  // Sector 62 Noida society coordinates
  const societyLat = 28.6280;
  const societyLng = 77.3649;

  it("calculates accurate Haversine distance in meters", () => {
    // Exact same point = 0 meters
    expect(distanceMeters(societyLat, societyLng, societyLat, societyLng)).toBe(0);

    // Nearby point ~150 meters away
    const nearLat = societyLat + 0.001; // ~111m north
    const nearLng = societyLng + 0.001; // ~97m east
    const dist = distanceMeters(societyLat, societyLng, nearLat, nearLng);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(200);
  });

  it("enforces standard 100m radius for open street locations", () => {
    // 50m offset (within 100m)
    const withinLat = societyLat + 0.0003;
    const withinLng = societyLng + 0.0003;
    expect(isWithinRadius(withinLat, withinLng, societyLat, societyLng, DEFAULT_RADIUS_METERS)).toBe(true);

    // 200m offset (exceeds standard 100m)
    const outsideLat = societyLat + 0.0015;
    const outsideLng = societyLng + 0.0015;
    expect(isWithinRadius(outsideLat, outsideLng, societyLat, societyLng, DEFAULT_RADIUS_METERS)).toBe(false);
  });

  it("relaxes tolerance by +250m for residential society campus & basement parking (GEO-003, GEO-004)", () => {
    // 220m offset: fails standard 100m, but passes basement tolerance (100m + 250m = 350m)
    const campusLat = societyLat + 0.0014;
    const campusLng = societyLng + 0.0014;
    const dist = distanceMeters(campusLat, campusLng, societyLat, societyLng);
    expect(dist).toBeGreaterThan(150);
    expect(dist).toBeLessThan(300);

    // Fails standard
    expect(isWithinRadius(campusLat, campusLng, societyLat, societyLng, DEFAULT_RADIUS_METERS)).toBe(false);

    // Passes with isBasement: true
    expect(isWithinRadius(campusLat, campusLng, societyLat, societyLng, DEFAULT_RADIUS_METERS, { isBasement: true })).toBe(true);
  });

  it("accommodates GPS drift with accuracy circles in concrete structures", () => {
    // 130m offset with 50m GPS inaccuracy
    const driftLat = societyLat + 0.0009;
    const driftLng = societyLng + 0.0009;

    expect(isWithinRadius(driftLat, driftLng, societyLat, societyLng, 100)).toBe(false);
    expect(isWithinRadius(driftLat, driftLng, societyLat, societyLng, 100, { accuracy: 40 })).toBe(true);
  });

  it("allows graceful fallback when cleaner is in deep B2/B3 basement with zero GPS fix (GEO-006)", () => {
    expect(isWithinRadius(0, 0, societyLat, societyLng, 100, { isBasement: true })).toBe(true);
    // Non-basement with 0,0 still fails
    expect(isWithinRadius(0, 0, societyLat, societyLng, 100, { isBasement: false })).toBe(false);
  });

  it("allows completion if target coordinates are unset (legacy/migration tolerance)", () => {
    expect(isWithinRadius(28.62, 77.36, 0, 0, 100)).toBe(true);
  });
});

describe("Multi-Channel Notification Dispatcher & Deduplication Engine", () => {
  it("dispatches booking confirmed notification to customer", async () => {
    const res = await notifyBookingConfirmed({
      id: 101,
      customerId: 5,
      customerName: "Rahul Sharma",
      serviceName: "Premium Exterior Wash",
      serviceType: "car_wash",
      scheduledDate: "2026-11-15",
      companyId: 1,
      branchId: 10,
    });

    expect(res.skipped).toBe(false);
    expect(res.results.some(r => r.channel === "in_app" && r.status === "sent")).toBe(true);
  });

  it("deduplicates subsequent notifications with the same dedupeKey", async () => {
    // First dispatch
    const first = await dispatchNotification({
      template: "booking_confirmed",
      customerId: 5,
      vars: { customerName: "Rahul", serviceName: "Wash", scheduledDate: "2026-11-15" },
      dedupeKey: "unique-booking-101-dedupe-test",
    });
    expect(first.skipped).toBe(false);

    // Second dispatch with same key
    const second = await dispatchNotification({
      template: "booking_confirmed",
      customerId: 5,
      vars: { customerName: "Rahul", serviceName: "Wash", scheduledDate: "2026-11-15" },
      dedupeKey: "unique-booking-101-dedupe-test",
    });
    expect(second.skipped).toBe(true);
    expect(second.reason).toBe("duplicate");
  });

  it("dispatches staff assigned notifications with society and parking bay details", async () => {
    await expect(notifyStaffAssigned({
      staffId: 12,
      staffName: "Amit Kumar",
      customerId: 5,
      customerName: "Rahul Sharma",
      serviceName: "Daily Car Cleaning",
      scheduledDate: "2026-11-13",
      societyName: "Gaur City 2",
      parkingBay: "B2 / P-42",
      bookingId: 202,
      companyId: 1,
      branchId: 10,
    })).resolves.not.toThrow();
  });

  it("dispatches visit completed notification to customer with vehicle and society context", async () => {
    const res = await notifyVisitCompleted({
      customerId: 5,
      customerName: "Rahul Sharma",
      vehicleNumber: "UP 32 AB 1234",
      societyName: "Gaur City 2",
      visitType: "cleaning",
      visitId: 501,
      companyId: 1,
    });

    expect(res).toBeDefined();
  });

  it("dispatches car not available notifications to both customer and admin", async () => {
    await expect(notifyCarNotAvailable({
      customerId: 5,
      customerName: "Rahul Sharma",
      staffName: "Amit Kumar",
      vehicleNumber: "UP 32 AB 1234",
      societyName: "Gaur City 2",
      subscriptionId: 77,
      visitId: 502,
      companyId: 1,
    })).resolves.not.toThrow();
  });
});
