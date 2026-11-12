import {
  db,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  dcmsVisitFeedbackTable,
  complaintsTable,
  staffTable,
  citiesTable,
  branchesTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray, gte, lte, isNotNull } from "drizzle-orm";

export type QualityAnalyticsFilter = {
  cityId?: number;
  branchId?: number;
  startDate?: string;
  endDate?: string;
};

export async function getServiceQualityAnalytics(filter: QualityAnalyticsFilter) {
  const visitConditions = [];
  const subConditions = [];
  const complaintConditions = [];
  const feedbackConditions = [];

  if (filter.startDate) {
    visitConditions.push(gte(dcmsVisitsTable.visitDate, filter.startDate));
    complaintConditions.push(gte(complaintsTable.createdAt, new Date(filter.startDate)));
  }
  if (filter.endDate) {
    visitConditions.push(lte(dcmsVisitsTable.visitDate, filter.endDate));
    complaintConditions.push(lte(complaintsTable.createdAt, new Date(filter.endDate)));
  }
  if (filter.cityId) {
    subConditions.push(eq(dcmsSubscriptionsTable.cityId, filter.cityId));
    complaintConditions.push(eq(complaintsTable.cityId, filter.cityId));
    feedbackConditions.push(eq(dcmsVisitFeedbackTable.cityId, filter.cityId));
  }
  if (filter.branchId) {
    subConditions.push(eq(dcmsSubscriptionsTable.branchId, filter.branchId));
    complaintConditions.push(eq(complaintsTable.branchId, filter.branchId));
    feedbackConditions.push(eq(dcmsVisitFeedbackTable.branchId, filter.branchId));
  }

  // 1. Visit Metrics
  const [visitStats] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${dcmsVisitsTable.status} = 'completed')`,
      cna: sql<number>`count(*) filter (where ${dcmsVisitsTable.status} = 'car_not_available')`,
      rejected: sql<number>`count(*) filter (where ${dcmsVisitsTable.status} = 'rejected')`,
    })
    .from(dcmsVisitsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(...visitConditions, ...subConditions));

  const totalVisits = Number(visitStats?.total ?? 0);
  const completedVisits = Number(visitStats?.completed ?? 0);
  const cnaVisits = Number(visitStats?.cna ?? 0);
  const missedVisits = Number(visitStats?.rejected ?? 0);

  const completionRate = totalVisits > 0 ? Math.round((completedVisits / totalVisits) * 1000) / 10 : 0;
  const cnaRate = totalVisits > 0 ? Math.round((cnaVisits / totalVisits) * 1000) / 10 : 0;
  const missedRate = totalVisits > 0 ? Math.round((missedVisits / totalVisits) * 1000) / 10 : 0;

  // 2. Complaint & SLA Metrics
  const [complaintStats] = await db
    .select({
      total: sql<number>`count(*)`,
      resolved: sql<number>`count(*) filter (where ${complaintsTable.status} in ('resolved', 'closed'))`,
      recleanCount: sql<number>`count(*) filter (where ${complaintsTable.type} = 'reclean')`,
      breachedCount: sql<number>`count(*) filter (where ${complaintsTable.slaStatus} = 'breached')`,
      urgentCount: sql<number>`count(*) filter (where ${complaintsTable.priority} = 'urgent')`,
      avgResolutionHours: sql<number>`avg(extract(epoch from (${complaintsTable.resolvedAt} - ${complaintsTable.createdAt})) / 3600) filter (where ${complaintsTable.resolvedAt} is not null)`,
    })
    .from(complaintsTable)
    .where(complaintConditions.length ? and(...complaintConditions) : undefined);

  const totalComplaints = Number(complaintStats?.total ?? 0);
  const resolvedComplaints = Number(complaintStats?.resolved ?? 0);
  const recleanCount = Number(complaintStats?.recleanCount ?? 0);
  const breachedCount = Number(complaintStats?.breachedCount ?? 0);
  const complaintsPer100Visits =
    completedVisits > 0 ? Math.round((totalComplaints / completedVisits) * 1000) / 10 : 0;
  const recleanRate =
    completedVisits > 0 ? Math.round((recleanCount / completedVisits) * 1000) / 10 : 0;

  const slaComplianceRate =
    resolvedComplaints > 0
      ? Math.round(((resolvedComplaints - breachedCount) / resolvedComplaints) * 1000) / 10
      : 100;
  const avgResolutionHours =
    complaintStats?.avgResolutionHours != null
      ? Math.round(Number(complaintStats.avgResolutionHours) * 10) / 10
      : 0;

  // 3. Customer Ratings & Distribution
  const [feedbackSummary] = await db
    .select({
      count: sql<number>`count(*)`,
      avgScore: sql<number>`avg(${dcmsVisitFeedbackTable.ratingScore})`,
      fiveStar: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.ratingScore} = 5)`,
      fourStar: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.ratingScore} = 4)`,
      threeStar: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.ratingScore} = 3)`,
      twoStar: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.ratingScore} = 2)`,
      oneStar: sql<number>`count(*) filter (where ${dcmsVisitFeedbackTable.ratingScore} = 1)`,
    })
    .from(dcmsVisitFeedbackTable)
    .where(feedbackConditions.length ? and(...feedbackConditions) : undefined);

  const ratingCount = Number(feedbackSummary?.count ?? 0);
  const ratingAverage =
    feedbackSummary?.avgScore != null
      ? Math.round(Number(feedbackSummary.avgScore) * 10) / 10
      : 5.0;

  const ratingDistribution = {
    5: Number(feedbackSummary?.fiveStar ?? 0),
    4: Number(feedbackSummary?.fourStar ?? 0),
    3: Number(feedbackSummary?.threeStar ?? 0),
    2: Number(feedbackSummary?.twoStar ?? 0),
    1: Number(feedbackSummary?.oneStar ?? 0),
  };

  // 4. Staff Quality Scorecard
  const staffRows = await db
    .select({
      staffId: staffTable.id,
      staffName: staffTable.name,
      staffPhone: staffTable.phone,
      totalVisits: sql<number>`count(${dcmsVisitsTable.id})`,
      completedVisits: sql<number>`count(${dcmsVisitsTable.id}) filter (where ${dcmsVisitsTable.status} = 'completed')`,
      cnaVisits: sql<number>`count(${dcmsVisitsTable.id}) filter (where ${dcmsVisitsTable.status} = 'car_not_available')`,
      avgRating: sql<number>`avg(${dcmsVisitFeedbackTable.ratingScore})`,
      feedbackCount: sql<number>`count(${dcmsVisitFeedbackTable.id})`,
    })
    .from(staffTable)
    .leftJoin(dcmsVisitsTable, eq(staffTable.id, dcmsVisitsTable.staffId))
    .leftJoin(dcmsVisitFeedbackTable, eq(dcmsVisitsTable.id, dcmsVisitFeedbackTable.visitId))
    .groupBy(staffTable.id, staffTable.name, staffTable.phone)
    .orderBy(desc(sql`count(${dcmsVisitsTable.id})`))
    .limit(20);

  const staffScorecard = staffRows.map((s) => {
    const assigned = Number(s.totalVisits ?? 0);
    const completed = Number(s.completedVisits ?? 0);
    const cna = Number(s.cnaVisits ?? 0);
    const rate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
    // Productivity index accounting for CNA visits: (completed + cna * 0.5) / assigned
    const productivityIndex = assigned > 0 ? Math.min(100, Math.round(((completed + cna * 0.5) / assigned) * 100)) : 100;

    return {
      staffId: s.staffId,
      name: s.staffName,
      phone: s.staffPhone,
      assignedVisits: assigned,
      completedVisits: completed,
      cnaVisits: cna,
      completionRate: rate,
      productivityIndex,
      avgRating: s.avgRating != null ? Math.round(Number(s.avgRating) * 10) / 10 : null,
      feedbackCount: Number(s.feedbackCount ?? 0),
    };
  });

  // 5. Subscription Retention & Churn
  const [subStats] = await db
    .select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${dcmsSubscriptionsTable.status} = 'active')`,
      paused: sql<number>`count(*) filter (where ${dcmsSubscriptionsTable.status} = 'paused')`,
      completed: sql<number>`count(*) filter (where ${dcmsSubscriptionsTable.status} = 'completed')`,
      cancelled: sql<number>`count(*) filter (where ${dcmsSubscriptionsTable.status} = 'cancelled')`,
      expiringCount: sql<number>`count(*) filter (where ${dcmsSubscriptionsTable.status} = 'active' and ${dcmsSubscriptionsTable.remainingCleanings} <= 3)`,
    })
    .from(dcmsSubscriptionsTable)
    .where(subConditions.length ? and(...subConditions) : undefined);

  const totalSubs = Number(subStats?.total ?? 0);
  const activeSubs = Number(subStats?.active ?? 0);
  const pausedSubs = Number(subStats?.paused ?? 0);
  const cancelledSubs = Number(subStats?.cancelled ?? 0);
  const completedSubs = Number(subStats?.completed ?? 0);
  const expiringCount = Number(subStats?.expiringCount ?? 0);

  const churnRate = totalSubs > 0 ? Math.round((cancelledSubs / totalSubs) * 1000) / 10 : 0;
  const retentionRate = totalSubs > 0 ? Math.round(((activeSubs + pausedSubs + completedSubs) / totalSubs) * 1000) / 10 : 100;

  // Cancellation reasons
  const cancellationReasonRows = await db
    .select({
      reason: dcmsSubscriptionsTable.cancellationReason,
      count: sql<number>`count(*)`,
    })
    .from(dcmsSubscriptionsTable)
    .where(and(eq(dcmsSubscriptionsTable.status, "cancelled"), isNotNull(dcmsSubscriptionsTable.cancellationReason)))
    .groupBy(dcmsSubscriptionsTable.cancellationReason);

  const cancellationReasons = cancellationReasonRows.map((r) => ({
    reason: r.reason || "other",
    count: Number(r.count),
  }));

  return {
    operational: {
      totalVisits,
      completedVisits,
      cnaVisits,
      missedVisits,
      completionRate,
      cnaRate,
      missedRate,
      recleanRate,
      recleanCount,
      complaintsPer100Visits,
      totalComplaints,
      slaComplianceRate,
      avgResolutionHours,
    },
    ratings: {
      average: ratingAverage,
      totalCount: ratingCount,
      distribution: ratingDistribution,
    },
    retention: {
      totalSubscriptions: totalSubs,
      activeSubscriptions: activeSubs,
      pausedSubscriptions: pausedSubs,
      cancelledSubscriptions: cancelledSubs,
      completedSubscriptions: completedSubs,
      retentionRate,
      churnRate,
      expiringCount,
      cancellationReasons,
    },
    staffScorecard,
  };
}
