import {
  db,
  dcmsVisitsTable,
  dcmsStaffAssignmentsTable,
  dcmsMissedVisitLogsTable,
  dcmsVisitFeedbackTable,
  dcmsSubscriptionsTable,
  staffTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

export type StaffPerformanceRow = {
  staffId: number;
  staffName: string;
  assignedVehicles: number;
  completedVisits: number;
  missedVisits: number;
  rejectedVisits: number;
  completionPercentage: number;
  customerComplaints: number;
  customerRating: number;
};

export async function getStaffPerformanceMetrics(): Promise<{
  staff: StaffPerformanceRow[];
  topPerformers: StaffPerformanceRow[];
  lowestPerformers: StaffPerformanceRow[];
}> {
  const assignments = await db
    .select({
      staffId: dcmsStaffAssignmentsTable.staffId,
      staffName: staffTable.name,
      count: sql<number>`count(distinct ${dcmsStaffAssignmentsTable.subscriptionId})::int`,
    })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(staffTable, eq(dcmsStaffAssignmentsTable.staffId, staffTable.id))
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(
      eq(dcmsStaffAssignmentsTable.isActive, true),
      eq(dcmsSubscriptionsTable.status, "active"),
    ))
    .groupBy(dcmsStaffAssignmentsTable.staffId, staffTable.name);

  const visitStats = await db
    .select({
      staffId: dcmsVisitsTable.staffId,
      completed: sql<number>`count(*) filter (where ${dcmsVisitsTable.status} = 'completed')::int`,
      rejected: sql<number>`count(*) filter (where ${dcmsVisitsTable.status} = 'rejected')::int`,
    })
    .from(dcmsVisitsTable)
    .groupBy(dcmsVisitsTable.staffId);

  const missedByStaff = await db
    .select({
      staffId: dcmsStaffAssignmentsTable.staffId,
      missed: sql<number>`count(distinct ${dcmsMissedVisitLogsTable.id})::int`,
    })
    .from(dcmsMissedVisitLogsTable)
    .innerJoin(dcmsStaffAssignmentsTable, and(
      eq(dcmsMissedVisitLogsTable.subscriptionId, dcmsStaffAssignmentsTable.subscriptionId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    ))
    .groupBy(dcmsStaffAssignmentsTable.staffId);

  const feedbackStats = await db
    .select({
      staffId: dcmsVisitsTable.staffId,
      complaints: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.rating} = 'no')::int`,
      positive: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.rating} = 'yes')::int`,
      total: sql<number>`count(*)::int`,
    })
    .from(dcmsVisitFeedbackTable)
    .innerJoin(dcmsVisitsTable, eq(dcmsVisitFeedbackTable.visitId, dcmsVisitsTable.id))
    .groupBy(dcmsVisitsTable.staffId);

  const assignmentMap = new Map(assignments.map(a => [a.staffId, a]));
  const visitMap = new Map(visitStats.map(v => [v.staffId, v]));
  const missedMap = new Map(missedByStaff.map(m => [m.staffId, m]));
  const feedbackMap = new Map(feedbackStats.map(f => [f.staffId, f]));

  const staffIds = new Set([
    ...assignments.map(a => a.staffId),
    ...visitStats.map(v => v.staffId),
  ]);

  const staff: StaffPerformanceRow[] = [];

  for (const staffId of staffIds) {
    const a = assignmentMap.get(staffId);
    const v = visitMap.get(staffId);
    const m = missedMap.get(staffId);
    const f = feedbackMap.get(staffId);

    const completed = v?.completed ?? 0;
    const rejected = v?.rejected ?? 0;
    const missed = m?.missed ?? 0;
    const total = completed + rejected + missed;
    const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const feedbackTotal = f?.total ?? 0;
    const customerRating = feedbackTotal > 0
      ? Math.round(((f?.positive ?? 0) / feedbackTotal) * 100)
      : 100;

    staff.push({
      staffId,
      staffName: a?.staffName ?? "Unknown",
      assignedVehicles: a?.count ?? 0,
      completedVisits: completed,
      missedVisits: missed,
      rejectedVisits: rejected,
      completionPercentage,
      customerComplaints: f?.complaints ?? 0,
      customerRating,
    });
  }

  staff.sort((a, b) => b.completionPercentage - a.completionPercentage || b.customerRating - a.customerRating);

  return {
    staff,
    topPerformers: staff.slice(0, 5),
    lowestPerformers: [...staff].sort((a, b) => a.completionPercentage - b.completionPercentage).slice(0, 5),
  };
}

export async function getStaffPerformanceDetail(staffId: number) {
  const all = await getStaffPerformanceMetrics();
  return all.staff.find(s => s.staffId === staffId) ?? null;
}
