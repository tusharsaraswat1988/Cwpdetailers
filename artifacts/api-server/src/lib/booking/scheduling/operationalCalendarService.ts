import { and, eq, gte, lte, or, desc, sql } from "drizzle-orm";
import {
  db,
  operatingHoursTable,
  operationalClosuresTable,
  type OperatingHours,
  type OperationalClosure,
  type InsertOperationalClosure,
} from "@workspace/db";

export type DayOperatingProfile = {
  isWorkingDay: boolean;
  openTime: string;
  closeTime: string;
  slotStepMinutes: number;
  maxConcurrentSlots: number;
  scopeType: "global" | "city" | "branch" | "default";
};

export type DayClosureInfo = {
  id: number;
  title: string;
  category: string;
  customerReason: string;
  isFullDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  scopeType: string;
  exemptSegments: string[];
};

export type DateEvaluation = {
  date: string;
  isClosed: boolean;
  reason?: string;
  category?: string;
  operatingHours?: DayOperatingProfile;
  closure?: DayClosureInfo;
};

function parseDateDayOfWeek(dateStr: string): number {
  // Parse in local time: YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dateObj = new Date(y!, m! - 1, d!);
  return dateObj.getDay();
}

export class OperationalCalendarService {
  /**
   * Resolve authoritative operating hours for a specific day of week,
   * respecting Branch -> City -> Global hierarchy.
   */
  async getOperatingHoursForDay(params: {
    dayOfWeek: number;
    cityId?: number | null;
    branchId?: number | null;
  }): Promise<DayOperatingProfile> {
    const { dayOfWeek, cityId, branchId } = params;
    const isSunday = dayOfWeek === 0;
    const defaultProfile: DayOperatingProfile = {
      isWorkingDay: !isSunday,
      openTime: "08:00",
      closeTime: "18:00",
      slotStepMinutes: 15,
      maxConcurrentSlots: 8,
      scopeType: "default",
    };

    try {
      // 1. Branch specific override
      if (branchId != null) {
        const rows = await db
          .select()
          .from(operatingHoursTable)
          .where(
            and(
              eq(operatingHoursTable.scopeType, "branch"),
              eq(operatingHoursTable.branchId, branchId),
              eq(operatingHoursTable.dayOfWeek, dayOfWeek),
            ),
          )
          .limit(1);

        const branchHours = Array.isArray(rows) ? rows[0] : null;
        if (branchHours) {
          return {
            isWorkingDay: branchHours.isWorkingDay,
            openTime: branchHours.openTime,
            closeTime: branchHours.closeTime,
            slotStepMinutes: branchHours.slotStepMinutes,
            maxConcurrentSlots: branchHours.maxConcurrentSlots,
            scopeType: "branch",
          };
        }
      }

      // 2. City specific override
      if (cityId != null) {
        const rows = await db
          .select()
          .from(operatingHoursTable)
          .where(
            and(
              eq(operatingHoursTable.scopeType, "city"),
              eq(operatingHoursTable.cityId, cityId),
              eq(operatingHoursTable.dayOfWeek, dayOfWeek),
            ),
          )
          .limit(1);

        const cityHours = Array.isArray(rows) ? rows[0] : null;
        if (cityHours) {
          return {
            isWorkingDay: cityHours.isWorkingDay,
            openTime: cityHours.openTime,
            closeTime: cityHours.closeTime,
            slotStepMinutes: cityHours.slotStepMinutes,
            maxConcurrentSlots: cityHours.maxConcurrentSlots,
            scopeType: "city",
          };
        }
      }

      // 3. Global configuration
      const rows = await db
        .select()
        .from(operatingHoursTable)
        .where(
          and(
            eq(operatingHoursTable.scopeType, "global"),
            eq(operatingHoursTable.dayOfWeek, dayOfWeek),
          ),
        )
        .limit(1);

      const globalHours = Array.isArray(rows) ? rows[0] : null;
      if (globalHours) {
        return {
          isWorkingDay: globalHours.isWorkingDay,
          openTime: globalHours.openTime,
          closeTime: globalHours.closeTime,
          slotStepMinutes: globalHours.slotStepMinutes,
          maxConcurrentSlots: globalHours.maxConcurrentSlots,
          scopeType: "global",
        };
      }
    } catch {
      return defaultProfile;
    }

    // 4. In-memory fallback default if DB is unseeded
    return defaultProfile;
  }

  /**
   * Find any operational closure, holiday, or calamity affecting a date.
   * Respects segment exemptions (e.g. Daily Car Cleaning).
   */
  async getClosureForDate(params: {
    date: string;
    cityId?: number | null;
    branchId?: number | null;
    segment?: string;
  }): Promise<DayClosureInfo | null> {
    try {
      const { date, cityId, branchId, segment } = params;

      const conditions = [
        eq(operationalClosuresTable.isActive, true),
        lte(operationalClosuresTable.startDate, date),
        gte(operationalClosuresTable.endDate, date),
      ];

      const scopeConditions = [eq(operationalClosuresTable.scopeType, "global")];
      if (cityId != null) {
        scopeConditions.push(
          and(
            eq(operationalClosuresTable.scopeType, "city"),
            eq(operationalClosuresTable.cityId, cityId),
          )!,
        );
      }
      if (branchId != null) {
        scopeConditions.push(
          and(
            eq(operationalClosuresTable.scopeType, "branch"),
            eq(operationalClosuresTable.branchId, branchId),
          )!,
        );
      }

      conditions.push(or(...scopeConditions)!);

      const closures = await db
        .select()
        .from(operationalClosuresTable)
        .where(and(...conditions))
        .orderBy(
          // Prefer branch > city > global
          sql`CASE 
            WHEN ${operationalClosuresTable.scopeType} = 'branch' THEN 1 
            WHEN ${operationalClosuresTable.scopeType} = 'city' THEN 2 
            ELSE 3 
          END`,
          desc(operationalClosuresTable.id),
        );

      for (const c of closures) {
        const exempt = Array.isArray(c.exemptSegments) ? c.exemptSegments : [];
        if (segment && exempt.includes(segment)) {
          continue; // Segment is exempted from this closure!
        }

        return {
          id: c.id,
          title: c.title,
          category: c.category,
          customerReason: c.customerReason,
          isFullDay: c.isFullDay,
          startTime: c.startTime,
          endTime: c.endTime,
          scopeType: c.scopeType,
          exemptSegments: exempt,
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Evaluate complete date availability and customer messaging.
   */
  async evaluateDate(params: {
    date: string;
    cityId?: number | null;
    branchId?: number | null;
    segment?: string;
  }): Promise<DateEvaluation> {
    const dayOfWeek = parseDateDayOfWeek(params.date);
    const [closure, operatingHours] = await Promise.all([
      this.getClosureForDate(params),
      this.getOperatingHoursForDay({
        dayOfWeek,
        cityId: params.cityId,
        branchId: params.branchId,
      }),
    ]);

    if (closure && closure.isFullDay) {
      return {
        date: params.date,
        isClosed: true,
        reason: closure.customerReason,
        category: closure.category,
        operatingHours,
        closure,
      };
    }

    if (!operatingHours.isWorkingDay) {
      return {
        date: params.date,
        isClosed: true,
        reason: "Weekly off",
        category: "weekly_off",
        operatingHours,
        closure: closure ?? undefined,
      };
    }

    return {
      date: params.date,
      isClosed: false,
      operatingHours,
      closure: closure ?? undefined,
    };
  }

  // ─── Admin Management Methods ──────────────────────────────────────────────

  async listOperatingHours(params: {
    scopeType?: string;
    cityId?: number | null;
    branchId?: number | null;
  }): Promise<OperatingHours[]> {
    const conditions = [];
    if (params.scopeType) {
      conditions.push(eq(operatingHoursTable.scopeType, params.scopeType));
    }
    if (params.cityId != null) {
      conditions.push(eq(operatingHoursTable.cityId, params.cityId));
    }
    if (params.branchId != null) {
      conditions.push(eq(operatingHoursTable.branchId, params.branchId));
    }

    return db
      .select()
      .from(operatingHoursTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(operatingHoursTable.dayOfWeek);
  }

  async upsertOperatingHours(input: {
    scopeType: "global" | "city" | "branch";
    cityId?: number | null;
    branchId?: number | null;
    dayOfWeek: number;
    isWorkingDay: boolean;
    openTime: string;
    closeTime: string;
    slotStepMinutes?: number;
    maxConcurrentSlots?: number;
  }): Promise<OperatingHours> {
    const conditions = [
      eq(operatingHoursTable.scopeType, input.scopeType),
      eq(operatingHoursTable.dayOfWeek, input.dayOfWeek),
    ];
    if (input.cityId != null) {
      conditions.push(eq(operatingHoursTable.cityId, input.cityId));
    }
    if (input.branchId != null) {
      conditions.push(eq(operatingHoursTable.branchId, input.branchId));
    }

    const [existing] = await db
      .select()
      .from(operatingHoursTable)
      .where(and(...conditions))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(operatingHoursTable)
        .set({
          isWorkingDay: input.isWorkingDay,
          openTime: input.openTime,
          closeTime: input.closeTime,
          slotStepMinutes: input.slotStepMinutes ?? existing.slotStepMinutes,
          maxConcurrentSlots: input.maxConcurrentSlots ?? existing.maxConcurrentSlots,
          updatedAt: new Date(),
        })
        .where(eq(operatingHoursTable.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db
      .insert(operatingHoursTable)
      .values({
        scopeType: input.scopeType,
        cityId: input.cityId ?? null,
        branchId: input.branchId ?? null,
        dayOfWeek: input.dayOfWeek,
        isWorkingDay: input.isWorkingDay,
        openTime: input.openTime,
        closeTime: input.closeTime,
        slotStepMinutes: input.slotStepMinutes ?? 15,
        maxConcurrentSlots: input.maxConcurrentSlots ?? 8,
      })
      .returning();
    return created!;
  }

  async listClosures(params?: {
    cityId?: number | null;
    branchId?: number | null;
    category?: string;
    includePast?: boolean;
  }): Promise<OperationalClosure[]> {
    const conditions = [];
    if (params?.cityId != null) {
      conditions.push(
        or(
          eq(operationalClosuresTable.scopeType, "global"),
          and(
            eq(operationalClosuresTable.scopeType, "city"),
            eq(operationalClosuresTable.cityId, params.cityId),
          ),
        )!,
      );
    }
    if (params?.branchId != null) {
      conditions.push(
        or(
          eq(operationalClosuresTable.scopeType, "global"),
          and(
            eq(operationalClosuresTable.scopeType, "branch"),
            eq(operationalClosuresTable.branchId, params.branchId),
          ),
        )!,
      );
    }
    if (params?.category) {
      conditions.push(eq(operationalClosuresTable.category, params.category));
    }
    if (!params?.includePast) {
      const today = new Date().toISOString().split("T")[0]!;
      conditions.push(gte(operationalClosuresTable.endDate, today));
    }

    return db
      .select()
      .from(operationalClosuresTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(operationalClosuresTable.startDate), desc(operationalClosuresTable.id));
  }

  async createClosure(
    input: InsertOperationalClosure,
  ): Promise<OperationalClosure> {
    const [created] = await db
      .insert(operationalClosuresTable)
      .values(input)
      .returning();
    return created!;
  }

  async updateClosure(
    id: number,
    input: Partial<InsertOperationalClosure>,
  ): Promise<OperationalClosure | null> {
    const [updated] = await db
      .update(operationalClosuresTable)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(operationalClosuresTable.id, id))
      .returning();
    return updated ?? null;
  }

  async deleteClosure(id: number): Promise<boolean> {
    const result = await db
      .delete(operationalClosuresTable)
      .where(eq(operationalClosuresTable.id, id))
      .returning();
    return result.length > 0;
  }
}

export const operationalCalendarService = new OperationalCalendarService();
