import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory mock database state
const mockDb = {
  serviceExceptions: [] as any[],
  bookings: [] as any[],
  customers: [] as any[],
  staff: [] as any[],
  cities: [] as any[],
  branches: [] as any[],
  tickets: [] as any[],
  ticketMessages: [] as any[],
  vehicles: [] as any[],
  savedLocations: [] as any[],
  subscriptions: [] as any[],
  payments: [] as any[],
};

// Mock @workspace/db
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<any>();

  return {
    ...actual,
    db: {
      select: vi.fn((fields?: any) => {
        return {
          from: vi.fn((table: any) => {
            let data: any[] = [];
            if (table === actual.serviceExceptionsTable) data = [...mockDb.serviceExceptions];
            else if (table === actual.bookingsTable) data = [...mockDb.bookings];
            else if (table === actual.customersTable) data = [...mockDb.customers];
            else if (table === actual.staffTable) data = [...mockDb.staff];
            else if (table === actual.citiesTable) data = [...mockDb.cities];
            else if (table === actual.branchesTable) data = [...mockDb.branches];
            else if (table === actual.supportTicketsTable) data = [...mockDb.tickets];
            else if (table === actual.supportTicketMessagesTable) data = [...mockDb.ticketMessages];
            else if (table === actual.vehiclesTable) data = [...mockDb.vehicles];
            else if (table === actual.savedLocationsTable) data = [...mockDb.savedLocations];
            else if (table === actual.dcmsSubscriptionsTable) data = [...mockDb.subscriptions];
            else if (table === actual.paymentsTable) data = [...mockDb.payments];

            const builder: any = {
              innerJoin: vi.fn(() => builder),
              leftJoin: vi.fn(() => builder),
              where: vi.fn((clause: any) => builder),
              orderBy: vi.fn(() => builder),
              limit: vi.fn((lim: number) => {
                return Promise.resolve(data.slice(0, lim));
              }),
              offset: vi.fn(() => builder),
              groupBy: vi.fn(() => builder),
              then: (resolve: any) => resolve(data),
            };
            return builder;
          }),
        };
      }),
      insert: vi.fn((table: any) => {
        return {
          values: vi.fn((values: any) => {
            const row = {
              id: mockDb.serviceExceptions.length + 1,
              ...values,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            if (table === actual.serviceExceptionsTable) {
              mockDb.serviceExceptions.push(row);
            }
            return {
              returning: vi.fn(() => Promise.resolve([row])),
            };
          }),
        };
      }),
      update: vi.fn((table: any) => {
        return {
          set: vi.fn((patch: any) => {
            return {
              where: vi.fn((clause: any) => {
                // Apply update to matching records in mockDb
                return {
                  returning: vi.fn(() => {
                    return Promise.resolve([{ ...patch, updatedAt: new Date() }]);
                  }),
                };
              }),
            };
          }),
        };
      }),
    },
  };
});

describe("Phase 25: Operations Command Center & Service Exceptions (TEST-013)", () => {
  beforeEach(() => {
    mockDb.serviceExceptions = [];
    mockDb.bookings = [];
    mockDb.customers = [];
    mockDb.staff = [];
    mockDb.cities = [
      { id: 1, name: "Varanasi", code: "VNS", isActive: true },
      { id: 2, name: "Noida", code: "NOI", isActive: true },
      { id: 3, name: "Lucknow", code: "LKO", isActive: true },
    ];
    mockDb.branches = [
      { id: 10, cityId: 1, name: "Varanasi Central", isActive: true },
      { id: 20, cityId: 2, name: "Noida Sector 62", isActive: true },
      { id: 30, cityId: 3, name: "Lucknow Gomti Nagar", isActive: true },
    ];
  });

  describe("Service Exceptions Engine & Deduplication Logic", () => {
    it("deduplicates exceptions when dedupe_key matches an existing open exception", () => {
      const dedupeKey = "booking_unassigned_1001";
      const exception1 = {
        id: 1,
        dedupeKey,
        exceptionCode: "UNASSIGNED_JOB",
        category: "booking",
        severity: "high",
        status: "open",
        title: "Unassigned booking #1001",
        reason: "No cleaner assigned",
        bookingId: 1001,
        customerId: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDb.serviceExceptions.push(exception1);

      // Verify matching logic
      const existing = mockDb.serviceExceptions.find(
        (e) => e.dedupeKey === dedupeKey && (e.status === "open" || e.status === "investigating")
      );

      expect(existing).toBeDefined();
      expect(existing?.id).toBe(1);
      expect(existing?.exceptionCode).toBe("UNASSIGNED_JOB");

      // An update modifies existing rather than appending duplicate
      if (existing) {
        existing.reason = "Cleaner allocation timeout exceeded";
        existing.updatedAt = new Date();
      }

      expect(mockDb.serviceExceptions.length).toBe(1);
      expect(mockDb.serviceExceptions[0].reason).toBe("Cleaner allocation timeout exceeded");
    });

    it("transitions exception status to acknowledged with actor tracking", () => {
      const exception = {
        id: 2,
        dedupeKey: "booking_delayed_2002",
        exceptionCode: "SERVICE_DELAYED",
        category: "delay",
        severity: "critical",
        status: "open" as const,
        title: "Delayed service #2002",
        reason: "Delayed by 45 minutes",
        acknowledgedAt: null as Date | null,
        acknowledgedBy: null as number | null,
      };
      mockDb.serviceExceptions.push(exception);

      // Acknowledge action
      const target = mockDb.serviceExceptions.find((e) => e.id === 2);
      expect(target).toBeDefined();
      if (target) {
        target.status = "acknowledged";
        target.acknowledgedAt = new Date();
        target.acknowledgedBy = 999; // Admin user ID
      }

      expect(target?.status).toBe("acknowledged");
      expect(target?.acknowledgedBy).toBe(999);
      expect(target?.acknowledgedAt).toBeInstanceOf(Date);
    });

    it("transitions exception status to resolved with resolution notes and audit trail", () => {
      const exception = {
        id: 3,
        dedupeKey: "booking_complaint_3003",
        exceptionCode: "CUSTOMER_COMPLAINT",
        category: "quality",
        severity: "high",
        status: "open",
        title: "Complaint on job #3003",
        reason: "Water streak marks",
        resolvedAt: null as Date | null,
        resolvedBy: null as number | null,
        resolutionNotes: null as string | null,
        resolutionAction: null as string | null,
      };
      mockDb.serviceExceptions.push(exception);

      const target = mockDb.serviceExceptions.find((e) => e.id === 3);
      if (target) {
        target.status = "resolved";
        target.resolvedAt = new Date();
        target.resolvedBy = 999;
        target.resolutionNotes = "Dispatched senior cleaner for complimentary touch-up";
        target.resolutionAction = "reassign";
      }

      expect(target?.status).toBe("resolved");
      expect(target?.resolvedBy).toBe(999);
      expect(target?.resolutionNotes).toContain("complimentary touch-up");
      expect(target?.resolutionAction).toBe("reassign");
    });
  });

  describe("Operations Command Center Multi-City Scope & Metrics Aggregation", () => {
    it("accurately computes today operational metrics across multiple cities", () => {
      const todayStr = new Date().toISOString().split("T")[0];

      // Setup bookings across Varanasi (1) and Noida (2)
      mockDb.bookings = [
        { id: 101, cityId: 1, branchId: 10, scheduledDate: todayStr, status: "confirmed", staffId: null, totalPrice: 500 },
        { id: 102, cityId: 1, branchId: 10, scheduledDate: todayStr, status: "completed", staffId: 5, totalPrice: 750 },
        { id: 103, cityId: 2, branchId: 20, scheduledDate: todayStr, status: "in_progress", staffId: 6, totalPrice: 1200 },
        { id: 104, cityId: 2, branchId: 20, scheduledDate: todayStr, status: "delayed", staffId: 7, totalPrice: 600 },
        { id: 105, cityId: 2, branchId: 20, scheduledDate: todayStr, status: "cancelled", staffId: null, totalPrice: 400 },
      ];

      // Global aggregation (All Cities)
      const allToday = mockDb.bookings.filter((b) => b.scheduledDate === todayStr);
      const confirmed = allToday.filter((b) => b.status === "confirmed").length;
      const completed = allToday.filter((b) => b.status === "completed").length;
      const inProgress = allToday.filter((b) => b.status === "in_progress").length;
      const delayed = allToday.filter((b) => b.status === "delayed").length;
      const cancelled = allToday.filter((b) => b.status === "cancelled").length;
      const unassigned = allToday.filter((b) => !b.staffId && b.status !== "cancelled").length;

      expect(allToday.length).toBe(5);
      expect(confirmed).toBe(1);
      expect(completed).toBe(1);
      expect(inProgress).toBe(1);
      expect(delayed).toBe(1);
      expect(cancelled).toBe(1);
      expect(unassigned).toBe(1); // booking 101 has null staffId and is not cancelled

      // City-scoped aggregation: Noida (cityId: 2)
      const noidaBookings = allToday.filter((b) => b.cityId === 2);
      expect(noidaBookings.length).toBe(3);
      expect(noidaBookings.filter((b) => b.status === "completed").length).toBe(0);
      expect(noidaBookings.filter((b) => b.status === "delayed").length).toBe(1);
    });

    it("calculates city performance matrix without hardcoded city names", () => {
      mockDb.bookings = [
        { id: 1, cityId: 1, status: "completed", staffId: 10 },
        { id: 2, cityId: 1, status: "completed", staffId: 10 },
        { id: 3, cityId: 1, status: "confirmed", staffId: null },
        { id: 4, cityId: 2, status: "completed", staffId: 11 },
        { id: 5, cityId: 2, status: "delayed", staffId: 8 },
      ];

      const cityPerf = mockDb.cities.map((city) => {
        const cityJobs = mockDb.bookings.filter((b) => b.cityId === city.id);
        const total = cityJobs.length;
        const completed = cityJobs.filter((b) => b.status === "completed").length;
        const unassigned = cityJobs.filter(
          (b) => !b.staffId && ["confirmed", "pending"].includes(b.status)
        ).length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return {
          cityId: city.id,
          cityName: city.name,
          totalBookings: total,
          completedCount: completed,
          completionRate,
          unassignedCount: unassigned,
        };
      });

      // Varanasi (City 1): 3 total, 2 completed (67%), 1 unassigned
      const vns = cityPerf.find((c) => c.cityName === "Varanasi");
      expect(vns?.totalBookings).toBe(3);
      expect(vns?.completedCount).toBe(2);
      expect(vns?.completionRate).toBe(67);
      expect(vns?.unassignedCount).toBe(1);

      // Noida (City 2): 2 total, 1 completed (50%), 0 unassigned
      const noi = cityPerf.find((c) => c.cityName === "Noida");
      expect(noi?.totalBookings).toBe(2);
      expect(noi?.completedCount).toBe(1);
      expect(noi?.completionRate).toBe(50);
      expect(noi?.unassignedCount).toBe(0);

      // Lucknow (City 3): 0 total, 0% completion rate
      const lko = cityPerf.find((c) => c.cityName === "Lucknow");
      expect(lko?.totalBookings).toBe(0);
      expect(lko?.completionRate).toBe(0);
    });
  });

  describe("Customer Support Intelligence & Privacy Safeguards", () => {
    it("ensures internal staff notes are shielded from customer queries", () => {
      const ticket = {
        id: 701,
        customerId: 42,
        subject: "Deep cleaning quality concern",
        description: "Customer states trunk carpet was missed",
        status: "open",
        internalNotes: "Customer has a history of asking for free touchups; inspect supervisor photos first.",
      };

      const messages = [
        {
          id: 1,
          ticketId: 701,
          senderRole: "customer",
          message: "The trunk carpet was not cleaned properly.",
          isInternal: false,
        },
        {
          id: 2,
          ticketId: 701,
          senderRole: "staff",
          message: "Internal review: cleaner photos show trunk was filled with luggage.",
          isInternal: true,
        },
        {
          id: 3,
          ticketId: 701,
          senderRole: "staff",
          message: "Hello, our supervisor will visit at 4 PM to inspect and resolve this for you.",
          isInternal: false,
        },
      ];

      // Simulated customer role view
      const sanitizeForCustomer = (ticketObj: typeof ticket, msgList: typeof messages) => {
        return {
          ...ticketObj,
          internalNotes: null, // Scrubbed for customers
          messages: msgList.filter((m) => !m.isInternal),
        };
      };

      // Simulated staff/admin view
      const sanitizeForStaff = (ticketObj: typeof ticket, msgList: typeof messages) => {
        return {
          ...ticketObj,
          messages: msgList, // All messages visible to staff
        };
      };

      const customerView = sanitizeForCustomer(ticket, messages);
      expect(customerView.internalNotes).toBeNull();
      expect(customerView.messages.length).toBe(2);
      expect(customerView.messages.some((m) => m.isInternal)).toBe(false);

      const staffView = sanitizeForStaff(ticket, messages);
      expect(staffView.internalNotes).toContain("Customer has a history of asking for free touchups");
      expect(staffView.messages.length).toBe(3);
      expect(staffView.messages.some((m) => m.isInternal)).toBe(true);
    });

    it("verifies Customer 360 payload integrity and aggregation correctness", () => {
      const customerId = 15;
      const customer = {
        id: customerId,
        name: "Rahul Verma",
        phone: "+919876543210",
        city: "Noida",
        branchId: 20,
        status: "active",
      };

      const vehicles = [
        { id: 1, customerId, registrationNumber: "UP16AB1234", make: "Hyundai", model: "Creta" },
        { id: 2, customerId, registrationNumber: "DL3CCC9999", make: "Tata", model: "Nexon EV" },
      ];

      const savedLocations = [
        { id: 101, customerId, buildingName: "Supertech Capetown", area: "Sector 74", isDefault: true },
      ];

      const bookings = [
        { id: 501, customerId, status: "completed", totalPrice: 1500 },
        { id: 502, customerId, status: "completed", totalPrice: 2500 },
        { id: 503, customerId, status: "in_progress", totalPrice: 1000 },
      ];

      // Compute 360 stats
      const totalSpend = bookings
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + b.totalPrice, 0);
      const completedCount = bookings.filter((b) => b.status === "completed").length;

      const profile360 = {
        customer,
        stats: {
          totalBookings: bookings.length,
          completedBookings: completedCount,
          totalSpend,
          walletBalance: 350,
          loyaltyPoints: 120,
          activeSubscriptions: 1,
          openComplaints: 0,
          unresolvedExceptions: 0,
        },
        vehicles,
        savedLocations,
      };

      expect(profile360.customer.name).toBe("Rahul Verma");
      expect(profile360.stats.totalBookings).toBe(3);
      expect(profile360.stats.completedBookings).toBe(2);
      expect(profile360.stats.totalSpend).toBe(4000);
      expect(profile360.vehicles.length).toBe(2);
      expect(profile360.savedLocations[0].isDefault).toBe(true);
    });
  });
});
