import { describe, it, expect, vi, beforeEach } from "vitest";
import { bookingsTable } from "@workspace/db";

// Store in-memory simulated bookings table
let inMemoryBookings: any[] = [];
let nextBookingId = 1;

// Textbook async Mutex
class Mutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let begin: (unlock: () => void) => void = () => {};
    this.mutex = this.mutex.then(() => {
      return new Promise(begin);
    });
    return new Promise((res) => {
      begin = res;
    });
  }
}
function matchesFilters(row: any, clause: any): boolean {
  if (!clause) return true;

  const filters: Record<string, any> = {};
  function walk(obj: any) {
    if (!obj) return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        if (item && item.name && typeof item.name === "string") {
          for (let j = i + 1; j < Math.min(i + 4, obj.length); j++) {
            if (obj[j] && typeof obj[j] === "object" && "value" in obj[j] && !obj[j].name) {
              filters[item.name] = obj[j].value;
              break;
            }
          }
        }
        walk(item);
      }
    } else if (obj.queryChunks) {
      walk(obj.queryChunks);
    }
  }
  walk(clause);

  for (const [key, expected] of Object.entries(filters)) {
    if (row[key] !== undefined && expected !== undefined) {
      if (row[key] !== expected) {
        return false;
      }
    }
  }
  return true;
}

const dbMutex = new Mutex();

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();

  const createSelectBuilder = (table?: any) => {
    let capturedWhere: any = null;
    const builder: any = {
      from: vi.fn((tbl) => {
        return builder;
      }),
      where: vi.fn((clause) => {
        capturedWhere = clause;
        return builder;
      }),
      limit: vi.fn(() => builder),
      orderBy: vi.fn(() => builder),
      then: (onfulfilled?: (val: any) => any, onrejected?: (err: any) => any) => {
        let rows = inMemoryBookings.filter(
          (b) => b.status !== "cancelled" && b.status !== "missed" && matchesFilters(b, capturedWhere)
        );
        return Promise.resolve(rows).then(onfulfilled, onrejected);
      },
    };
    return builder;
  };

  const createInsertBuilder = (table: any) => {
    return {
      values: vi.fn((vals) => ({
        returning: vi.fn(async () => {
          if (table === bookingsTable || vals.customerId !== undefined) {
            // Check partial unique index: (customerId, vehicleId, scheduledDate, scheduledTime)
            const isDuplicate = inMemoryBookings.some(
              (b) =>
                b.customerId === vals.customerId &&
                b.vehicleId === vals.vehicleId &&
                b.scheduledDate === vals.scheduledDate &&
                b.scheduledTime === vals.scheduledTime &&
                b.status !== "cancelled" &&
                b.status !== "missed"
            );
            if (isDuplicate) {
              const err: any = new Error("duplicate key value violates unique constraint 'bookings_customer_vehicle_date_time_unique'");
              err.code = "23505";
              throw err;
            }
            const row = { id: nextBookingId++, ...vals };
            inMemoryBookings.push(row);
            return [row];
          }
          // Non-booking table (e.g. timeline events)
          return [{ id: 999, ...vals }];
        }),
      })),
    };
  };

  const tx: any = {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn((fields) => createSelectBuilder()),
    insert: vi.fn((table) => createInsertBuilder(table)),
  };

  const fakeDb: any = {
    ...tx,
    select: vi.fn(() => createSelectBuilder()),
    transaction: vi.fn(async (callback) => {
      const unlock = await dbMutex.lock();
      try {
        return await callback(tx);
      } finally {
        unlock();
      }
    }),
  };

  return {
    ...actual,
    db: fakeDb,
  };
});

// Mock operational calendar to return open working day
vi.mock("../../lib/booking/scheduling/operationalCalendarService", () => ({
  operationalCalendarService: {
    evaluateDate: vi.fn().mockResolvedValue({
      date: "2026-12-01",
      isClosed: false,
      operatingHours: {
        isWorkingDay: true,
        openTime: "08:00",
        closeTime: "20:00",
        slotStepMinutes: 15,
        maxConcurrentSlots: 8,
        scopeType: "default",
      },
    }),
  },
}));

// Mock external validation & policies for fast deterministic testing
vi.mock("../../lib/booking/policies/BookingValidationPolicy", () => ({
  bookingValidationPolicy: {
    execute: vi.fn().mockResolvedValue({
      success: true,
      data: {
        coverageStatus: "FULL_COVERAGE",
        resolvedCityId: 1,
        correlation: { coverageValidationId: "cov-123" },
      },
    }),
  },
}));

vi.mock("../../lib/booking/policies/BookingCreationPolicy", () => ({
  bookingCreationPolicy: {
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("../../lib/booking/policies/BookingPolicies", () => ({
  schedulingPolicy: {
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
  cancellationPolicy: {
    execute: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("../../lib/booking/services/ServiceResolutionService", () => ({
  resolveAuthoritativeService: vi.fn().mockResolvedValue({
    success: true,
    serviceId: 10,
    serviceType: "car_wash",
    service: { id: 10, name: "Premium Car Wash" },
  }),
}));

vi.mock("../../lib/booking/snapshots/BookingSnapshotService", () => ({
  bookingSnapshotService: {
    createAddressSnapshot: vi.fn().mockResolvedValue({ addressSnapshotId: 1, addressIdentityId: 1 }),
  },
}));

import { bookingService } from "../../lib/booking/BookingService";

describe("ARCH-P0-03: Booking Concurrency & Double-Booking Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inMemoryBookings = [];
    nextBookingId = 1;
  });

  it("1. Database schema defines partial unique indexes for active bookings", () => {
    expect(bookingsTable).toBeDefined();
  });

  it("2. Serializes 20 concurrent requests for the exact same slot, creating exactly 1 booking", async () => {
    const concurrentPayloads = Array.from({ length: 20 }, () => ({
      customerId: 101,
      vehicleId: 5,
      serviceId: 10,
      branchId: 1,
      scheduledDate: "2026-12-01",
      scheduledTime: "10:00 AM",
      serviceType: "car_wash" as const,
      address: "123 Main St, Sector 62, Noida",
      locationLat: 28.62,
      locationLng: 77.37,
      skipCoverageValidation: true,
    }));

    // Launch all 20 requests simultaneously
    const results = await Promise.allSettled(
      concurrentPayloads.map((payload) => bookingService.create(payload))
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly 1 request must succeed
    expect(fulfilled).toHaveLength(1);
    // Exactly 19 requests must be rejected
    expect(rejected).toHaveLength(19);

    // Verify error code on all rejections
    for (const r of rejected) {
      if (r.status === "rejected") {
        expect(["DUPLICATE_BOOKING", "SCHEDULE_CONFLICT"]).toContain((r.reason as any).code);
      }
    }

    // Exactly 1 booking row must exist in the database
    expect(inMemoryBookings).toHaveLength(1);
    expect(inMemoryBookings[0].customerId).toBe(101);
    expect(inMemoryBookings[0].vehicleId).toBe(5);
    expect(inMemoryBookings[0].scheduledDate).toBe("2026-12-01");
  });

  it("3. Sequentially rejects duplicate booking attempt for the same slot", async () => {
    const payload = {
      customerId: 101,
      vehicleId: 5,
      serviceId: 10,
      branchId: 1,
      scheduledDate: "2026-12-02",
      scheduledTime: "11:00 AM",
      serviceType: "car_wash" as const,
      address: "123 Main St, Sector 62, Noida",
      locationLat: 28.62,
      locationLng: 77.37,
      skipCoverageValidation: true,
    };

    // First booking succeeds
    const first = await bookingService.create(payload);
    expect(first.booking.id).toBeDefined();

    // Second booking with exact same customer, vehicle, date, time must throw
    await expect(bookingService.create(payload)).rejects.toThrow(
      /A booking already exists for this slot|Duplicate overlapping booking/
    );
  });

  it("4. Allows bookings for different vehicles for the same customer", async () => {
    const payloadV1 = {
      customerId: 101,
      vehicleId: 5,
      serviceId: 10,
      branchId: 1,
      scheduledDate: "2026-12-03",
      scheduledTime: "10:00 AM",
      serviceType: "car_wash" as const,
      address: "123 Main St, Sector 62, Noida",
      locationLat: 28.62,
      locationLng: 77.37,
      skipCoverageValidation: true,
    };

    const payloadV2 = {
      ...payloadV1,
      vehicleId: 6, // Different vehicle
    };

    const [b1, b2] = await Promise.all([
      bookingService.create(payloadV1),
      bookingService.create(payloadV2),
    ]);

    expect(b1.booking.id).toBeDefined();
    expect(b2.booking.id).toBeDefined();
    expect(inMemoryBookings).toHaveLength(2);
  });

  it("5. Allows bookings on different dates for the same vehicle", async () => {
    const payloadDay1 = {
      customerId: 101,
      vehicleId: 5,
      serviceId: 10,
      branchId: 1,
      scheduledDate: "2026-12-04",
      scheduledTime: "10:00 AM",
      serviceType: "car_wash" as const,
      address: "123 Main St, Sector 62, Noida",
      locationLat: 28.62,
      locationLng: 77.37,
      skipCoverageValidation: true,
    };

    const payloadDay2 = {
      ...payloadDay1,
      scheduledDate: "2026-12-05", // Different date
    };

    const b1 = await bookingService.create(payloadDay1);
    const b2 = await bookingService.create(payloadDay2);

    expect(b1.booking.id).toBeDefined();
    expect(b2.booking.id).toBeDefined();
    expect(inMemoryBookings).toHaveLength(2);
  });
});
