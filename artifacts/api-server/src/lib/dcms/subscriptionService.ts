import {
  db,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsSubscriptionLocationsTable,
  dcmsStaffAssignmentsTable,
  customersTable,
  residentialSocietiesTable,
  vehiclesTable,
  staffTable,
  type DcmsSubscription,
} from "@workspace/db";
import type { Request } from "express";
import { tenantFilters } from "../../middlewares/tenantScope";
import { eq, and, desc, sql, or, asc, lte } from "drizzle-orm";
import { logDcmsActivity } from "./auditLog";
import { DEFAULT_RADIUS_METERS } from "./geoFence";
import { getPlanById } from "./planService";
import { isRenewalEligible, getVisitStats } from "./missedVisitService";
import { OPERATIONAL_ROLE_SLUGS, staffOperationalRoleError } from "../staffEcosystem/operationalRoles";
import { getVehiclePlanContext, assertPlanMatchesVehicle } from "./vehiclePlanMatch";

export async function createSubscription(
  data: {
    customerId: number;
    vehicleId: number;
    planId: number;
    startDate: string;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
    serviceLocationId?: number | null;
    assetId?: number | null;
    companyId?: number | null;
    franchiseeId?: number | null;
    branchId?: number | null;
    skipBilling?: boolean;
  },
  performedBy: number,
): Promise<DcmsSubscription> {
  const plan = await getPlanById(data.planId);
  if (!plan || !plan.isActive) throw new Error("Plan not found or inactive");

  const vehicleCtx = await getVehiclePlanContext(data.vehicleId);
  if (!vehicleCtx) {
    throw new Error("Vehicle must be linked to a car model (type + seater) before creating a subscription");
  }
  assertPlanMatchesVehicle(plan, vehicleCtx, plan.seatCount);

  const [sub] = await db.insert(dcmsSubscriptionsTable).values({
    customerId: data.customerId,
    serviceLocationId: data.serviceLocationId ?? null,
    assetId: data.assetId ?? null,
    vehicleId: data.vehicleId,
    planId: data.planId,
    startDate: data.startDate,
    allocatedCleanings: plan.includedCleanings,
    allocatedWashes: plan.includedWashes,
    usedCleanings: 0,
    usedWashes: 0,
    remainingCleanings: plan.includedCleanings,
    remainingWashes: plan.includedWashes,
    status: "active",
    companyId: data.companyId ?? null,
    franchiseeId: data.franchiseeId ?? null,
    branchId: data.branchId ?? null,
  }).returning();

  if (data.latitude != null && data.longitude != null) {
    await db.insert(dcmsSubscriptionLocationsTable).values({
      subscriptionId: sub!.id,
      latitude: data.latitude,
      longitude: data.longitude,
      radiusMeters: data.radiusMeters ?? DEFAULT_RADIUS_METERS,
    });
  }

  await logDcmsActivity({
    subscriptionId: sub!.id,
    action: "subscription_created",
    entityType: "subscription",
    entityId: sub!.id,
    performedBy,
    metadata: { planId: data.planId, vehicleId: data.vehicleId },
  });

  const { syncContractFromDcms } = await import("../contracts/contractRegistry");
  await syncContractFromDcms(sub!, plan.name);

  const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
  await enqueuePendingFromDcmsSubscription(sub!.id);

  if (!data.skipBilling) {
    const { createInvoiceForDcmsPlan } = await import("../billing/invoiceService");
    await createInvoiceForDcmsPlan(
      data.customerId,
      { name: plan.name, price: plan.price },
      {
        companyId: data.companyId,
        franchiseeId: data.franchiseeId,
        branchId: data.branchId,
      },
    );
  }

  return sub!;
}

export async function listSubscriptions(filters?: { status?: string; customerId?: number }, req?: Request) {
  const conditions = [];
  if (req) {
    conditions.push(...tenantFilters(req, {
      companyCol: dcmsSubscriptionsTable.companyId,
      branchCol: dcmsSubscriptionsTable.branchId,
      franchiseeCol: dcmsSubscriptionsTable.franchiseeId,
      customerCol: dcmsSubscriptionsTable.customerId,
    }));
  }
  if (filters?.status) conditions.push(eq(dcmsSubscriptionsTable.status, filters.status as DcmsSubscription["status"]));
  if (filters?.customerId) conditions.push(eq(dcmsSubscriptionsTable.customerId, filters.customerId));

  const rows = await db
    .select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(dcmsSubscriptionsTable.createdAt));

  return rows.map(row => ({
    ...row,
    visitStats: getVisitStats(row.subscription),
    renewalEligible: isRenewalEligible(row.subscription),
  }));
}

export async function getSubscriptionDetail(id: number) {
  const rows = await db
    .select({
      subscription: dcmsSubscriptionsTable,
      plan: dcmsPlansTable,
      customer: customersTable,
      vehicle: vehiclesTable,
      location: dcmsSubscriptionLocationsTable,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(dcmsSubscriptionLocationsTable, eq(dcmsSubscriptionLocationsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(eq(dcmsSubscriptionsTable.id, id))
    .limit(1);

  if (!rows[0]) return null;

  const assignments = await db
    .select({
      assignment: dcmsStaffAssignmentsTable,
      staffName: staffTable.name,
    })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(staffTable, eq(dcmsStaffAssignmentsTable.staffId, staffTable.id))
    .where(and(eq(dcmsStaffAssignmentsTable.subscriptionId, id), eq(dcmsStaffAssignmentsTable.isActive, true)));

  return { ...rows[0], assignments, renewalEligible: isRenewalEligible(rows[0].subscription), visitStats: getVisitStats(rows[0].subscription) };
}

export async function updateSubscriptionLocation(
  subscriptionId: number,
  latitude: number,
  longitude: number,
  radiusMeters: number,
  performedBy: number,
) {
  const existing = await db
    .select()
    .from(dcmsSubscriptionLocationsTable)
    .where(eq(dcmsSubscriptionLocationsTable.subscriptionId, subscriptionId))
    .limit(1);

  if (existing[0]) {
    await db.update(dcmsSubscriptionLocationsTable)
      .set({ latitude, longitude, radiusMeters, updatedAt: new Date() })
      .where(eq(dcmsSubscriptionLocationsTable.id, existing[0].id));
  } else {
    await db.insert(dcmsSubscriptionLocationsTable).values({
      subscriptionId, latitude, longitude, radiusMeters,
    });
  }

  await logDcmsActivity({
    subscriptionId,
    action: "location_changed",
    entityType: "location",
    entityId: subscriptionId,
    performedBy,
    metadata: { latitude, longitude, radiusMeters },
  });
}

export async function assignStaff(
  subscriptionId: number,
  staffId: number,
  assignedBy: number,
  routeOrder?: number,
) {
  /** @deprecated Direct DCMS subscription assignment. Use pending_service_assignments + service_assignments (Sprint 6). */
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId)).limit(1);
  if (!staff) throw new Error("Staff not found");
  const roleErr = await staffOperationalRoleError(staff, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
  if (roleErr) throw new Error(roleErr);

  await db.update(dcmsStaffAssignmentsTable)
    .set({ isActive: false })
    .where(and(eq(dcmsStaffAssignmentsTable.subscriptionId, subscriptionId), eq(dcmsStaffAssignmentsTable.isActive, true)));

  const [assignment] = await db.insert(dcmsStaffAssignmentsTable).values({
    subscriptionId,
    staffId,
    assignedBy,
    routeOrder: routeOrder ?? 0,
    isActive: true,
  }).returning();

  const { emitNotificationEvent } = await import("./notificationEvents");
  const [vehicleRow] = await db.select({ registrationNumber: vehiclesTable.registrationNumber })
    .from(dcmsSubscriptionsTable)
    .innerJoin(vehiclesTable, eq(vehiclesTable.id, dcmsSubscriptionsTable.vehicleId))
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);

  await emitNotificationEvent({
    eventType: "vehicle_assigned",
    entityType: "assignment",
    entityId: assignment!.id,
    payload: {
      staffId,
      subscriptionId,
      vehicleNumber: vehicleRow?.registrationNumber ?? "UNKNOWN",
    },
  });

  await logDcmsActivity({
    subscriptionId,
    action: "assignment_changed",
    entityType: "assignment",
    entityId: assignment!.id,
    performedBy: assignedBy,
    metadata: { staffId },
  });

  const [sub] = await db.select({
    customerId: dcmsSubscriptionsTable.customerId,
    companyId: dcmsSubscriptionsTable.companyId,
    societyId: dcmsSubscriptionsTable.societyId,
    parkingBay: dcmsSubscriptionsTable.parkingBay,
  }).from(dcmsSubscriptionsTable).where(eq(dcmsSubscriptionsTable.id, subscriptionId)).limit(1);

  if (sub) {
    try {
      const [custRow] = await db.select({ name: customersTable.name })
        .from(customersTable).where(eq(customersTable.id, sub.customerId)).limit(1);

      let societyName: string | undefined;
      if (sub.societyId) {
        const [soc] = await db.select({ name: residentialSocietiesTable.name })
          .from(residentialSocietiesTable).where(eq(residentialSocietiesTable.id, sub.societyId)).limit(1);
        societyName = soc?.name;
      }

      const { notifyStaffAssigned } = await import("../notifications/dispatcher");
      const { getTodayIST } = await import("../../subscriptions/service");
      void notifyStaffAssigned({
        staffId,
        staffName: staff.name,
        customerId: sub.customerId,
        customerName: custRow?.name,
        serviceName: "Daily Car Cleaning",
        scheduledDate: getTodayIST(),
        societyName,
        parkingBay: sub.parkingBay,
        subscriptionId,
        companyId: sub.companyId,
      });
    } catch {
      // Best-effort notification
    }
  }

  return assignment!;
}

export async function listStaffAssignments(staffId?: number) {
  const conditions = [eq(dcmsStaffAssignmentsTable.isActive, true)];
  if (staffId) conditions.push(eq(dcmsStaffAssignmentsTable.staffId, staffId));

  return db
    .select({
      assignment: dcmsStaffAssignmentsTable,
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
      location: dcmsSubscriptionLocationsTable,
    })
    .from(dcmsStaffAssignmentsTable)
    .innerJoin(dcmsSubscriptionsTable, eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(dcmsSubscriptionLocationsTable, eq(dcmsSubscriptionLocationsTable.subscriptionId, dcmsSubscriptionsTable.id))
    .where(and(...conditions))
    .orderBy(asc(dcmsStaffAssignmentsTable.routeOrder), desc(dcmsStaffAssignmentsTable.assignedAt));
}

export async function renewSubscription(subscriptionId: number, performedBy: number): Promise<DcmsSubscription> {
  const detail = await getSubscriptionDetail(subscriptionId);
  if (!detail) throw new Error("Subscription not found");
  if (!isRenewalEligible(detail.subscription)) {
    throw new Error("Renewal blocked: pending cleanings must be completed first");
  }

  const plan = detail.plan;
  const [updated] = await db.update(dcmsSubscriptionsTable)
    .set({
      allocatedCleanings: plan.includedCleanings,
      allocatedWashes: plan.includedWashes,
      usedCleanings: 0,
      usedWashes: 0,
      remainingCleanings: plan.includedCleanings,
      remainingWashes: plan.includedWashes,
      status: "active",
      startDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date(),
    })
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .returning();

  await logDcmsActivity({
    subscriptionId,
    action: "renewal_completed",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
  });

  const { createInvoiceForDcmsPlan } = await import("../billing/invoiceService");
  await createInvoiceForDcmsPlan(
    detail.subscription.customerId,
    { name: `${plan.name} (renewal)`, price: plan.price },
    {
      companyId: detail.subscription.companyId,
      franchiseeId: detail.subscription.franchiseeId,
      branchId: detail.subscription.branchId,
    },
  );

  const { syncContractFromDcms } = await import("../contracts/contractRegistry");
  await syncContractFromDcms(updated!, plan.name);
  const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
  await enqueuePendingFromDcmsSubscription(subscriptionId);

  return updated!;
}

export async function getCustomerActiveSubscription(customerId: number, vehicleId?: number) {
  const conditions = [
    eq(dcmsSubscriptionsTable.customerId, customerId),
    or(eq(dcmsSubscriptionsTable.status, "active"), eq(dcmsSubscriptionsTable.status, "paused")),
  ];
  if (vehicleId) conditions.push(eq(dcmsSubscriptionsTable.vehicleId, vehicleId));

  return db
    .select({
      subscription: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      vehicleNumber: vehiclesTable.registrationNumber,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .where(and(...conditions))
    .orderBy(desc(dcmsSubscriptionsTable.createdAt));
}

export async function cancelSubscription(
  subscriptionId: number,
  performedBy: number,
  reason?: string,
): Promise<DcmsSubscription> {
  const [sub] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);

  if (!sub) {
    throw new Error("Subscription not found");
  }

  if (sub.status === "cancelled") {
    throw new Error("Subscription is already cancelled");
  }

  const now = new Date();
  const [updated] = await db
    .update(dcmsSubscriptionsTable)
    .set({
      status: "cancelled",
      updatedAt: now,
    })
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .returning();

  // Deactivate active staff assignments
  await db
    .update(dcmsStaffAssignmentsTable)
    .set({
      isActive: false,
    })
    .where(eq(dcmsStaffAssignmentsTable.subscriptionId, subscriptionId));

  await logDcmsActivity({
    subscriptionId,
    action: "subscription_cancelled",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
    metadata: { reason: reason || "User or admin requested cancellation" },
  });

  return updated!;
}

export type ExpiringSubscriptionsFilter = {
  cityId?: number;
  societyId?: number;
  status?: string;
  thresholdCleanings?: number;
  limit?: number;
  offset?: number;
};

export async function listExpiringOrInactiveSubscriptions(filters?: ExpiringSubscriptionsFilter) {
  const threshold = filters?.thresholdCleanings ?? 3;
  const lim = Math.min(filters?.limit ?? 50, 100);
  const off = filters?.offset ?? 0;

  const conditions = [];
  if (filters?.cityId) conditions.push(eq(dcmsSubscriptionsTable.cityId, filters.cityId));
  if (filters?.societyId) conditions.push(eq(dcmsSubscriptionsTable.societyId, filters.societyId));

  if (filters?.status) {
    conditions.push(eq(dcmsSubscriptionsTable.status, filters.status as any));
  } else {
    // Default to active with <= threshold remaining cleanings, or paused, or completed
    conditions.push(
      or(
        and(
          eq(dcmsSubscriptionsTable.status, "active"),
          lte(dcmsSubscriptionsTable.remainingCleanings, threshold),
        ),
        eq(dcmsSubscriptionsTable.status, "paused"),
        eq(dcmsSubscriptionsTable.status, "completed"),
      ),
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: dcmsSubscriptionsTable.id,
      customerId: dcmsSubscriptionsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      vehicleId: dcmsSubscriptionsTable.vehicleId,
      vehicleNumber: vehiclesTable.registrationNumber,
      planId: dcmsSubscriptionsTable.planId,
      planName: dcmsPlansTable.name,
      societyId: dcmsSubscriptionsTable.societyId,
      societyName: residentialSocietiesTable.name,
      parkingBay: dcmsSubscriptionsTable.parkingBay,
      status: dcmsSubscriptionsTable.status,
      startDate: dcmsSubscriptionsTable.startDate,
      allocatedCleanings: dcmsSubscriptionsTable.allocatedCleanings,
      usedCleanings: dcmsSubscriptionsTable.usedCleanings,
      remainingCleanings: dcmsSubscriptionsTable.remainingCleanings,
      remainingWashes: dcmsSubscriptionsTable.remainingWashes,
      createdAt: dcmsSubscriptionsTable.createdAt,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .leftJoin(residentialSocietiesTable, eq(dcmsSubscriptionsTable.societyId, residentialSocietiesTable.id))
    .where(where)
    .orderBy(asc(dcmsSubscriptionsTable.remainingCleanings), desc(dcmsSubscriptionsTable.updatedAt))
    .limit(lim)
    .offset(off);

  const [countRes] = await db
    .select({ count: sql<number>`count(*)` })
    .from(dcmsSubscriptionsTable)
    .where(where);

  return {
    data: rows,
    total: Number(countRes?.count ?? 0),
    limit: lim,
    offset: off,
  };
}
