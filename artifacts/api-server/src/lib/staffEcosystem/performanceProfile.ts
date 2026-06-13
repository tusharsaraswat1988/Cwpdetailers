import { db } from "@workspace/db";
import { bookingsTable, complaintsTable } from "@workspace/db";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

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

export async function buildStaffPerformanceProfile(staffId: number): Promise<StaffPerformanceProfile> {
  const [counts] = await db.select({
    totalJobs: sql<number>`count(*)::int`,
    completedJobs: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed')::int`,
    dailyCleaningVisits: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed' and ${bookingsTable.serviceType} = 'daily_cleaning')::int`,
    carWashes: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed' and ${bookingsTable.serviceType} in ('car_wash', 'one_time_wash', 'subscription_wash', 'detailing'))::int`,
    solarJobs: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed' and ${bookingsTable.serviceType} = 'solar_cleaning')::int`,
    solarAmcVisits: sql<number>`count(*) filter (where ${bookingsTable.status} = 'completed' and ${bookingsTable.serviceType} = 'solar_cleaning' and ${bookingsTable.notes} ilike '%amc%')::int`,
    averageRating: sql<number>`coalesce(avg(${bookingsTable.rating}) filter (where ${bookingsTable.rating} is not null), 0)`,
  }).from(bookingsTable).where(eq(bookingsTable.staffId, staffId));

  const [lastJob] = await db.select({ scheduledDate: bookingsTable.scheduledDate })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.staffId, staffId), eq(bookingsTable.status, "completed")))
    .orderBy(desc(bookingsTable.scheduledDate))
    .limit(1);

  const staffBookings = await db.select({ id: bookingsTable.id }).from(bookingsTable).where(eq(bookingsTable.staffId, staffId));
  const bookingIds = staffBookings.map((b) => b.id);
  let complaintsReceived = 0;
  if (bookingIds.length > 0) {
    const [complaintCount] = await db.select({ cnt: sql<number>`count(*)::int` })
      .from(complaintsTable)
      .where(inArray(complaintsTable.bookingId, bookingIds));
    complaintsReceived = Number(complaintCount?.cnt ?? 0);
  }

  return {
    totalJobs: Number(counts?.totalJobs ?? 0),
    completedJobs: Number(counts?.completedJobs ?? 0),
    dailyCleaningVisits: Number(counts?.dailyCleaningVisits ?? 0),
    carWashes: Number(counts?.carWashes ?? 0),
    solarJobs: Number(counts?.solarJobs ?? 0),
    solarAmcVisits: Number(counts?.solarAmcVisits ?? 0),
    averageRating: Math.round(Number(counts?.averageRating ?? 0) * 10) / 10,
    complaintsReceived,
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
