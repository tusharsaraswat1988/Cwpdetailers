import { db } from "@workspace/db";
import { subscriptionsTable, bookingsTable, customersTable } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { getTodayIST } from "./service";

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

/** Detect package / AMC washes that are due but not yet scheduled. */
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

    // Phase 5.2: bookings.subscriptionId removed — match by customer/vehicle + schedule status
    const conditions = [
      eq(bookingsTable.customerId, sub.customerId),
      sql`${bookingsTable.scheduledDate}::text >= ${dueDate}`,
      inArray(bookingsTable.status, ["draft", "scheduled", "confirmed", "waiting_assignment", "rescheduled"]),
    ];
    if (sub.vehicleId != null) {
      conditions.push(eq(bookingsTable.vehicleId, sub.vehicleId));
    }

    const [existing] = await db
      .select({ id: bookingsTable.id })
      .from(bookingsTable)
      .where(and(...conditions))
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
