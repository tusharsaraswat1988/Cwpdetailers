import type { Request } from "express";
import {
  db,
  bookingsTable,
  dcmsVisitsTable,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  customersTable,
  vehiclesTable,
  solarSitesTable,
  staffTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { tenantFilters } from "../../middlewares/tenantScope";
import { getTodayIST } from "../../subscriptions/service";
import { detectDueWashes } from "../../subscriptions/dueWashDetection";
import { listSubscriptionsWithOutstandingVisits } from "../dcms/missedVisitService";
import { listExecutionsForTimeline } from "../executions/executionService";

export type OperationsTimelineItem = {
  id: string;
  channel: "booking" | "dcms_visit" | "dcms_due" | "due_wash" | "execution";
  customerId: number;
  customerName: string | null;
  assetLabel: string | null;
  workType: string;
  status: string;
  scheduledAt: string;
  staffName: string | null;
  staffId: number | null;
  executionId?: number;
};

export type OperationsTimeline = {
  date: string;
  stats: {
    bookingsTotal: number;
    bookingsCompleted: number;
    dcmsVisitsTotal: number;
    dcmsVisitsCompleted: number;
    dcmsDueCount: number;
    dueWashCount: number;
    executionCount: number;
    delayedCount: number;
  };
  items: OperationsTimelineItem[];
};

function bookingTenantFilters(req: Request) {
  return tenantFilters(req, {
    companyCol: bookingsTable.companyId,
    branchCol: bookingsTable.branchId,
    franchiseeCol: bookingsTable.franchiseeId,
  });
}

function isDelayed(scheduledDate: string, scheduledTime: string | null, status: string): boolean {
  if (status === "completed" || status === "cancelled") return false;
  if (!scheduledTime) return false;
  const [h, m] = scheduledTime.split(":").map(Number);
  const scheduled = new Date(`${scheduledDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  return Date.now() - scheduled.getTime() > 2 * 60 * 60 * 1000;
}

export async function getOperationsTimeline(req: Request, date: string): Promise<OperationsTimeline> {
  const today = getTodayIST();
  const isToday = date === today;

  const bookingFilters = bookingTenantFilters(req);
  const bookingWhere = bookingFilters.length
    ? and(eq(bookingsTable.scheduledDate, date), ...bookingFilters)
    : eq(bookingsTable.scheduledDate, date);

  const [bookings, visits, outstandingDcms, dueWashes, executionItems] = await Promise.all([
    db.select({
      booking: bookingsTable,
      customerName: customersTable.name,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      solarAddress: solarSitesTable.address,
      serviceName: servicesTable.name,
    })
      .from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .leftJoin(staffTable, eq(bookingsTable.staffId, staffTable.id))
      .leftJoin(vehiclesTable, eq(bookingsTable.vehicleId, vehiclesTable.id))
      .leftJoin(solarSitesTable, eq(bookingsTable.solarSiteId, solarSitesTable.id))
      .leftJoin(servicesTable, eq(bookingsTable.serviceId, servicesTable.id))
      .where(bookingWhere)
      .orderBy(bookingsTable.scheduledTime),

    db.select({
      visit: dcmsVisitsTable,
      customerId: dcmsSubscriptionsTable.customerId,
      customerName: customersTable.name,
      staffName: staffTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      planName: dcmsPlansTable.name,
    })
      .from(dcmsVisitsTable)
      .innerJoin(dcmsSubscriptionsTable, eq(dcmsVisitsTable.subscriptionId, dcmsSubscriptionsTable.id))
      .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
      .innerJoin(staffTable, eq(dcmsVisitsTable.staffId, staffTable.id))
      .innerJoin(vehiclesTable, eq(dcmsVisitsTable.vehicleId, vehiclesTable.id))
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .where(sql`DATE(${dcmsVisitsTable.visitTime}) = ${date}::date`)
      .orderBy(desc(dcmsVisitsTable.visitTime)),

    isToday ? listSubscriptionsWithOutstandingVisits() : Promise.resolve([]),
    isToday ? detectDueWashes(date) : Promise.resolve([]),
    listExecutionsForTimeline(req, date),
  ]);

  const bookingItems: OperationsTimelineItem[] = bookings.map(row => ({
    id: `booking-${row.booking.id}`,
    channel: "booking" as const,
    customerId: row.booking.customerId,
    customerName: row.customerName,
    assetLabel: row.vehicleNumber ?? row.solarAddress ?? null,
    workType: row.serviceName ?? row.booking.serviceType.replace(/_/g, " "),
    status: row.booking.status,
    scheduledAt: `${row.booking.scheduledDate}T${row.booking.scheduledTime ?? "00:00"}:00`,
    staffName: row.staffName,
    staffId: row.booking.staffId,
  }));

  const visitItems: OperationsTimelineItem[] = visits.map(row => ({
    id: `visit-${row.visit.id}`,
    channel: "dcms_visit" as const,
    customerId: row.customerId,
    customerName: row.customerName,
    assetLabel: row.vehicleNumber,
    workType: row.visit.visitType === "wash" ? `DCMS wash · ${row.planName}` : `Daily cleaning · ${row.planName}`,
    status: row.visit.status,
    scheduledAt: row.visit.visitTime.toISOString(),
    staffName: row.staffName,
    staffId: row.visit.staffId,
  }));

  const dcmsDueItems: OperationsTimelineItem[] = isToday
    ? outstandingDcms.slice(0, 30).map(row => ({
      id: `dcms-due-${row.subscription.id}`,
      channel: "dcms_due" as const,
      customerId: row.subscription.customerId,
      customerName: row.customerName,
      assetLabel: row.vehicleNumber,
      workType: `DCMS due · ${row.planName}`,
      status: "pending",
      scheduledAt: `${date}T08:00:00`,
      staffName: null,
      staffId: null,
    }))
    : [];

  const dueWashItems: OperationsTimelineItem[] = isToday
    ? dueWashes.slice(0, 20).map(row => ({
      id: `due-wash-${row.subscriptionId}`,
      channel: "due_wash" as const,
      customerId: row.customerId,
      customerName: row.customerName,
      assetLabel: row.vehicleId ? `Vehicle #${row.vehicleId}` : null,
      workType: `${row.type.replace(/_/g, " ")} due`,
      status: "overdue",
      scheduledAt: row.nextDueDate ? `${row.nextDueDate}T09:00:00` : `${date}T09:00:00`,
      staffName: null,
      staffId: null,
    }))
    : [];

  const executionTimelineItems: OperationsTimelineItem[] = executionItems.map(e => ({
    id: e.id,
    channel: "execution" as const,
    customerId: e.customerId,
    customerName: e.customerName,
    assetLabel: e.assetLabel,
    workType: e.workType,
    status: e.status,
    scheduledAt: e.scheduledAt,
    staffName: e.staffName,
    staffId: e.staffId,
    executionId: e.executionId,
  }));

  const items = [...executionTimelineItems, ...bookingItems, ...visitItems, ...dcmsDueItems, ...dueWashItems]
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  const delayedCount = bookingItems.filter(b => {
    const time = b.scheduledAt.includes("T") ? b.scheduledAt.split("T")[1]?.slice(0, 5) : null;
    return isDelayed(date, time ?? null, b.status);
  }).length;

  return {
    date,
    stats: {
      bookingsTotal: bookingItems.length,
      bookingsCompleted: bookingItems.filter(b => b.status === "completed").length,
      dcmsVisitsTotal: visitItems.length,
      dcmsVisitsCompleted: visitItems.filter(v => v.status === "completed").length,
      dcmsDueCount: dcmsDueItems.length,
      dueWashCount: dueWashItems.length,
      executionCount: executionTimelineItems.length,
      delayedCount,
    },
    items,
  };
}
