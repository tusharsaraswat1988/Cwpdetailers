import {
  db,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  dcmsSubscriptionLocationsTable,
  dcmsStaffAssignmentsTable,
  customersTable,
  residentialSocietiesTable,
  societyTowersTable,
  serviceLocationsTable,
  vehiclesTable,
  staffTable,
  customerContractsTable,
  serviceAssignmentsTable,
  serviceExecutionsTable,
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
    cityId?: number | null;
    societyId?: number | null;
    towerId?: number | null;
    parkingBay?: string | null;
    initialStatus?: "active" | "pending_payment";
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

  // Idempotency guard: prevent duplicate active or pending subscriptions on double-submission/webhook replay
  const [existingActive] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(
      and(
        eq(dcmsSubscriptionsTable.vehicleId, data.vehicleId),
        eq(dcmsSubscriptionsTable.planId, data.planId),
        or(
          eq(dcmsSubscriptionsTable.status, "active"),
          eq(dcmsSubscriptionsTable.status, "pending_payment"),
        ),
      ),
    )
    .limit(1);

  if (existingActive) {
    return existingActive;
  }

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
    status: data.initialStatus ?? "active",
    companyId: data.companyId ?? null,
    franchiseeId: data.franchiseeId ?? null,
    branchId: data.branchId ?? null,
    cityId: data.cityId ?? null,
    societyId: data.societyId ?? null,
    towerId: data.towerId ?? null,
    parkingBay: data.parkingBay ?? null,
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
    metadata: { planId: data.planId, vehicleId: data.vehicleId, status: sub!.status },
  });

  const { syncContractFromDcms } = await import("../contracts/contractRegistry");
  await syncContractFromDcms(sub!, plan.name);

  // Enqueue cleaner routes ONLY when active (never before payment confirmation)
  if (sub!.status === "active") {
    const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
    await enqueuePendingFromDcmsSubscription(sub!.id);
  }

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

export type ReassignMonthlyCleanerInput = {
  subscriptionId: number;
  newStaffId: number;
  assignedBy: number;
  reason?: string;
  notes?: string;
  routeOrder?: number;
};

export async function reassignMonthlyCleaner(input: ReassignMonthlyCleanerInput) {
  const { subscriptionId, newStaffId, assignedBy, reason, notes, routeOrder } = input;

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, newStaffId)).limit(1);
  if (!staff) throw new Error("Staff member not found");
  if (!staff.isActive) throw new Error("Staff member is inactive");
  const roleErr = await staffOperationalRoleError(staff, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
  if (roleErr) throw new Error(roleErr);

  const [current] = await db.select()
    .from(dcmsStaffAssignmentsTable)
    .where(and(
      eq(dcmsStaffAssignmentsTable.subscriptionId, subscriptionId),
      eq(dcmsStaffAssignmentsTable.isActive, true),
    ))
    .limit(1);

  const previousStaffId = current?.staffId ?? null;

  // Deactivate prior assignments
  await db.update(dcmsStaffAssignmentsTable)
    .set({ isActive: false })
    .where(and(eq(dcmsStaffAssignmentsTable.subscriptionId, subscriptionId), eq(dcmsStaffAssignmentsTable.isActive, true)));

  // Insert new monthly persistent cleaner assignment
  const [assignment] = await db.insert(dcmsStaffAssignmentsTable).values({
    subscriptionId,
    staffId: newStaffId,
    assignedBy,
    routeOrder: routeOrder ?? current?.routeOrder ?? 0,
    isActive: true,
  }).returning();

  // Synchronize contract and service_assignments
  const [contract] = await db.select({ id: customerContractsTable.id })
    .from(customerContractsTable)
    .where(and(
      eq(customerContractsTable.sourceSystem, "dcms"),
      eq(customerContractsTable.sourceId, subscriptionId),
    ))
    .limit(1);

  if (contract) {
    const now = new Date();
    await db.update(serviceAssignmentsTable)
      .set({
        assignedStaffId: newStaffId,
        assignedAt: now,
        status: "ready_for_execution",
        notes: notes ?? undefined,
        updatedAt: now,
      })
      .where(and(
        eq(serviceAssignmentsTable.contractId, contract.id),
        eq(serviceAssignmentsTable.taskType, "daily_cleaning"),
      ));

    await db.update(serviceExecutionsTable)
      .set({
        assignedStaffId: newStaffId,
        updatedAt: now,
      })
      .where(and(
        eq(serviceExecutionsTable.contractId, contract.id),
        eq(serviceExecutionsTable.taskType, "daily_cleaning"),
        sql`${serviceExecutionsTable.status} NOT IN ('completed', 'cancelled', 'missed')`,
      ));
  }

  // Activity audit log
  await logDcmsActivity({
    subscriptionId,
    action: "cleaner_reassigned",
    entityType: "assignment",
    entityId: assignment!.id,
    performedBy: assignedBy,
    metadata: {
      previousStaffId,
      newStaffId,
      reason: reason ?? "Staff replacement / leave reassignment",
      notes: notes ?? null,
    },
  });

  // Notifications
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
        staffId: newStaffId,
        staffName: staff.name,
        customerId: sub.customerId,
        customerName: custRow?.name,
        serviceName: "Daily Car Cleaning (Monthly Route Assignment)",
        scheduledDate: getTodayIST(),
        societyName,
        parkingBay: sub.parkingBay,
        subscriptionId,
        companyId: sub.companyId,
      });
    } catch {
      // Best-effort
    }
  }

  return assignment!;
}

export type MonthlyCleanerSubscriptionRow = {
  subscriptionId: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  vehicleId: number;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string | null;
  societyId: number | null;
  societyName: string | null;
  towerName: string | null;
  parkingLevel: string | null;
  parkingBay: string | null;
  planName: string;
  startDate: string;
  status: string;
  allocatedCleanings: number;
  usedCleanings: number;
  remainingCleanings: number;
  allocatedWashes: number;
  remainingWashes: number;
  assignedCleaner: {
    assignmentId: number;
    staffId: number;
    staffName: string;
    staffPhone: string | null;
    assignedAt: string;
    routeOrder: number;
  } | null;
};

export async function listMonthlyCleanerSubscriptions(filters?: {
  cityId?: number;
  branchId?: number;
  societyId?: number;
  status?: string;
  unassignedOnly?: boolean;
  search?: string;
}): Promise<MonthlyCleanerSubscriptionRow[]> {
  const conditions = [
    sql`${dcmsSubscriptionsTable.status} IN ('active', 'paused')`,
  ];

  if (filters?.cityId) {
    conditions.push(eq(dcmsSubscriptionsTable.cityId, filters.cityId));
  }
  if (filters?.branchId) {
    conditions.push(eq(dcmsSubscriptionsTable.branchId, filters.branchId));
  }
  if (filters?.societyId) {
    conditions.push(eq(dcmsSubscriptionsTable.societyId, filters.societyId));
  }
  if (filters?.status) {
    conditions.push(sql`${dcmsSubscriptionsTable.status} = ${filters.status}`);
  }

  const rows = await db
    .select({
      sub: dcmsSubscriptionsTable,
      planName: dcmsPlansTable.name,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      vehicleNumber: vehiclesTable.registrationNumber,
      vehicleMake: vehiclesTable.make,
      vehicleModel: vehiclesTable.model,
      vehicleColor: vehiclesTable.color,
      societyName: residentialSocietiesTable.name,
      towerName: societyTowersTable.name,
      parkingLevel: serviceLocationsTable.parkingLevel,
      parkingBay: sql<string | null>`COALESCE(${serviceLocationsTable.parkingBay}, ${dcmsSubscriptionsTable.parkingBay})`,
      assignment: dcmsStaffAssignmentsTable,
      cleanerName: staffTable.name,
      cleanerPhone: staffTable.phone,
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(serviceLocationsTable, eq(dcmsSubscriptionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
    .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
    .leftJoin(
      dcmsStaffAssignmentsTable,
      and(
        eq(dcmsStaffAssignmentsTable.subscriptionId, dcmsSubscriptionsTable.id),
        eq(dcmsStaffAssignmentsTable.isActive, true),
      ),
    )
    .leftJoin(staffTable, eq(dcmsStaffAssignmentsTable.staffId, staffTable.id))
    .where(and(...conditions))
    .orderBy(desc(dcmsSubscriptionsTable.id));

  let result: MonthlyCleanerSubscriptionRow[] = rows.map(r => ({
    subscriptionId: r.sub.id,
    customerId: r.sub.customerId,
    customerName: r.customerName,
    customerPhone: r.customerPhone ?? null,
    vehicleId: r.sub.vehicleId,
    vehicleNumber: r.vehicleNumber,
    vehicleMake: r.vehicleMake,
    vehicleModel: r.vehicleModel,
    vehicleColor: r.vehicleColor ?? null,
    societyId: r.sub.societyId ?? null,
    societyName: r.societyName ?? null,
    towerName: r.towerName ?? null,
    parkingLevel: r.parkingLevel ?? null,
    parkingBay: r.parkingBay ?? null,
    planName: r.planName,
    startDate: String(r.sub.startDate),
    status: r.sub.status,
    allocatedCleanings: r.sub.allocatedCleanings,
    usedCleanings: r.sub.usedCleanings,
    remainingCleanings: r.sub.remainingCleanings,
    allocatedWashes: r.sub.allocatedWashes,
    remainingWashes: r.sub.remainingWashes,
    assignedCleaner: r.assignment && r.cleanerName ? {
      assignmentId: r.assignment.id,
      staffId: r.assignment.staffId,
      staffName: r.cleanerName,
      staffPhone: r.cleanerPhone ?? null,
      assignedAt: r.assignment.assignedAt
        ? (r.assignment.assignedAt instanceof Date ? r.assignment.assignedAt.toISOString() : String(r.assignment.assignedAt))
        : new Date().toISOString(),
      routeOrder: r.assignment.routeOrder,
    } : null,
  }));

  if (filters?.unassignedOnly) {
    result = result.filter(r => !r.assignedCleaner);
  }

  if (filters?.search?.trim()) {
    const q = filters.search.toLowerCase();
    result = result.filter(r =>
      r.vehicleNumber.toLowerCase().includes(q) ||
      r.customerName.toLowerCase().includes(q) ||
      (r.customerPhone && r.customerPhone.includes(q)) ||
      (r.societyName && r.societyName.toLowerCase().includes(q)) ||
      (r.assignedCleaner && r.assignedCleaner.staffName.toLowerCase().includes(q)),
    );
  }

  return result;
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

export async function pauseSubscription(
  subscriptionId: number,
  options: {
    pauseStartDate: string;
    pauseEndDate?: string;
    pauseReason?: string;
  },
  performedBy: number,
): Promise<DcmsSubscription> {
  const [sub] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);

  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "paused") throw new Error("Subscription is already paused");
  if (sub.status !== "active") throw new Error("Only active subscriptions can be paused");

  const now = new Date();
  const [updated] = await db
    .update(dcmsSubscriptionsTable)
    .set({
      status: "paused",
      pauseStartDate: options.pauseStartDate,
      pauseEndDate: options.pauseEndDate ?? null,
      pauseReason: options.pauseReason ?? "Customer vacation / pause requested",
      updatedAt: now,
    })
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .returning();

  // Deactivate active cleaner assignments so daily route skips this vehicle
  await db
    .update(dcmsStaffAssignmentsTable)
    .set({ isActive: false })
    .where(eq(dcmsStaffAssignmentsTable.subscriptionId, subscriptionId));

  await logDcmsActivity({
    subscriptionId,
    action: "subscription_paused",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
    metadata: options,
  });

  return updated!;
}

export async function resumeSubscription(
  subscriptionId: number,
  performedBy: number,
): Promise<DcmsSubscription> {
  const [sub] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .limit(1);

  if (!sub) throw new Error("Subscription not found");
  if (sub.status === "active") throw new Error("Subscription is already active");
  if (sub.status !== "paused") throw new Error("Only paused subscriptions can be resumed");

  const now = new Date();
  const [updated] = await db
    .update(dcmsSubscriptionsTable)
    .set({
      status: "active",
      pauseStartDate: null,
      pauseEndDate: null,
      pauseReason: null,
      updatedAt: now,
    })
    .where(eq(dcmsSubscriptionsTable.id, subscriptionId))
    .returning();

  // Restore daily cleaning route assignment
  const { enqueuePendingFromDcmsSubscription } = await import("../assignments/enqueueAdapters");
  await enqueuePendingFromDcmsSubscription(subscriptionId);

  await logDcmsActivity({
    subscriptionId,
    action: "subscription_resumed",
    entityType: "subscription",
    entityId: subscriptionId,
    performedBy,
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
