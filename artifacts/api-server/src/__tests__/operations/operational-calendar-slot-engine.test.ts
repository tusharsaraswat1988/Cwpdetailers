import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  OperationalCalendarService,
} from "../../lib/booking/scheduling/operationalCalendarService";
import {
  generateCandidateStarts,
  resolveTimeWindow,
  windowsOverlap,
} from "../../lib/booking/scheduling/TimeWindow";

// Mock @workspace/db
vi.mock("@workspace/db", () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    operatingHoursTable: {
      id: "id",
      scopeType: "scope_type",
      cityId: "city_id",
      branchId: "branch_id",
      dayOfWeek: "day_of_week",
      isWorkingDay: "is_working_day",
      openTime: "open_time",
      closeTime: "close_time",
      slotStepMinutes: "slot_step_minutes",
      maxConcurrentSlots: "max_concurrent_slots",
    },
    operationalClosuresTable: {
      id: "id",
      title: "title",
      category: "category",
      customerReason: "customer_reason",
      startDate: "start_date",
      endDate: "end_date",
      isFullDay: "is_full_day",
      startTime: "start_time",
      endTime: "end_time",
      scopeType: "scope_type",
      cityId: "city_id",
      branchId: "branch_id",
      exemptSegments: "exempt_segments",
      isActive: "is_active",
    },
    bookingsTable: {
      id: "id",
      scheduledDate: "scheduled_date",
      scheduledTime: "scheduled_time",
      status: "status",
    },
  };
});

import { db } from "@workspace/db";

describe("Dynamic Operational Calendar & Working Hours Engine (OPS-006, OPS-007)", () => {
  let calendarService: OperationalCalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    calendarService = new OperationalCalendarService();
  });

  describe("Operating Hours Resolution Hierarchy", () => {
    it("falls back to default schedule when database has no records", async () => {
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      // Day 0 = Sunday (Weekly off by default)
      const sunday = await calendarService.getOperatingHoursForDay({ dayOfWeek: 0 });
      expect(sunday.isWorkingDay).toBe(false);
      expect(sunday.scopeType).toBe("default");

      // Day 1 = Monday (Working day 08:00 - 18:00)
      const monday = await calendarService.getOperatingHoursForDay({ dayOfWeek: 1 });
      expect(monday.isWorkingDay).toBe(true);
      expect(monday.openTime).toBe("08:00");
      expect(monday.closeTime).toBe("18:00");
      expect(monday.slotStepMinutes).toBe(15);
      expect(monday.maxConcurrentSlots).toBe(8);
    });

    it("prefers City-specific override over Global configuration", async () => {
      // Return custom hours when querying for cityId = 2 (Noida)
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                scopeType: "city",
                cityId: 2,
                dayOfWeek: 0,
                isWorkingDay: true, // Noida operates on Sundays!
                openTime: "07:00",
                closeTime: "20:00",
                slotStepMinutes: 15,
                maxConcurrentSlots: 12,
              },
            ]),
          }),
        }),
      });

      const noidaSunday = await calendarService.getOperatingHoursForDay({
        dayOfWeek: 0,
        cityId: 2,
      });

      expect(noidaSunday.isWorkingDay).toBe(true);
      expect(noidaSunday.openTime).toBe("07:00");
      expect(noidaSunday.closeTime).toBe("20:00");
      expect(noidaSunday.maxConcurrentSlots).toBe(12);
      expect(noidaSunday.scopeType).toBe("city");
    });
  });

  describe("Operational Closures & Customer Messaging", () => {
    it("evaluates declared gazetted govt holiday and blocks full day with reason", async () => {
      // Mock closure query returning Diwali
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: 101,
                title: "Diwali Celebration",
                category: "govt_holiday",
                customerReason: "Closed: Govt declared holiday (Diwali)",
                startDate: "2026-11-01",
                endDate: "2026-11-01",
                isFullDay: true,
                scopeType: "global",
                exemptSegments: ["daily_cleaning"],
                isActive: true,
              },
            ]),
            limit: vi.fn().mockResolvedValue([
              {
                isWorkingDay: true,
                openTime: "08:00",
                closeTime: "18:00",
                slotStepMinutes: 15,
                maxConcurrentSlots: 8,
              },
            ]),
          }),
        }),
      });

      const evalResult = await calendarService.evaluateDate({
        date: "2026-11-01",
        segment: "catalog_services",
      });

      expect(evalResult.isClosed).toBe(true);
      expect(evalResult.category).toBe("govt_holiday");
      expect(evalResult.reason).toBe("Closed: Govt declared holiday (Diwali)");
    });

    it("exempts Daily Car Cleaning segment so morning apartment routes proceed", async () => {
      // Closure has exemptSegments = ["daily_cleaning"]
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              {
                id: 102,
                title: "Heavy Rain / Waterlogging Alert",
                category: "natural_calamity",
                customerReason: "Doorstep washing suspended due to heavy rain alert",
                startDate: "2026-08-15",
                endDate: "2026-08-15",
                isFullDay: true,
                scopeType: "global",
                exemptSegments: ["daily_cleaning"],
                isActive: true,
              },
            ]),
            limit: vi.fn().mockResolvedValue([
              {
                isWorkingDay: true,
                openTime: "08:00",
                closeTime: "18:00",
                slotStepMinutes: 15,
                maxConcurrentSlots: 8,
              },
            ]),
          }),
        }),
      });

      // Daily Car Cleaning check -> Should NOT be closed by this event
      const dcmsEval = await calendarService.evaluateDate({
        date: "2026-08-15",
        segment: "daily_cleaning",
      });
      expect(dcmsEval.isClosed).toBe(false);

      // One-time catalog service check -> Closed!
      const catalogEval = await calendarService.evaluateDate({
        date: "2026-08-15",
        segment: "catalog_services",
      });
      expect(catalogEval.isClosed).toBe(true);
      expect(catalogEval.reason).toBe("Doorstep washing suspended due to heavy rain alert");
    });
  });

  describe("15-Minute Variable Duration Slot Engine (OPS-007)", () => {
    it("generates candidate arrival slots stepping on 15-minute boundaries", () => {
      const candidates = generateCandidateStarts("2026-11-16", {
        fromHour: 8,
        fromMinute: 0,
        toHour: 10,
        toMinute: 0,
        stepMinutes: 15,
      });

      expect(candidates).toEqual([
        "08:00",
        "08:15",
        "08:30",
        "08:45",
        "09:00",
        "09:15",
        "09:30",
        "09:45",
      ]);
    });

    it("calculates service completion window in 15-minute multiples (e.g. 45 min, 120 min)", () => {
      // Doorstep Express Wash (45m) starting at 09:15
      const washWindow = resolveTimeWindow({
        scheduledDate: "2026-11-16",
        scheduledTime: "09:15",
        durationMinutes: 45,
      });

      expect(washWindow.scheduledTime).toBe("09:15");
      expect(washWindow.durationMinutes).toBe(45);
      const endH = washWindow.scheduledEndAt.getHours();
      const endM = washWindow.scheduledEndAt.getMinutes();
      expect(`${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`).toBe("10:00");

      // Interior Detailing (120m) starting at 10:30
      const detailWindow = resolveTimeWindow({
        scheduledDate: "2026-11-16",
        scheduledTime: "10:30",
        durationMinutes: 120,
      });
      expect(detailWindow.durationMinutes).toBe(120);
      const detailEndH = detailWindow.scheduledEndAt.getHours();
      const detailEndM = detailWindow.scheduledEndAt.getMinutes();
      expect(`${String(detailEndH).padStart(2, "0")}:${String(detailEndM).padStart(2, "0")}`).toBe("12:30");
    });

    it("accurately detects half-open interval overlaps between variable jobs", () => {
      const aStart = new Date("2026-11-16T09:15:00");
      const aEnd = new Date("2026-11-16T10:00:00"); // 45 min job [09:15, 10:00)

      // Overlapping candidate: [09:30, 10:15)
      const bStart = new Date("2026-11-16T09:30:00");
      const bEnd = new Date("2026-11-16T10:15:00");
      expect(windowsOverlap(aStart, aEnd, bStart, bEnd)).toBe(true);

      // Adjacent candidate: [10:00, 10:45) -> Does NOT overlap [09:15, 10:00)
      const cStart = new Date("2026-11-16T10:00:00");
      const cEnd = new Date("2026-11-16T10:45:00");
      expect(windowsOverlap(aStart, aEnd, cStart, cEnd)).toBe(false);
    });
  });
});
