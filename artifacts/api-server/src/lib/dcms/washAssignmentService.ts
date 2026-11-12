import {
  db,
  dcmsSubscriptionsTable,
  dcmsPlansTable,
  vehiclesTable,
  customersTable,
  serviceLocationsTable,
  residentialSocietiesTable,
  societyTowersTable,
  staffTable,
  serviceAssignmentsTable,
  serviceExecutionsTable,
  customerContractsTable,
  dcmsVisitsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { OPERATIONAL_ROLE_SLUGS, staffOperationalRoleError } from "../staffEcosystem/operationalRoles";
import { assertStaffAssignable, assertStaffBranchMatch } from "../assignments/assignmentValidation";
import { logDcmsActivity } from "./auditLog";
import { getTodayIST } from "../../subscriptions/service";
import { logger } from "../logger";

export type DcmsPackageWashRow = {
  subscriptionId: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  vehicleId: number;
  vehicleNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string | null;
  societyName: string | null;
  towerName: string | null;
  parkingLevel: string | null;
  parkingBay: string | null;
  planName: string;
  allocatedWashes: number;
  usedWashes: number;
  remainingWashes: number;
  lastWashDate: string | null;
  scheduledWash: {
    executionId: number;
    scheduledDate: string;
    scheduledTime: string | null;
    staffId: number;
    staffName: string;
    staffPhone: string | null;
    status: string;
    notes: string | null;
  } | null;
  status: string;
};

export async function listDcmsPackageWashes(filters?: {
  subscriptionId?: number;
  societyId?: number;
  hasRemainingWashes?: boolean;
  scheduledDate?: string;
  cityId?: number;
  branchId?: number;
  search?: string;
}): Promise<DcmsPackageWashRow[]> {
  const conditions = [
    sql`${dcmsSubscriptionsTable.allocatedWashes} > 0`,
    sql`${dcmsSubscriptionsTable.status} IN ('active', 'paused')`,
  ];

  if (filters?.subscriptionId) {
    conditions.push(eq(dcmsSubscriptionsTable.id, filters.subscriptionId));
  }
  if (filters?.societyId) {
    conditions.push(eq(dcmsSubscriptionsTable.societyId, filters.societyId));
  }
  if (filters?.hasRemainingWashes) {
    conditions.push(sql`${dcmsSubscriptionsTable.remainingWashes} > 0`);
  }
  if (filters?.cityId) {
    conditions.push(eq(dcmsSubscriptionsTable.cityId, filters.cityId));
  }
  if (filters?.branchId) {
    conditions.push(eq(dcmsSubscriptionsTable.branchId, filters.branchId));
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
    })
    .from(dcmsSubscriptionsTable)
    .innerJoin(dcmsPlansTable, eq(dcmsSubscriptionsTable.planId, dcmsPlansTable.id))
    .innerJoin(customersTable, eq(dcmsSubscriptionsTable.customerId, customersTable.id))
    .innerJoin(vehiclesTable, eq(dcmsSubscriptionsTable.vehicleId, vehiclesTable.id))
    .leftJoin(serviceLocationsTable, eq(dcmsSubscriptionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(residentialSocietiesTable, eq(serviceLocationsTable.societyId, residentialSocietiesTable.id))
    .leftJoin(societyTowersTable, eq(serviceLocationsTable.towerId, societyTowersTable.id))
    .where(and(...conditions))
    .orderBy(desc(dcmsSubscriptionsTable.id));

  const result: DcmsPackageWashRow[] = [];

  for (const row of rows) {
    if (filters?.search?.trim()) {
      const q = filters.search.toLowerCase();
      const match =
        row.vehicleNumber.toLowerCase().includes(q) ||
        row.customerName.toLowerCase().includes(q) ||
        (row.customerPhone && row.customerPhone.includes(q)) ||
        (row.societyName && row.societyName.toLowerCase().includes(q));
      if (!match) continue;
    }

    // 1. Find last completed wash
    const [lastWash] = await db
      .select({ visitDate: dcmsVisitsTable.visitDate, visitTime: dcmsVisitsTable.visitTime })
      .from(dcmsVisitsTable)
      .where(and(
        eq(dcmsVisitsTable.subscriptionId, row.sub.id),
        eq(dcmsVisitsTable.visitType, "wash"),
        eq(dcmsVisitsTable.status, "completed"),
      ))
      .orderBy(desc(dcmsVisitsTable.visitTime))
      .limit(1);

    // 2. Find contract for this DCMS subscription
    const [contract] = await db
      .select({ id: customerContractsTable.id })
      .from(customerContractsTable)
      .where(and(
        eq(customerContractsTable.sourceSystem, "dcms"),
        eq(customerContractsTable.sourceId, row.sub.id),
      ))
      .limit(1);

    let scheduledWash: DcmsPackageWashRow["scheduledWash"] = null;

    if (contract) {
      const execConditions = [
        eq(serviceExecutionsTable.contractId, contract.id),
        eq(serviceExecutionsTable.taskType, "car_wash"),
        sql`${serviceExecutionsTable.status} IN ('scheduled', 'started')`,
      ];
      if (filters?.scheduledDate) {
        execConditions.push(eq(serviceExecutionsTable.scheduledDate, filters.scheduledDate));
      }

      const [activeExec] = await db
        .select({
          execution: serviceExecutionsTable,
          staffName: staffTable.name,
          staffPhone: staffTable.phone,
        })
        .from(serviceExecutionsTable)
        .innerJoin(staffTable, eq(serviceExecutionsTable.assignedStaffId, staffTable.id))
        .where(and(...execConditions))
        .orderBy(desc(serviceExecutionsTable.scheduledDate), desc(serviceExecutionsTable.id))
        .limit(1);

      if (activeExec) {
        const execObj = activeExec.execution ?? (activeExec as any);
        scheduledWash = {
          executionId: execObj.id,
          scheduledDate: execObj.scheduledDate,
          scheduledTime: execObj.scheduledTime ?? null,
          staffId: execObj.assignedStaffId,
          staffName: activeExec.staffName ?? "Wash Technician",
          staffPhone: activeExec.staffPhone ?? null,
          status: execObj.status,
          notes: execObj.notes ?? null,
        };
      }
    }

    result.push({
      subscriptionId: row.sub.id,
      customerId: row.sub.customerId,
      customerName: row.customerName,
      customerPhone: row.customerPhone ?? null,
      vehicleId: row.sub.vehicleId,
      vehicleNumber: row.vehicleNumber,
      vehicleMake: row.vehicleMake,
      vehicleModel: row.vehicleModel,
      vehicleColor: row.vehicleColor ?? null,
      societyName: row.societyName ?? null,
      towerName: row.towerName ?? null,
      parkingLevel: row.parkingLevel ?? null,
      parkingBay: row.parkingBay ?? null,
      planName: row.planName,
      allocatedWashes: row.sub.allocatedWashes,
      usedWashes: row.sub.usedWashes,
      remainingWashes: row.sub.remainingWashes,
      lastWashDate: lastWash?.visitDate ?? (lastWash?.visitTime ? String(lastWash.visitTime).slice(0, 10) : null),
      scheduledWash,
      status: row.sub.status,
    });
  }

  return result;
}

export type AssignPackageWashInput = {
  subscriptionId: number;
  staffId: number;
  scheduledDate: string;
  assignedBy: number;
  scheduledTime?: string;
  notes?: string;
};

export async function assignDcmsPackageWash(input: AssignPackageWashInput) {
  const [sub] = await db
    .select()
    .from(dcmsSubscriptionsTable)
    .where(eq(dcmsSubscriptionsTable.id, input.subscriptionId))
    .limit(1);

  if (!sub) throw new Error("Subscription not found");
  if (sub.status !== "active") throw new Error(`Subscription is ${sub.status} — only active subscriptions can be assigned washes`);
  if (sub.remainingWashes <= 0) throw new Error("No remaining washes available for this subscription package");

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, input.staffId)).limit(1);
  if (!staff) throw new Error("Staff member not found");
  assertStaffAssignable(staff);
  assertStaffBranchMatch(staff, sub.branchId);

  // Validate operational role — must be car_washer or daily_car_cleaner with wash capability
  const washerErr = await staffOperationalRoleError(staff, OPERATIONAL_ROLE_SLUGS.CAR_WASHER);
  const cleanerErr = await staffOperationalRoleError(staff, OPERATIONAL_ROLE_SLUGS.DAILY_CAR_CLEANER);
  if (washerErr && cleanerErr) {
    throw new Error(`Staff member "${staff.name}" lacks the Car Washer or Cleaner operational role`);
  }

  // Ensure contract exists
  const { syncContractFromDcmsSubscription } = await import("../contracts/contractRegistry");
  const contractId = await syncContractFromDcmsSubscription(sub.id);
  if (!contractId) throw new Error("Failed to resolve customer contract for subscription");

  // Upsert or update service_assignments for task_type = 'car_wash'
  const [existingAssignment] = await db
    .select()
    .from(serviceAssignmentsTable)
    .where(and(
      eq(serviceAssignmentsTable.contractId, contractId),
      eq(serviceAssignmentsTable.taskType, "car_wash"),
    ))
    .limit(1);

  let assignmentId: number;
  const now = new Date();

  if (existingAssignment) {
    const [updated] = await db
      .update(serviceAssignmentsTable)
      .set({
        assignedStaffId: input.staffId,
        assignedAt: now,
        status: "ready_for_execution",
        notes: input.notes?.trim() || existingAssignment.notes,
        updatedAt: now,
      })
      .where(eq(serviceAssignmentsTable.id, existingAssignment.id))
      .returning();
    assignmentId = updated!.id;
  } else {
    // Check if pending assignment exists
    const { loadContractBySource } = await import("../assignments/enqueueAdapters");
    const contract = await loadContractBySource("dcms", sub.id);
    const pendingId = (contract as unknown as { pendingAssignmentId?: number })?.pendingAssignmentId ?? 0;

    const [inserted] = await db
      .insert(serviceAssignmentsTable)
      .values({
        pendingAssignmentId: pendingId || 1, // Fallback if pending not directly tracked
        contractId,
        customerId: sub.customerId,
        serviceLocationId: sub.serviceLocationId,
        assetId: sub.assetId,
        assignedStaffId: input.staffId,
        taskType: "car_wash",
        serviceLabel: "Package Wash",
        productLine: "daily_cleaning",
        status: "ready_for_execution",
        notes: input.notes?.trim() || null,
        companyId: sub.companyId,
        branchId: sub.branchId,
        franchiseeId: sub.franchiseeId,
        assignedAt: now,
      })
      .returning();
    assignmentId = inserted!.id;
  }

  // Check if an active execution already exists for this wash
  const [activeExec] = await db
    .select()
    .from(serviceExecutionsTable)
    .where(and(
      eq(serviceExecutionsTable.contractId, contractId),
      eq(serviceExecutionsTable.taskType, "car_wash"),
      sql`${serviceExecutionsTable.status} IN ('scheduled', 'started')`,
    ))
    .limit(1);

  let executionId: number;

  if (activeExec) {
    const [updated] = await db
      .update(serviceExecutionsTable)
      .set({
        assignedStaffId: input.staffId,
        scheduledDate: input.scheduledDate,
        scheduledTime: input.scheduledTime ?? null,
        serviceAssignmentId: assignmentId,
        notes: input.notes?.trim() || activeExec.notes,
        updatedAt: now,
      })
      .where(eq(serviceExecutionsTable.id, activeExec.id))
      .returning();
    executionId = updated!.id;
  } else {
    const { createScheduledExecutionForAssignment } = await import("../executions/executionService");
    executionId = await createScheduledExecutionForAssignment({
      serviceAssignmentId: assignmentId,
      contractId,
      customerId: sub.customerId,
      serviceLocationId: sub.serviceLocationId,
      assetId: sub.assetId,
      assignedStaffId: input.staffId,
      taskType: "car_wash",
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime ?? null,
      companyId: sub.companyId,
      branchId: sub.branchId,
      franchiseeId: sub.franchiseeId,
    });
  }

  await logDcmsActivity({
    subscriptionId: sub.id,
    action: "wash_assigned",
    entityType: "execution",
    entityId: executionId,
    performedBy: input.assignedBy,
    metadata: {
      staffId: input.staffId,
      staffName: staff.name,
      scheduledDate: input.scheduledDate,
      notes: input.notes,
    },
  });

  // Notify wash technician
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
    void notifyStaffAssigned({
      staffId: input.staffId,
      staffName: staff.name,
      customerId: sub.customerId,
      customerName: custRow?.name,
      serviceName: "Package Car Wash (Included with Daily Cleaning)",
      scheduledDate: input.scheduledDate,
      societyName,
      parkingBay: sub.parkingBay,
      subscriptionId: sub.id,
      companyId: sub.companyId,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to send wash staff notification");
  }

  return { executionId, assignmentId };
}
