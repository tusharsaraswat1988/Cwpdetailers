import { db } from "@workspace/db";
import {
  subscriptionsTable,
  bookingsTable,
  vehiclesTable,
  customersTable,
} from "@workspace/db";
import { eq, and, sql, inArray, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  getLedgerBalance,
  resolveDailyRate,
  isLowBalance,
} from "../lib/wallet/service";
import { pauseSubscription, getTodayIST } from "./service";
import { notifyLowBalance, notifyBookingConfirmed } from "../lib/notifications/dispatcher";

const ACTIVE_BOOKING_STATUSES = ["scheduled", "confirmed", "en_route", "in_progress", "completed"] as const;

/** IST weekday: 0=Sun … 6=Sat. Default off-day: Wednesday (3). */
export function getDefaultOffDays(): number[] {
  const raw = process.env.DAILY_CLEANING_OFF_DAYS ?? "3";
  return raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0 && n <= 6);
}

export function getOffDaysForSubscription(sub: { offDays?: number[] | null }): number[] {
  if (Array.isArray(sub.offDays) && sub.offDays.length > 0) return sub.offDays;
  return getDefaultOffDays();
}

export function getISTWeekday(dateStr: string): number {
  const d = new Date(`${dateStr}T12:00:00+05:30`);
  return d.getUTCDay();
}

export function isOffDay(dateStr: string, offDays: number[]): boolean {
  return offDays.includes(getISTWeekday(dateStr));
}

async function hasBookingForToday(subscriptionId: number, vehicleId: number, today: string): Promise<boolean> {
  const [row] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(and(
      eq(bookingsTable.subscriptionId, subscriptionId),
      eq(bookingsTable.vehicleId, vehicleId),
      sql`${bookingsTable.scheduledDate}::text = ${today}`,
      inArray(bookingsTable.status, [...ACTIVE_BOOKING_STATUSES]),
    ))
    .limit(1);
  return !!row;
}

export type DailySchedulerResult = {
  date: string;
  isOffDay: boolean;
  offDays: number[];
  created: number;
  skipped: number;
  paused: number;
  lowBalanceAlerts: number;
  issues: Array<{ subscriptionId: number; customerId: number; reason: string }>;
  createdBookingIds: number[];
};

/**
 * Auto-generate daily cleaning bookings for active daily_wash contracts.
 * Idempotent per subscription+vehicle+date.
 */
export async function generateDailyCleaningBookings(todayStr?: string): Promise<DailySchedulerResult> {
  const today = todayStr ?? getTodayIST();
  const defaultOff = getDefaultOffDays();
  const todayIsOff = isOffDay(today, defaultOff);

  const result: DailySchedulerResult = {
    date: today,
    isOffDay: todayIsOff,
    offDays: defaultOff,
    created: 0,
    skipped: 0,
    paused: 0,
    lowBalanceAlerts: 0,
    issues: [],
    createdBookingIds: [],
  };

  if (todayIsOff) {
    logger.info({ today, offDays: defaultOff }, "Daily cleaning skipped — off day");
    return result;
  }

  const subs = await db
    .select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      vehicleId: subscriptionsTable.vehicleId,
      serviceId: subscriptionsTable.serviceId,
      price: subscriptionsTable.price,
      dailyRate: subscriptionsTable.dailyRate,
      offDays: subscriptionsTable.offDays,
      branchId: subscriptionsTable.branchId,
      companyId: subscriptionsTable.companyId,
      franchiseeId: subscriptionsTable.franchiseeId,
      customerName: customersTable.name,
    })
    .from(subscriptionsTable)
    .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .where(and(
      eq(subscriptionsTable.type, "daily_wash"),
      eq(subscriptionsTable.status, "active"),
      sql`${subscriptionsTable.startDate}::text <= ${today}`,
      sql`${subscriptionsTable.endDate}::text >= ${today}`,
      isNotNull(subscriptionsTable.vehicleId),
    ));

  for (const sub of subs) {
    const subOffDays = getOffDaysForSubscription(sub);
    if (isOffDay(today, subOffDays)) {
      result.skipped++;
      continue;
    }

    if (!sub.vehicleId) {
      result.issues.push({ subscriptionId: sub.id, customerId: sub.customerId, reason: "no_vehicle" });
      result.skipped++;
      continue;
    }

    const [vehicle] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, sub.vehicleId)).limit(1);
    if (!vehicle) {
      result.issues.push({ subscriptionId: sub.id, customerId: sub.customerId, reason: "vehicle_not_found" });
      result.skipped++;
      continue;
    }

    const staffId = vehicle.assignedStaffId;
    if (!staffId) {
      result.issues.push({ subscriptionId: sub.id, customerId: sub.customerId, reason: "no_staff_assigned" });
      result.skipped++;
      continue;
    }

    const dailyRate = resolveDailyRate(sub);
    const balance = await getLedgerBalance(sub.customerId);

    if (balance < dailyRate) {
      await pauseSubscription(sub.id);
      result.paused++;

      const alert = await notifyLowBalance({
        customerId: sub.customerId,
        customerName: sub.customerName ?? "Customer",
        balance,
        dailyRate,
        companyId: sub.companyId,
        branchId: sub.branchId,
        dedupeKey: `low_balance:${sub.customerId}:${today}`,
      });
      if (!alert.skipped) result.lowBalanceAlerts++;

      result.issues.push({
        subscriptionId: sub.id,
        customerId: sub.customerId,
        reason: balance <= 0 ? "zero_balance_paused" : "insufficient_balance_paused",
      });
      continue;
    }

    if (await hasBookingForToday(sub.id, sub.vehicleId, today)) {
      result.skipped++;
      continue;
    }

    const [booking] = await db.insert(bookingsTable).values({
      customerId: sub.customerId,
      vehicleId: sub.vehicleId,
      subscriptionId: sub.id,
      serviceId: sub.serviceId,
      staffId,
      branchId: sub.branchId ?? vehicle.branchId,
      companyId: sub.companyId ?? vehicle.companyId,
      franchiseeId: sub.franchiseeId ?? vehicle.franchiseeId,
      scheduledDate: today,
      scheduledTime: "09:00",
      status: "scheduled",
      serviceType: "daily_cleaning",
      amount: dailyRate.toFixed(2),
      notes: "Auto-scheduled daily cleaning",
    }).returning();

    result.created++;
    result.createdBookingIds.push(booking.id);

    notifyBookingConfirmed({
      id: booking.id,
      customerId: sub.customerId,
      customerName: sub.customerName,
      serviceName: "Daily Cleaning",
      serviceType: "daily_cleaning",
      scheduledDate: today,
      companyId: sub.companyId,
      branchId: sub.branchId,
    }).catch((err) => logger.error({ err, bookingId: booking.id }, "Daily booking notify failed"));

    if (await isLowBalance(sub.customerId, dailyRate)) {
      const alert = await notifyLowBalance({
        customerId: sub.customerId,
        customerName: sub.customerName ?? "Customer",
        balance,
        dailyRate,
        companyId: sub.companyId,
        branchId: sub.branchId,
        dedupeKey: `low_balance:${sub.customerId}:${today}`,
      });
      if (!alert.skipped) result.lowBalanceAlerts++;
    }
  }

  logger.info(result, "Daily cleaning bookings generated");
  return result;
}

export type DueWashItem = {
  subscriptionId: number;
  customerId: number;
  customerName: string | null;
  vehicleId: number | null;
  type: string;
  servicesRemaining: number | null;
  nextDueDate: string | null;
  daysOverdue: number;
};

/**
 * Detect package / AMC washes that are due but not yet scheduled.
 */
export async function detectDueWashes(todayStr?: string): Promise<DueWashItem[]> {
  const today = todayStr ?? getTodayIST();
  const todayMs = new Date(`${today}T12:00:00+05:30`).getTime();

  const subs = await db
    .select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      vehicleId: subscriptionsTable.vehicleId,
      type: subscriptionsTable.type,
      servicesRemaining: subscriptionsTable.servicesRemaining,
      nextDueDate: subscriptionsTable.nextDueDate,
      nextServiceDate: subscriptionsTable.nextServiceDate,
    })
    .from(subscriptionsTable)
    .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .where(and(
      eq(subscriptionsTable.status, "active"),
      inArray(subscriptionsTable.type, ["monthly_wash", "solar_amc"]),
      sql`coalesce(${subscriptionsTable.servicesRemaining}, 1) > 0`,
    ));

  const due: DueWashItem[] = [];

  for (const sub of subs) {
    const dueDate = sub.nextDueDate ?? sub.nextServiceDate;
    if (!dueDate || dueDate > today) continue;

    const dueMs = new Date(`${dueDate}T12:00:00+05:30`).getTime();
    const daysOverdue = Math.max(0, Math.floor((todayMs - dueMs) / 86400000));

    const [existing] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.subscriptionId, sub.id),
        sql`${bookingsTable.scheduledDate}::text >= ${dueDate}`,
        inArray(bookingsTable.status, ["scheduled", "confirmed", "en_route", "in_progress"]),
      ))
      .limit(1);

    if (existing) continue;

    due.push({
      subscriptionId: sub.id,
      customerId: sub.customerId,
      customerName: sub.customerName,
      vehicleId: sub.vehicleId,
      type: sub.type,
      servicesRemaining: sub.servicesRemaining,
      nextDueDate: dueDate,
      daysOverdue,
    });
  }

  return due.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export async function previewDailyCleaningEligibility(todayStr?: string) {
  const today = todayStr ?? getTodayIST();
  const defaultOff = getDefaultOffDays();
  if (isOffDay(today, defaultOff)) {
    return { date: today, isOffDay: true, eligible: 0, blocked: [] as Array<{ subscriptionId: number; reason: string }> };
  }

  const subs = await db.select({
    id: subscriptionsTable.id,
    customerId: subscriptionsTable.customerId,
    vehicleId: subscriptionsTable.vehicleId,
    dailyRate: subscriptionsTable.dailyRate,
    price: subscriptionsTable.price,
    offDays: subscriptionsTable.offDays,
  }).from(subscriptionsTable).where(and(
    eq(subscriptionsTable.type, "daily_wash"),
    eq(subscriptionsTable.status, "active"),
    isNotNull(subscriptionsTable.vehicleId),
  ));

  let eligible = 0;
  const blocked: Array<{ subscriptionId: number; reason: string }> = [];

  for (const sub of subs) {
    if (isOffDay(today, getOffDaysForSubscription(sub))) continue;
    const [vehicle] = await db.select({ assignedStaffId: vehiclesTable.assignedStaffId })
      .from(vehiclesTable).where(eq(vehiclesTable.id, sub.vehicleId!)).limit(1);
    if (!vehicle?.assignedStaffId) {
      blocked.push({ subscriptionId: sub.id, reason: "no_staff_assigned" });
      continue;
    }
    const dailyRate = resolveDailyRate(sub);
    const balance = await getLedgerBalance(sub.customerId);
    if (balance < dailyRate) {
      blocked.push({ subscriptionId: sub.id, reason: "insufficient_balance" });
      continue;
    }
    if (sub.vehicleId && await hasBookingForToday(sub.id, sub.vehicleId, today)) continue;
    eligible++;
  }

  return { date: today, isOffDay: false, eligible, blocked };
}

export async function getDailyOpsSummary(todayStr?: string) {
  const today = todayStr ?? getTodayIST();
  const offDays = getDefaultOffDays();
  const preview = await previewDailyCleaningEligibility(today);

  const [todayBookings, activeDaily, pausedDaily, unassigned] = await Promise.all([
    db.select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      customerName: customersTable.name,
      staffId: bookingsTable.staffId,
      vehicleId: bookingsTable.vehicleId,
      status: bookingsTable.status,
      scheduledTime: bookingsTable.scheduledTime,
      subscriptionId: bookingsTable.subscriptionId,
    }).from(bookingsTable)
      .leftJoin(customersTable, eq(bookingsTable.customerId, customersTable.id))
      .where(and(
        eq(bookingsTable.serviceType, "daily_cleaning"),
        sql`${bookingsTable.scheduledDate}::text = ${today}`,
      ))
      .orderBy(bookingsTable.scheduledTime),

    db.select({ count: sql<number>`count(*)::int` }).from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.type, "daily_wash"), eq(subscriptionsTable.status, "active"))),

    db.select({ count: sql<number>`count(*)::int` }).from(subscriptionsTable)
      .where(and(eq(subscriptionsTable.type, "daily_wash"), eq(subscriptionsTable.status, "paused"))),

    db.select({
      subscriptionId: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      vehicleId: subscriptionsTable.vehicleId,
      registrationNumber: vehiclesTable.registrationNumber,
    }).from(subscriptionsTable)
      .innerJoin(vehiclesTable, eq(subscriptionsTable.vehicleId, vehiclesTable.id))
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .where(and(
        eq(subscriptionsTable.type, "daily_wash"),
        eq(subscriptionsTable.status, "active"),
        sql`${vehiclesTable.assignedStaffId} is null`,
      )),
  ]);

  const dueWashes = await detectDueWashes(today);

  return {
    date: today,
    istWeekday: getISTWeekday(today),
    isOffDay: isOffDay(today, offDays),
    offDays,
    activeDailyContracts: Number(activeDaily[0]?.count ?? 0),
    pausedDailyContracts: Number(pausedDaily[0]?.count ?? 0),
    todayDailyBookings: todayBookings,
    unassignedVehicles: unassigned,
    dueWashes,
    schedulerPreview: preview,
  };
}
