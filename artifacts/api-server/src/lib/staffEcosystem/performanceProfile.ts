import { db } from "@workspace/db";
import { serviceExecutionsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";

export type StaffPerformanceProfile = {
  totalJobs: number;
  completedJobs: number;
  dailyCleaningVisits: number;
  carWashes: number;
  solarJobs: number;
  solarAmcVisits: number;
  averageRating: number;
  complaintsReceived: number;
  lastJobDate: string | null;
};

/** Phase 5.2: staff/rating removed from bookings — use service_executions; rating stubbed at 0. */
export async function buildStaffPerformanceProfile(staffId: number): Promise<StaffPerformanceProfile> {
  const [counts] = await db.select({
    totalJobs: sql<number>`count(*)::int`,
    completedJobs: sql<number>`count(*) filter (where ${serviceExecutionsTable.status} = 'completed')::int`,
    dailyCleaningVisits: sql<number>`count(*) filter (where ${serviceExecutionsTable.status} = 'completed' and ${serviceExecutionsTable.taskType} = 'daily_cleaning')::int`,
    carWashes: sql<number>`count(*) filter (where ${serviceExecutionsTable.status} = 'completed' and ${serviceExecutionsTable.taskType} in ('car_wash', 'one_time_service', 'interior_detailing'))::int`,
    solarJobs: sql<number>`count(*) filter (where ${serviceExecutionsTable.status} = 'completed' and ${serviceExecutionsTable.taskType} = 'solar_cleaning')::int`,
    solarAmcVisits: sql<number>`0::int`,
  }).from(serviceExecutionsTable).where(eq(serviceExecutionsTable.assignedStaffId, staffId));

  const [lastJob] = await db.select({ scheduledDate: serviceExecutionsTable.scheduledDate })
    .from(serviceExecutionsTable)
    .where(and(
      eq(serviceExecutionsTable.assignedStaffId, staffId),
      eq(serviceExecutionsTable.status, "completed"),
    ))
    .orderBy(desc(serviceExecutionsTable.scheduledDate))
    .limit(1);

  return {
    totalJobs: Number(counts?.totalJobs ?? 0),
    completedJobs: Number(counts?.completedJobs ?? 0),
    dailyCleaningVisits: Number(counts?.dailyCleaningVisits ?? 0),
    carWashes: Number(counts?.carWashes ?? 0),
    solarJobs: Number(counts?.solarJobs ?? 0),
    solarAmcVisits: Number(counts?.solarAmcVisits ?? 0),
    averageRating: 0,
    complaintsReceived: 0,
    lastJobDate: lastJob?.scheduledDate ?? null,
  };
}

export type StaffDashboardStats = {
  totalStaff: number;
  averageCompletion: number;
  incompleteProfiles: number;
  pendingVerification: number;
};

export async function buildStaffDashboardStats(companyFilter?: number): Promise<StaffDashboardStats> {
  const { staffTable } = await import("@workspace/db");
  const conditions = companyFilter ? [eq(staffTable.companyId, companyFilter)] : [];
  const where = conditions.length ? and(...conditions) : undefined;

  const [row] = await db.select({
    totalStaff: sql<number>`count(*)::int`,
    averageCompletion: sql<number>`coalesce(avg(${staffTable.profileCompletionPercent}), 0)`,
    incompleteProfiles: sql<number>`count(*) filter (where ${staffTable.profileCompletionPercent} < 100)::int`,
    pendingVerification: sql<number>`count(*) filter (where ${staffTable.verificationStatus} = 'pending')::int`,
  }).from(staffTable).where(where);

  return {
    totalStaff: Number(row?.totalStaff ?? 0),
    averageCompletion: Math.round(Number(row?.averageCompletion ?? 0)),
    incompleteProfiles: Number(row?.incompleteProfiles ?? 0),
    pendingVerification: Number(row?.pendingVerification ?? 0),
  };
}
