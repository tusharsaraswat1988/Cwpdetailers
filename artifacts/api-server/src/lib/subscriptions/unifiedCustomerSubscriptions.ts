import {
  db,
  dcmsPlansTable,
  dcmsSubscriptionsTable,
  vehiclesTable,
  customersTable,
  subscriptionsTable,
  servicesTable,
} from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";

export type UnifiedSubscriptionRow = {
  id: number;
  customerId: number;
  customerName: string | null;
  vehicleId: number | null;
  solarSiteId: number | null;
  serviceId: number | null;
  serviceName: string | null;
  type: string | null;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  nextServiceDate: string | null;
  nextDueDate: string | null;
  frequencyDays: number | null;
  recurrenceRule: string | null;
  totalServices: number | null;
  servicesUsed: number | null;
  servicesRemaining: number | null;
  graceMinutes: number | null;
  price: string | null;
  paidAmount: string | null;
  dueAmount: string | null;
  branchId: number | null;
  companyId: number | null;
  franchiseeId: number | null;
  notes: string | null;
  cancelledAt: Date | null;
  cancellationRemark: string | null;
  renewalReminderSentAt: Date | null;
  pausedAt: Date | null;
  resumedAt: Date | null;
  createdAt: Date | null;
  vehicleName?: string | null;
  source?: "subscription" | "dcms";
};

/** Legacy subscriptions + DCMS daily cleaning for customer-facing lists. */
export async function listUnifiedCustomerSubscriptions(customerId: number): Promise<UnifiedSubscriptionRow[]> {
  const [legacy, dcms] = await Promise.all([
    db.select({
      id: subscriptionsTable.id,
      customerId: subscriptionsTable.customerId,
      customerName: customersTable.name,
      vehicleId: subscriptionsTable.vehicleId,
      solarSiteId: subscriptionsTable.solarSiteId,
      serviceId: subscriptionsTable.serviceId,
      serviceName: servicesTable.name,
      type: subscriptionsTable.type,
      status: subscriptionsTable.status,
      startDate: subscriptionsTable.startDate,
      endDate: subscriptionsTable.endDate,
      nextServiceDate: subscriptionsTable.nextServiceDate,
      nextDueDate: subscriptionsTable.nextDueDate,
      frequencyDays: subscriptionsTable.frequencyDays,
      recurrenceRule: subscriptionsTable.recurrenceRule,
      totalServices: subscriptionsTable.totalServices,
      servicesUsed: subscriptionsTable.servicesUsed,
      servicesRemaining: subscriptionsTable.servicesRemaining,
      graceMinutes: subscriptionsTable.graceMinutes,
      price: subscriptionsTable.price,
      paidAmount: subscriptionsTable.paidAmount,
      dueAmount: subscriptionsTable.dueAmount,
      branchId: subscriptionsTable.branchId,
      companyId: subscriptionsTable.companyId,
      franchiseeId: subscriptionsTable.franchiseeId,
      notes: subscriptionsTable.notes,
      cancelledAt: subscriptionsTable.cancelledAt,
      cancellationRemark: subscriptionsTable.cancellationRemark,
      renewalReminderSentAt: subscriptionsTable.renewalReminderSentAt,
      pausedAt: subscriptionsTable.pausedAt,
      resumedAt: subscriptionsTable.resumedAt,
      createdAt: subscriptionsTable.createdAt,
    })
      .from(subscriptionsTable)
      .leftJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
      .leftJoin(servicesTable, eq(subscriptionsTable.serviceId, servicesTable.id))
      .where(eq(subscriptionsTable.customerId, customerId))
      .orderBy(desc(subscriptionsTable.createdAt)),

    db.select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      planPrice: dcmsPlansTable.price,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
    })
      .from(dcmsSubscriptionsTable)
      .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
      .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
      .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
      .where(and(
        eq(dcmsSubscriptionsTable.customerId, customerId),
        or(
          eq(dcmsSubscriptionsTable.status, "active"),
          eq(dcmsSubscriptionsTable.status, "paused"),
          eq(dcmsSubscriptionsTable.status, "completed"),
        ),
      ))
      .orderBy(desc(dcmsSubscriptionsTable.createdAt)),
  ]);

  const dcmsRows: UnifiedSubscriptionRow[] = dcms.map(row => {
    const sub = row.subscription;
    const total = (sub.allocatedCleanings ?? 0) + (sub.allocatedWashes ?? 0);
    const used = (sub.usedCleanings ?? 0) + (sub.usedWashes ?? 0);
    const remaining = (sub.remainingCleanings ?? 0) + (sub.remainingWashes ?? 0);
    const vehicleName = [row.vehicleNumber, row.vehicleMake, row.vehicleModel].filter(Boolean).join(" · ");

    return {
      id: sub.id,
      customerId: sub.customerId,
      customerName: row.customerName,
      vehicleId: sub.vehicleId,
      solarSiteId: null,
      serviceId: null,
      serviceName: row.planName,
      type: "daily_cleaning",
      status: sub.status,
      startDate: String(sub.startDate),
      endDate: null,
      nextServiceDate: null,
      nextDueDate: null,
      frequencyDays: null,
      recurrenceRule: null,
      totalServices: total,
      servicesUsed: used,
      servicesRemaining: remaining,
      graceMinutes: null,
      price: row.planPrice,
      paidAmount: null,
      dueAmount: null,
      branchId: sub.branchId,
      companyId: sub.companyId,
      franchiseeId: sub.franchiseeId,
      notes: null,
      cancelledAt: null,
      cancellationRemark: null,
      renewalReminderSentAt: null,
      pausedAt: sub.pauseStartDate ? new Date(sub.pauseStartDate) : null,
      resumedAt: null,
      createdAt: sub.createdAt,
      vehicleName,
      source: "dcms",
    };
  });

  return [...dcmsRows, ...legacy.map(r => ({ ...r, source: "subscription" as const }))];
}
