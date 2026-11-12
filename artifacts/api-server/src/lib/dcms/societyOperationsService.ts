import {
  db,
  residentialSocietiesTable,
  citiesTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  dcmsStaffAssignmentsTable,
  dcmsOperationalExceptionsTable,
  staffTable,
} from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { todayStrInIST } from "./dateUtils";

export type SocietyOperationsSummary = {
  totalSocieties: number;
  totalActiveSubscriptions: number;
  totalCompletedToday: number;
  totalCarNotAvailableToday: number;
  totalPendingToday: number;
  overallCompletionPercentage: number;
  totalOpenExceptions: number;
};

export type StaffOperationalBreakdown = {
  staffId: number;
  staffName: string;
  assignedCount: number;
  completedCount: number;
};

export type SocietyDailyOperationsRow = {
  societyId: number;
  societyName: string;
  societyCode: string;
  cityId: number;
  cityName: string;
  totalTowers: number;
  activeSubscriptionsCount: number;
  completedTodayCount: number;
  carNotAvailableTodayCount: number;
  pendingTodayCount: number;
  completionPercentage: number;
  openExceptionsCount: number;
  assignedStaff: StaffOperationalBreakdown[];
};

export type SocietyDailyOperationsResult = {
  date: string;
  cityId?: number;
  summary: SocietyOperationsSummary;
  societies: SocietyDailyOperationsRow[];
};

export async function getSocietyDailyOperations(
  dateStr?: string,
  cityId?: number,
): Promise<SocietyDailyOperationsResult> {
  const targetDate = dateStr || todayStrInIST();

  const societyConditions = [eq(residentialSocietiesTable.isActive, true)];
  if (cityId) {
    societyConditions.push(eq(residentialSocietiesTable.cityId, cityId));
  }

  const societies = await db
    .select({
      id: residentialSocietiesTable.id,
      name: residentialSocietiesTable.name,
      code: residentialSocietiesTable.code,
      cityId: residentialSocietiesTable.cityId,
      cityName: citiesTable.name,
      totalTowers: residentialSocietiesTable.totalTowers,
    })
    .from(residentialSocietiesTable)
    .leftJoin(citiesTable, eq(residentialSocietiesTable.cityId, citiesTable.id))
    .where(and(...societyConditions))
    .orderBy(residentialSocietiesTable.name);

  if (societies.length === 0) {
    return {
      date: targetDate,
      cityId,
      summary: {
        totalSocieties: 0,
        totalActiveSubscriptions: 0,
        totalCompletedToday: 0,
        totalCarNotAvailableToday: 0,
        totalPendingToday: 0,
        overallCompletionPercentage: 0,
        totalOpenExceptions: 0,
      },
      societies: [],
    };
  }

  const societyIds = societies.map((s) => s.id);

  // 1. Fetch active subscriptions for these societies
  const subscriptions = await db
    .select({
      id: dcmsSubscriptionsTable.id,
      societyId: dcmsSubscriptionsTable.societyId,
      vehicleId: dcmsSubscriptionsTable.vehicleId,
    })
    .from(dcmsSubscriptionsTable)
    .where(
      and(
        inArray(dcmsSubscriptionsTable.societyId, societyIds),
        eq(dcmsSubscriptionsTable.status, "active"),
      ),
    );

  const subIds = subscriptions.map((s) => s.id);

  // 2. Fetch visits on targetDate for these subscriptions
  const visits =
    subIds.length > 0
      ? await db
          .select({
            id: dcmsVisitsTable.id,
            subscriptionId: dcmsVisitsTable.subscriptionId,
            status: dcmsVisitsTable.status,
            visitType: dcmsVisitsTable.visitType,
            staffId: dcmsVisitsTable.staffId,
          })
          .from(dcmsVisitsTable)
          .where(
            and(
              inArray(dcmsVisitsTable.subscriptionId, subIds),
              eq(dcmsVisitsTable.visitDate, targetDate),
            ),
          )
      : [];

  // 3. Fetch active staff assignments for these subscriptions
  const staffAssignments =
    subIds.length > 0
      ? await db
          .select({
            subscriptionId: dcmsStaffAssignmentsTable.subscriptionId,
            staffId: dcmsStaffAssignmentsTable.staffId,
            staffName: staffTable.name,
          })
          .from(dcmsStaffAssignmentsTable)
          .innerJoin(staffTable, eq(dcmsStaffAssignmentsTable.staffId, staffTable.id))
          .where(
            and(
              inArray(dcmsStaffAssignmentsTable.subscriptionId, subIds),
              eq(dcmsStaffAssignmentsTable.isActive, true),
            ),
          )
      : [];

  // 4. Fetch open exceptions for these societies
  const exceptions = await db
    .select({
      id: dcmsOperationalExceptionsTable.id,
      societyId: dcmsOperationalExceptionsTable.societyId,
      exceptionType: dcmsOperationalExceptionsTable.exceptionType,
      status: dcmsOperationalExceptionsTable.status,
    })
    .from(dcmsOperationalExceptionsTable)
    .where(
      and(
        inArray(dcmsOperationalExceptionsTable.societyId, societyIds),
        eq(dcmsOperationalExceptionsTable.status, "open"),
      ),
    );

  // Index subscriptions by societyId
  const subsBySociety = new Map<number, number[]>();
  const subToSociety = new Map<number, number>();
  for (const s of subscriptions) {
    if (!s.societyId) continue;
    const list = subsBySociety.get(s.societyId) ?? [];
    list.push(s.id);
    subsBySociety.set(s.societyId, list);
    subToSociety.set(s.id, s.societyId);
  }

  // Index visits by societyId
  type VisitStats = {
    completed: number;
    carNotAvailable: number;
    staffCompleted: Map<number, number>;
  };
  const visitStatsBySociety = new Map<number, VisitStats>();
  for (const v of visits) {
    const socId = subToSociety.get(v.subscriptionId);
    if (!socId) continue;
    let stat = visitStatsBySociety.get(socId);
    if (!stat) {
      stat = { completed: 0, carNotAvailable: 0, staffCompleted: new Map() };
      visitStatsBySociety.set(socId, stat);
    }
    if (v.visitType === "cleaning" && v.status === "completed") {
      stat.completed++;
      if (v.staffId) {
        stat.staffCompleted.set(v.staffId, (stat.staffCompleted.get(v.staffId) ?? 0) + 1);
      }
    } else if (v.status === "car_not_available") {
      stat.carNotAvailable++;
    }
  }

  // Index staff assignments by society
  type StaffData = { staffId: number; staffName: string; assignedCount: number };
  const staffBySociety = new Map<number, Map<number, StaffData>>();
  for (const a of staffAssignments) {
    const socId = subToSociety.get(a.subscriptionId);
    if (!socId) continue;
    let socStaffMap = staffBySociety.get(socId);
    if (!socStaffMap) {
      socStaffMap = new Map();
      staffBySociety.set(socId, socStaffMap);
    }
    const existing =
      socStaffMap.get(a.staffId) ?? { staffId: a.staffId, staffName: a.staffName, assignedCount: 0 };
    existing.assignedCount++;
    socStaffMap.set(a.staffId, existing);
  }

  // Index exceptions count by society
  const exceptionsBySociety = new Map<number, number>();
  for (const e of exceptions) {
    if (!e.societyId) continue;
    exceptionsBySociety.set(e.societyId, (exceptionsBySociety.get(e.societyId) ?? 0) + 1);
  }

  // Build rows
  let totalActive = 0;
  let totalCompleted = 0;
  let totalCna = 0;
  let totalPending = 0;
  let totalOpenExc = 0;

  const rows: SocietyDailyOperationsRow[] = [];

  for (const soc of societies) {
    const activeSubs = subsBySociety.get(soc.id)?.length ?? 0;
    const vStat = visitStatsBySociety.get(soc.id);
    const completed = vStat?.completed ?? 0;
    const cna = vStat?.carNotAvailable ?? 0;
    const pending = Math.max(0, activeSubs - completed - cna);
    const pct = activeSubs > 0 ? Math.round((completed / activeSubs) * 100) : 0;
    const openExc = exceptionsBySociety.get(soc.id) ?? 0;

    const socStaffMap = staffBySociety.get(soc.id);
    const staffList: StaffOperationalBreakdown[] = [];
    if (socStaffMap) {
      for (const [stId, data] of socStaffMap.entries()) {
        staffList.push({
          staffId: stId,
          staffName: data.staffName,
          assignedCount: data.assignedCount,
          completedCount: vStat?.staffCompleted.get(stId) ?? 0,
        });
      }
    }

    rows.push({
      societyId: soc.id,
      societyName: soc.name,
      societyCode: soc.code,
      cityId: soc.cityId,
      cityName: soc.cityName ?? "Unknown",
      totalTowers: soc.totalTowers,
      activeSubscriptionsCount: activeSubs,
      completedTodayCount: completed,
      carNotAvailableTodayCount: cna,
      pendingTodayCount: pending,
      completionPercentage: pct,
      openExceptionsCount: openExc,
      assignedStaff: staffList,
    });

    totalActive += activeSubs;
    totalCompleted += completed;
    totalCna += cna;
    totalPending += pending;
    totalOpenExc += openExc;
  }

  const overallPct = totalActive > 0 ? Math.round((totalCompleted / totalActive) * 100) : 0;

  return {
    date: targetDate,
    cityId,
    summary: {
      totalSocieties: societies.length,
      totalActiveSubscriptions: totalActive,
      totalCompletedToday: totalCompleted,
      totalCarNotAvailableToday: totalCna,
      totalPendingToday: totalPending,
      overallCompletionPercentage: overallPct,
      totalOpenExceptions: totalOpenExc,
    },
    societies: rows,
  };
}
