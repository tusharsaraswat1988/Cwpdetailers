import {
  db,
  bookingsTable,
  customersTable,
  staffTable,
  vehiclesTable,
  solarSitesTable,
  complaintsTable,
  paymentAttemptsTable,
  serviceExceptionsTable,
  dcmsVisitsTable,
  citiesTable,
  branchesTable,
  serviceExecutionsTable,
} from "@workspace/db";
import { eq, and, sql, desc, inArray, isNull, isNotNull, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import { scanAndSyncOperationalExceptions } from "./exceptionService";

export type OperationsCommandCenterSummary = {
  date: string;
  scope: {
    cityId: number | null;
    branchId: number | null;
  };
  metrics: {
    totalBookingsToday: number;
    confirmedBookingsToday: number;
    completedServicesToday: number;
    pendingServicesToday: number;
    cancelledBookingsToday: number;
    delayedServicesToday: number;
    unassignedJobsToday: number;
    openComplaintsCount: number;
    failedPaymentsCount: number;
    activeStaffOnField: number;
  };
  immediateAttention: Array<{
    id: string;
    type: "delayed_service" | "unassigned_job" | "critical_exception" | "sla_urgent" | "payment_failed";
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    scheduledTime?: string;
    customerId?: number | null;
    customerName?: string | null;
    customerPhone?: string | null;
    bookingId?: number | null;
    staffId?: number | null;
    staffName?: string | null;
    cityId?: number | null;
    cityName?: string | null;
    branchId?: number | null;
    branchName?: string | null;
    actionType: "assign" | "reschedule" | "contact_customer" | "contact_staff" | "resolve_exception" | "view_ticket";
  }>;
  servicesBreakdown: {
    scheduled: number;
    assigned: number;
    enRoute: number;
    inProgress: number;
    completed: number;
    delayed: number;
    cancelled: number;
  };
  cityPerformance: Array<{
    cityId: number;
    cityName: string;
    totalBookings: number;
    completedCount: number;
    completionRate: number;
    unassignedCount: number;
    openExceptionsCount: number;
    activeStaffCount: number;
  }>;
  staffNeedingIntervention: Array<{
    staffId: number;
    staffName: string;
    staffPhone: string | null;
    cityId: number | null;
    cityName: string | null;
    branchId: number | null;
    delayedJobsCount: number;
    reportedExceptionsCount: number;
    primaryIssue: string;
  }>;
  recentLiveActivity: Array<{
    id: string;
    timestamp: string;
    event: string;
    entityType: string;
    entityId: number;
    details: string;
  }>;
  lastRefreshedAt: string;
};

export async function getOperationsCommandCenter(params: {
  date?: string;
  cityId?: number;
  branchId?: number;
  autoScan?: boolean;
}): Promise<OperationsCommandCenterSummary> {
  const date = params.date || getTodayIST();

  // Run lightweight background exception sync if requested
  if (params.autoScan !== false) {
    try {
      await scanAndSyncOperationalExceptions({
        cityId: params.cityId,
        branchId: params.branchId,
      });
    } catch {
      // Non-fatal
    }
  }

  // Common filters
  const bookingCityCond = params.cityId ? eq(bookingsTable.cityId, params.cityId) : undefined;
  const bookingBranchCond = params.branchId ? eq(bookingsTable.branchId, params.branchId) : undefined;

  const todayBookingConds: SQL[] = [eq(bookingsTable.scheduledDate, date)];
  if (bookingCityCond) todayBookingConds.push(bookingCityCond);
  if (bookingBranchCond) todayBookingConds.push(bookingBranchCond);

  const todayWhere = and(...todayBookingConds);

  // Time calculations for delayed services
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;

  // 1. Fetch Today's Bookings
  const todayBookings = await db
    .select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      staffId: bookingsTable.assignedStaffId,
      staffName: staffTable.name,
      staffPhone: staffTable.phone,
      serviceType: bookingsTable.serviceType,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
      technicianEnRouteAt: bookingsTable.technicianEnRouteAt,
      startedAt: bookingsTable.startedAt,
      completedAt: bookingsTable.completedAt,
      status: bookingsTable.status,
      cityId: bookingsTable.cityId,
      branchId: bookingsTable.branchId,
    })
    .from(bookingsTable)
    .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
    .leftJoin(staffTable, eq(bookingsTable.assignedStaffId, staffTable.id))
    .where(todayWhere);

  // 2. Aggregate Booking Metrics
  let totalBookingsToday = todayBookings.length;
  let confirmedBookingsToday = 0;
  let completedServicesToday = 0;
  let pendingServicesToday = 0;
  let cancelledBookingsToday = 0;
  let delayedServicesToday = 0;
  let unassignedJobsToday = 0;
  let scheduledCount = 0;
  let assignedCount = 0;
  let enRouteCount = 0;
  let inProgressCount = 0;

  for (const b of todayBookings) {
    const isPastTime = Boolean(b.scheduledTime && b.scheduledTime < currentTimeStr);
    const isCompleted = b.status === "completed";
    const isCancelled = b.status === "cancelled";

    if (b.status === "confirmed" || b.status === "scheduled") confirmedBookingsToday++;
    if (isCompleted) completedServicesToday++;
    if (!isCompleted && !isCancelled) pendingServicesToday++;
    if (isCancelled) cancelledBookingsToday++;

    if (!isCompleted && !isCancelled && isPastTime) {
      delayedServicesToday++;
    }

    if (!b.staffId && !isCancelled && !isCompleted) {
      unassignedJobsToday++;
    }

    if (b.status === "scheduled" || b.status === "draft") scheduledCount++;
    else if (b.status === "assigned" && !b.technicianEnRouteAt) assignedCount++;
    else if (b.technicianEnRouteAt && !b.startedAt) enRouteCount++;
    else if (b.status === "in_progress" || b.startedAt) inProgressCount++;
  }

  // Also include completed DCMS visits today
  const dcmsVisitsToday = await db
    .select({ count: sql<number>`count(*)` })
    .from(dcmsVisitsTable)
    .where(
      and(
        sql`DATE(${dcmsVisitsTable.visitTime}) = ${date}::date`,
        eq(dcmsVisitsTable.status, "completed"),
      ),
    );
  const completedDcmsCount = Number(dcmsVisitsToday[0]?.count ?? 0);
  completedServicesToday += completedDcmsCount;

  // 3. Open Complaints Count
  const complaintConds: SQL[] = [inArray(complaintsTable.status, ["open", "assigned", "in_progress", "awaiting_customer"])];
  if (params.cityId) complaintConds.push(eq(complaintsTable.cityId, params.cityId));
  if (params.branchId) complaintConds.push(eq(complaintsTable.branchId, params.branchId));

  const [openComplaintsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(complaintsTable)
    .where(and(...complaintConds));
  const openComplaintsCount = Number(openComplaintsRow?.count ?? 0);

  // 4. Failed Payments Today
  const [failedPaymentsRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentAttemptsTable)
    .where(
      and(
        sql`DATE(${paymentAttemptsTable.createdAt}) = ${date}::date`,
        eq(paymentAttemptsTable.status, "failed"),
      ),
    );
  const failedPaymentsCount = Number(failedPaymentsRow?.count ?? 0);

  // 5. Active Staff on Field
  const activeStaffSet = new Set<number>();
  todayBookings.forEach((b) => {
    if (b.staffId && b.status !== "cancelled") activeStaffSet.add(b.staffId);
  });
  const activeStaffOnField = activeStaffSet.size;

  // 6. Cities and Branches Master Dictionary
  const [allCities, allBranches] = await Promise.all([
    db.select({ id: citiesTable.id, name: citiesTable.name }).from(citiesTable),
    db.select({ id: branchesTable.id, name: branchesTable.name, cityId: branchesTable.cityId }).from(branchesTable),
  ]);

  const cityNameMap = new Map(allCities.map((c) => [c.id, c.name]));
  const branchNameMap = new Map(allBranches.map((b) => [b.id, b.name]));

  // 7. Immediate Attention Items Queue
  const immediateAttention: OperationsCommandCenterSummary["immediateAttention"] = [];

  // A. Unassigned bookings today
  for (const b of todayBookings) {
    if (!b.staffId && b.status !== "cancelled" && b.status !== "completed") {
      immediateAttention.push({
        id: `unassigned-${b.id}`,
        type: "unassigned_job",
        title: `Unassigned: Booking #${b.id}`,
        description: `${b.serviceType.replace(/_/g, " ")} scheduled for today at ${b.scheduledTime || "Flexible"}. Customer: ${b.customerName || "Customer"}.`,
        severity: "high",
        scheduledTime: b.scheduledTime || undefined,
        bookingId: b.id,
        customerId: b.customerId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        cityId: b.cityId,
        cityName: b.cityId ? cityNameMap.get(b.cityId) : null,
        branchId: b.branchId,
        branchName: b.branchId ? branchNameMap.get(b.branchId) : null,
        actionType: "assign",
      });
    }
  }

  // B. Delayed services
  for (const b of todayBookings) {
    const isPastTime = Boolean(b.scheduledTime && b.scheduledTime < currentTimeStr);
    if (!b.completedAt && b.status !== "completed" && b.status !== "cancelled" && isPastTime) {
      immediateAttention.push({
        id: `delayed-${b.id}`,
        type: "delayed_service",
        title: `Delayed: Booking #${b.id}`,
        description: `Scheduled at ${b.scheduledTime}, currently in '${b.status}'. Assigned to: ${b.staffName || "Unassigned"}.`,
        severity: "critical",
        scheduledTime: b.scheduledTime || undefined,
        bookingId: b.id,
        customerId: b.customerId,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        staffId: b.staffId,
        staffName: b.staffName,
        cityId: b.cityId,
        cityName: b.cityId ? cityNameMap.get(b.cityId) : null,
        branchId: b.branchId,
        branchName: b.branchId ? branchNameMap.get(b.branchId) : null,
        actionType: "reschedule",
      });
    }
  }

  // C. Open High/Critical Service Exceptions
  const openExceptions = await db
    .select({
      id: serviceExceptionsTable.id,
      exceptionCode: serviceExceptionsTable.exceptionCode,
      category: serviceExceptionsTable.category,
      severity: serviceExceptionsTable.severity,
      title: serviceExceptionsTable.title,
      reason: serviceExceptionsTable.reason,
      bookingId: serviceExceptionsTable.bookingId,
      customerId: serviceExceptionsTable.customerId,
      staffId: serviceExceptionsTable.staffId,
      cityId: serviceExceptionsTable.cityId,
      branchId: serviceExceptionsTable.branchId,
    })
    .from(serviceExceptionsTable)
    .where(
      and(
        inArray(serviceExceptionsTable.status, ["open", "investigating"]),
        inArray(serviceExceptionsTable.severity, ["high", "critical"]),
      ),
    )
    .orderBy(desc(serviceExceptionsTable.createdAt))
    .limit(10);

  for (const exp of openExceptions) {
    immediateAttention.push({
      id: `exp-${exp.id}`,
      type: "critical_exception",
      title: `Exception ${exp.exceptionCode}: ${exp.title}`,
      description: exp.reason,
      severity: exp.severity as "high" | "critical",
      bookingId: exp.bookingId,
      customerId: exp.customerId,
      staffId: exp.staffId,
      cityId: exp.cityId,
      cityName: exp.cityId ? cityNameMap.get(exp.cityId) : null,
      branchId: exp.branchId,
      branchName: exp.branchId ? branchNameMap.get(exp.branchId) : null,
      actionType: "resolve_exception",
    });
  }

  // D. Urgent Support Tickets / Approaching Breach
  const urgentTickets = await db
    .select({
      id: complaintsTable.id,
      ticketNumber: complaintsTable.ticketNumber,
      title: complaintsTable.title,
      priority: complaintsTable.priority,
      slaStatus: complaintsTable.slaStatus,
      customerId: complaintsTable.customerId,
      bookingId: complaintsTable.bookingId,
      cityId: complaintsTable.cityId,
      branchId: complaintsTable.branchId,
    })
    .from(complaintsTable)
    .where(
      and(
        inArray(complaintsTable.status, ["open", "assigned", "in_progress"]),
        or(eq(complaintsTable.priority, "urgent"), eq(complaintsTable.slaStatus, "approaching_breach")),
      ),
    )
    .limit(5);

  for (const tkt of urgentTickets) {
    immediateAttention.push({
      id: `ticket-${tkt.id}`,
      type: "sla_urgent",
      title: `Urgent Ticket: ${tkt.ticketNumber || `#${tkt.id}`}`,
      description: `${tkt.title} (SLA: ${tkt.slaStatus || "urgent"})`,
      severity: "critical",
      customerId: tkt.customerId,
      bookingId: tkt.bookingId,
      cityId: tkt.cityId,
      cityName: tkt.cityId ? cityNameMap.get(tkt.cityId) : null,
      branchId: tkt.branchId,
      branchName: tkt.branchId ? branchNameMap.get(tkt.branchId) : null,
      actionType: "view_ticket",
    });
  }

  // Limit immediate attention to top 15 most critical
  const prioritizedAttention = immediateAttention.slice(0, 15);

  // 8. City-Wise Performance Breakdown (Dynamic, non-hardcoded)
  const cityPerformance: OperationsCommandCenterSummary["cityPerformance"] = [];
  const cityBuckets = new Map<
    number,
    { total: number; completed: number; unassigned: number; staff: Set<number> }
  >();

  for (const city of allCities) {
    cityBuckets.set(city.id, { total: 0, completed: 0, unassigned: 0, staff: new Set() });
  }

  for (const b of todayBookings) {
    if (b.cityId && cityBuckets.has(b.cityId)) {
      const bucket = cityBuckets.get(b.cityId)!;
      bucket.total++;
      if (b.status === "completed") bucket.completed++;
      if (!b.staffId && b.status !== "cancelled" && b.status !== "completed") bucket.unassigned++;
      if (b.staffId) bucket.staff.add(b.staffId);
    }
  }

  for (const city of allCities) {
    const bucket = cityBuckets.get(city.id)!;
    const completionRate = bucket.total > 0 ? Math.round((bucket.completed / bucket.total) * 100) : 0;
    cityPerformance.push({
      cityId: city.id,
      cityName: city.name,
      totalBookings: bucket.total,
      completedCount: bucket.completed,
      completionRate,
      unassignedCount: bucket.unassigned,
      openExceptionsCount: openExceptions.filter((e) => e.cityId === city.id).length,
      activeStaffCount: bucket.staff.size,
    });
  }

  // 9. Staff Needing Intervention
  const staffIssuesMap = new Map<
    number,
    {
      staffId: number;
      staffName: string;
      staffPhone: string | null;
      cityId: number | null;
      branchId: number | null;
      delayedJobsCount: number;
      reportedExceptionsCount: number;
      primaryIssue: string;
    }
  >();

  for (const b of todayBookings) {
    const isPastTime = Boolean(b.scheduledTime && b.scheduledTime < currentTimeStr);
    if (b.staffId && !b.completedAt && b.status !== "completed" && b.status !== "cancelled" && isPastTime) {
      const entry = staffIssuesMap.get(b.staffId) || {
        staffId: b.staffId,
        staffName: b.staffName || `Staff #${b.staffId}`,
        staffPhone: b.staffPhone || null,
        cityId: b.cityId,
        branchId: b.branchId,
        delayedJobsCount: 0,
        reportedExceptionsCount: 0,
        primaryIssue: "Delayed scheduled jobs",
      };
      entry.delayedJobsCount++;
      staffIssuesMap.set(b.staffId, entry);
    }
  }

  const staffNeedingIntervention = Array.from(staffIssuesMap.values()).slice(0, 10);

  // 10. Live Operational Activity
  const recentLiveActivity = todayBookings
    .filter((b) => b.completedAt || b.startedAt || b.technicianEnRouteAt)
    .sort((a, b) => {
      const timeA = new Date(a.completedAt || a.startedAt || a.technicianEnRouteAt || 0).getTime();
      const timeB = new Date(b.completedAt || b.startedAt || b.technicianEnRouteAt || 0).getTime();
      return timeB - timeA;
    })
    .slice(0, 10)
    .map((b) => {
      let event = "Booking updated";
      let timestamp = new Date().toISOString();
      if (b.completedAt) {
        event = "Service Completed";
        timestamp = new Date(b.completedAt).toISOString();
      } else if (b.startedAt) {
        event = "Job In Progress";
        timestamp = new Date(b.startedAt).toISOString();
      } else if (b.technicianEnRouteAt) {
        event = "Staff En Route";
        timestamp = new Date(b.technicianEnRouteAt).toISOString();
      }
      return {
        id: `act-${b.id}`,
        timestamp,
        event,
        entityType: "booking",
        entityId: b.id,
        details: `${b.serviceType.replace(/_/g, " ")} (${b.customerName || "Customer"}) - ${b.staffName || "Staff"}`,
      };
    });

  return {
    date,
    scope: {
      cityId: params.cityId ?? null,
      branchId: params.branchId ?? null,
    },
    metrics: {
      totalBookingsToday,
      confirmedBookingsToday,
      completedServicesToday,
      pendingServicesToday,
      cancelledBookingsToday,
      delayedServicesToday,
      unassignedJobsToday,
      openComplaintsCount,
      failedPaymentsCount,
      activeStaffOnField,
    },
    immediateAttention: prioritizedAttention,
    servicesBreakdown: {
      scheduled: scheduledCount,
      assigned: assignedCount,
      enRoute: enRouteCount,
      inProgress: inProgressCount,
      completed: completedServicesToday,
      delayed: delayedServicesToday,
      cancelled: cancelledBookingsToday,
    },
    cityPerformance,
    staffNeedingIntervention,
    recentLiveActivity,
    lastRefreshedAt: new Date().toISOString(),
  };
}
