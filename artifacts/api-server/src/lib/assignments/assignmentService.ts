/**
 * Phase 5.3 — Staff Assignment platform.
 *
 * Business question: "Who should perform this scheduled service?"
 * Owns: work queue, assignment, reassignment, remove, timeline, notes, events.
 * Does NOT own: booking schedule, route planning, attendance, execution, billing.
 *
 * pending_service_assignments remains the operational queue.
 * service_assignments records who is assigned — phase ends at ready_for_execution.
 */

import {
  db,
  pendingServiceAssignmentsTable,
  serviceAssignmentsTable,
  customerContractsTable,
  customersTable,
  serviceLocationsTable,
  assetsTable,
  servicesTable,
  staffTable,
  serviceExecutionsTable,
  serviceExecutionNotesTable,
  bookingsTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters, rowInScope } from "../../middlewares/tenantScope";
import { listCustomerContracts } from "../contracts/contractRegistry";
import { createScheduledExecutionForAssignment } from "../executions/executionService";
import { notifyStaffJobAssigned } from "../push/staffJobNotify";
import { getTodayIST } from "../../subscriptions/service";
import { staffOperationalRoleError } from "../staffEcosystem/operationalRoles";
import {
  type ServiceTaskType,
  type TaskAssignmentInput,
  getRequiredTaskTypes,
  getRequiredTaskTypesForContract,
  roleSlugForTaskType,
  taskTypeLabel,
  defaultTaskTypeForProductLine,
} from "./assignmentTaskTypes";
import { assignStaff as assignDcmsStaff } from "../dcms/subscriptionService";
import { assertStaffAssignable, assertStaffBranchMatch } from "./assignmentValidation";
import {
  assignmentDomainEventPublisher,
  baseAssignmentEventFields,
} from "./domainEvents";
import { recordAssignmentTimeline, getAssignmentTimeline } from "./assignmentTimeline";
export type AssignmentPriority = "normal" | "high";

export type TaskAssignmentSlot = {
  taskType: ServiceTaskType;
  taskTypeLabel: string;
  assignmentId?: number;
  staffId?: number;
  staffName?: string;
};

export type PendingAssignmentView = {
  id: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationType: string | null;
  serviceLocationCity: string | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceId: number | null;
  serviceName: string;
  serviceType: string;
  priority: AssignmentPriority;
  createdAt: string;
  requiredTasks: TaskAssignmentSlot[];
  /** Booking Engine read projection when source_system = booking (frozen; read-only). */
  bookingId: number | null;
  bookingStatus: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  sourceSystem: string;
  sourceId: number;
  notes: string | null;
  branchId: number | null;
};

export type AssignedServiceView = {
  id: number;
  pendingAssignmentId: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationType: string | null;
  serviceLocationCity: string | null;
  assetId: number | null;
  assetLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  serviceName: string;
  serviceType: string;
  taskType: ServiceTaskType;
  taskTypeLabel: string;
  assignedAt: string;
  status: "assigned" | "ready_for_execution";
  bookingId: number | null;
  notes: string | null;
};

export type { ServiceTaskType, TaskAssignmentInput };
const PRODUCT_LINE_LABELS: Record<string, string> = {
  daily_cleaning: "Daily Cleaning",
  wash_package: "Wash Package",
  monthly_wash: "Monthly Wash",
  solar_amc: "Solar AMC",
  detailing_plan: "Detailing Plan",
  one_time_service: "One-Time Service",
};

function computePriority(createdAt: Date): AssignmentPriority {
  const ageMs = Date.now() - createdAt.getTime();
  const days = ageMs / (1000 * 60 * 60 * 24);
  return days >= 3 ? "high" : "normal";
}

function serviceTypeLabel(productLine: string | null | undefined): string {
  if (!productLine) return "Service";
  return PRODUCT_LINE_LABELS[productLine] ?? productLine.replace(/_/g, " ");
}

const PENDING_SCOPE = {
  companyCol: pendingServiceAssignmentsTable.companyId,
  branchCol: pendingServiceAssignmentsTable.branchId,
  franchiseeCol: pendingServiceAssignmentsTable.franchiseeId,
  customerCol: pendingServiceAssignmentsTable.customerId,
};

const ASSIGNED_SCOPE = {
  companyCol: serviceAssignmentsTable.companyId,
  branchCol: serviceAssignmentsTable.branchId,
  franchiseeCol: serviceAssignmentsTable.franchiseeId,
  customerCol: serviceAssignmentsTable.customerId,
};

type TenantFields = {
  companyId: number | null;
  branchId: number | null;
  franchiseeId: number | null;
};

/** Fill missing tenant columns from contract, pending row, or caller scope. */
function resolveAssignmentTenant(
  req: Request,
  pending: {
    companyId?: number | null;
    branchId?: number | null;
    franchiseeId?: number | null;
  },
  contract?: {
    companyId?: number | null;
    branchId?: number | null;
    franchiseeId?: number | null;
  } | null,
): TenantFields {
  const scope = req.scope;
  const branchFromScope =
    scope?.branchIds?.length === 1 ? scope.branchIds[0]! : null;

  return {
    companyId: pending.companyId ?? contract?.companyId ?? scope?.companyId ?? null,
    branchId: pending.branchId ?? contract?.branchId ?? branchFromScope,
    franchiseeId: pending.franchiseeId ?? contract?.franchiseeId ?? scope?.franchiseeId ?? null,
  };
}

async function resolveServiceName(
  contractId: number,
  serviceId: number | null,
): Promise<{ serviceName: string; productLine: string }> {
  const contracts = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, contractId))
    .limit(1);
  const contract = contracts[0];
  if (!contract) return { serviceName: "Service", productLine: "one_time_service" };

  const registryRows = await listCustomerContracts(contract.customerId);
  const match = registryRows.find(r => r.id === contractId);
  if (match) {
    return { serviceName: match.serviceName, productLine: match.productLine };
  }

  if (serviceId) {
    const [svc] = await db.select({ name: servicesTable.name }).from(servicesTable)
      .where(eq(servicesTable.id, serviceId)).limit(1);
    if (svc?.name) {
      return { serviceName: svc.name, productLine: contract.productLine };
    }
  }

  const summary = (contract.summaryJson ?? {}) as Record<string, unknown>;
  const name = typeof summary.serviceName === "string" ? summary.serviceName
    : typeof summary.planName === "string" ? summary.planName
      : typeof summary.packageName === "string" ? summary.packageName
        : serviceTypeLabel(contract.productLine);

  return { serviceName: name, productLine: contract.productLine };
}

export async function listPendingAssignments(
  req: Request,
  filters?: {
    serviceType?: string;
    serviceLocationId?: number;
    staffId?: number;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<PendingAssignmentView[]> {
  const conditions: SQL[] = [
    sql`${pendingServiceAssignmentsTable.status} IN ('pending', 'assigned')`,
    ...tenantFilters(req, PENDING_SCOPE),
  ];

  if (filters?.serviceLocationId) {
    conditions.push(eq(pendingServiceAssignmentsTable.serviceLocationId, filters.serviceLocationId));
  }
  if (filters?.dateFrom) {
    conditions.push(sql`${pendingServiceAssignmentsTable.createdAt} >= ${filters.dateFrom}::date`);
  }
  if (filters?.dateTo) {
    conditions.push(sql`${pendingServiceAssignmentsTable.createdAt} < (${filters.dateTo}::date + interval '1 day')`);
  }

  const rows = await db.select({
    pending: pendingServiceAssignmentsTable,
    customerName: customersTable.name,
    locationLabel: serviceLocationsTable.label,
    locationType: serviceLocationsTable.locationType,
    locationCity: serviceLocationsTable.city,
    assetLabel: assetsTable.label,
    productLine: customerContractsTable.productLine,
    summaryJson: customerContractsTable.summaryJson,
  })
    .from(pendingServiceAssignmentsTable)
    .innerJoin(customersTable, eq(pendingServiceAssignmentsTable.customerId, customersTable.id))
    .innerJoin(customerContractsTable, eq(pendingServiceAssignmentsTable.contractRegistryId, customerContractsTable.id))
    .leftJoin(serviceLocationsTable, eq(pendingServiceAssignmentsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(pendingServiceAssignmentsTable.assetId, assetsTable.id))
    .where(and(...conditions))
    .orderBy(desc(pendingServiceAssignmentsTable.createdAt));

  const nameByContract = new Map<number, string>();
  const customerIds = [...new Set(rows.map(r => r.pending.customerId))];
  for (const cid of customerIds) {
    const registry = await listCustomerContracts(cid);
    for (const c of registry) nameByContract.set(c.id, c.serviceName);
  }

  const pendingIds = rows.map(r => r.pending.id);
  const assignmentRows = pendingIds.length
    ? await db.select({
      assignment: serviceAssignmentsTable,
      staffName: staffTable.name,
    })
      .from(serviceAssignmentsTable)
      .innerJoin(staffTable, eq(serviceAssignmentsTable.assignedStaffId, staffTable.id))
      .where(and(
        inArray(serviceAssignmentsTable.pendingAssignmentId, pendingIds),
        sql`${serviceAssignmentsTable.status} IN ('assigned', 'ready_for_execution')`,
      ))
    : [];

  const assignmentsByPending = new Map<number, typeof assignmentRows>();
  for (const ar of assignmentRows) {
    const list = assignmentsByPending.get(ar.assignment.pendingAssignmentId) ?? [];
    list.push(ar);
    assignmentsByPending.set(ar.assignment.pendingAssignmentId, list);
  }

  /** Read-only Booking Engine projection (Phase 5.2 frozen — no writes). */
  const bookingSourceIds = rows
    .filter(r => r.pending.sourceSystem === "booking")
    .map(r => r.pending.sourceId);
  const bookingById = new Map<number, {
    id: number;
    status: string;
    scheduledDate: string;
    scheduledTime: string | null;
  }>();
  if (bookingSourceIds.length) {
    const bookingRows = await db.select({
      id: bookingsTable.id,
      status: bookingsTable.status,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
    })
      .from(bookingsTable)
      .where(inArray(bookingsTable.id, bookingSourceIds));
    for (const b of bookingRows) {
      bookingById.set(b.id, {
        id: b.id,
        status: b.status,
        scheduledDate: String(b.scheduledDate),
        scheduledTime: b.scheduledTime ?? null,
      });
    }
  }

  function buildTaskSlots(
    pendingId: number,
    productLine: string,
    summaryJson: unknown,
  ): TaskAssignmentSlot[] {
    const required = getRequiredTaskTypes(productLine, summaryJson);
    const existing = assignmentsByPending.get(pendingId) ?? [];
    return required.map(taskType => {
      const match = existing.find(a => a.assignment.taskType === taskType);
      return {
        taskType,
        taskTypeLabel: taskTypeLabel(taskType),
        assignmentId: match?.assignment.id,
        staffId: match?.assignment.assignedStaffId,
        staffName: match?.staffName,
      };
    });
  }

  let result: PendingAssignmentView[] = rows.map(r => {
    const booking = r.pending.sourceSystem === "booking"
      ? bookingById.get(r.pending.sourceId)
      : undefined;
    return {
      id: r.pending.id,
      contractId: r.pending.contractRegistryId,
      customerId: r.pending.customerId,
      customerName: r.customerName,
      serviceLocationId: r.pending.serviceLocationId,
      serviceLocationLabel: r.locationLabel,
      serviceLocationType: r.locationType ?? null,
      serviceLocationCity: r.locationCity ?? null,
      assetId: r.pending.assetId,
      assetLabel: r.assetLabel,
      serviceId: r.pending.serviceId,
      serviceName: nameByContract.get(r.pending.contractRegistryId)
        ?? serviceTypeLabel(r.productLine),
      serviceType: r.productLine,
      priority: computePriority(r.pending.createdAt),
      createdAt: r.pending.createdAt.toISOString(),
      requiredTasks: buildTaskSlots(r.pending.id, r.productLine, r.summaryJson),
      bookingId: booking?.id ?? (r.pending.sourceSystem === "booking" ? r.pending.sourceId : null),
      bookingStatus: booking?.status ?? null,
      scheduledDate: booking?.scheduledDate ?? null,
      scheduledTime: booking?.scheduledTime ?? null,
      sourceSystem: r.pending.sourceSystem,
      sourceId: r.pending.sourceId,
      notes: r.pending.notes ?? null,
      branchId: r.pending.branchId ?? null,
    };
  });

  result = result.filter(r => r.requiredTasks.some(t => !t.staffId));

  if (filters?.serviceType) {
    const st = filters.serviceType.toLowerCase();
    result = result.filter(r => r.serviceType.toLowerCase() === st || r.serviceType.replace(/_/g, " ").includes(st));
  }

  if (filters?.staffId) {
    const assignedPendingIds = await db.select({ pendingId: serviceAssignmentsTable.pendingAssignmentId })
      .from(serviceAssignmentsTable)
      .where(eq(serviceAssignmentsTable.assignedStaffId, filters.staffId));
    const idSet = new Set(assignedPendingIds.map(r => r.pendingId));
    result = result.filter(r => !idSet.has(r.id));
  }

  return result;
}

export async function assignPendingService(
  req: Request,
  pendingAssignmentId: number,
  staffId: number,
): Promise<AssignedServiceView> {
  const [pending] = await db.select().from(pendingServiceAssignmentsTable)
    .where(eq(pendingServiceAssignmentsTable.id, pendingAssignmentId))
    .limit(1);
  if (!pending) throw new Error("Pending assignment not found");

  const [contract] = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, pending.contractRegistryId))
    .limit(1);
  const required = contract
    ? getRequiredTaskTypesForContract(contract)
    : [defaultTaskTypeForProductLine("one_time_service")];

  const unassigned = await getUnassignedTaskTypes(pendingAssignmentId, required);
  const taskType = unassigned[0] ?? required[0] ?? "one_time_service";

  const results = await assignPendingServiceTasks(req, pendingAssignmentId, [{ taskType, staffId }]);
  if (!results[0]) throw new Error("Assignment failed");
  return results[0];
}

async function getUnassignedTaskTypes(
  pendingAssignmentId: number,
  required: ServiceTaskType[],
): Promise<ServiceTaskType[]> {
  const existing = await db.select({ taskType: serviceAssignmentsTable.taskType })
    .from(serviceAssignmentsTable)
    .where(and(
      eq(serviceAssignmentsTable.pendingAssignmentId, pendingAssignmentId),
      sql`${serviceAssignmentsTable.status} IN ('assigned', 'ready_for_execution')`,
    ));
  const assigned = new Set(existing.map(r => r.taskType));
  return required.filter(t => !assigned.has(t));
}

function actorFromReq(req: Request): { actorId: number | null; actorName: string | null } {
  return {
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? req.user?.phone ?? null,
  };
}

async function assertBookingAllowsAssignment(pending: {
  sourceSystem: string;
  sourceId: number;
}): Promise<number | null> {
  if (pending.sourceSystem !== "booking") return null;
  const [booking] = await db.select({
    id: bookingsTable.id,
    status: bookingsTable.status,
  })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, pending.sourceId))
    .limit(1);
  if (!booking) throw new Error("Linked booking not found");
  if (booking.status === "cancelled") {
    throw new Error("Cannot assign staff — booking is cancelled");
  }
  if (booking.status !== "waiting_assignment" && booking.status !== "confirmed" && booking.status !== "scheduled") {
    throw new Error(`Booking status "${booking.status}" does not allow assignment`);
  }
  return booking.id;
}

async function markPendingFullyAssigned(pendingId: number, contractId: number): Promise<void> {
  const [contract] = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, contractId))
    .limit(1);
  if (!contract) return;

  const required = getRequiredTaskTypesForContract(contract);
  const unassigned = await getUnassignedTaskTypes(pendingId, required);
  if (unassigned.length === 0) {
    await db.update(pendingServiceAssignmentsTable)
      .set({ status: "assigned", updatedAt: new Date() })
      .where(eq(pendingServiceAssignmentsTable.id, pendingId));
  }
}

export async function assignPendingServiceTasks(
  req: Request,
  pendingAssignmentId: number,
  tasks: TaskAssignmentInput[],
  options?: { notes?: string | null },
): Promise<AssignedServiceView[]> {
  if (!tasks.length) throw new Error("At least one task assignment is required");

  const [pending] = await db.select().from(pendingServiceAssignmentsTable)
    .where(eq(pendingServiceAssignmentsTable.id, pendingAssignmentId))
    .limit(1);

  if (!pending || !rowInScope(req, {
    companyId: pending.companyId,
    branchId: pending.branchId,
    franchiseeId: pending.franchiseeId,
    customerId: pending.customerId,
  })) {
    throw new Error("Pending assignment not found");
  }
  if (!pending.serviceLocationId) {
    throw new Error("Service location is required before assignment");
  }

  const [contract] = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, pending.contractRegistryId))
    .limit(1);
  if (!contract) throw new Error("Contract not found");

  const required = getRequiredTaskTypesForContract(contract);
  const requiredSet = new Set(required);
  const seenTasks = new Set<ServiceTaskType>();

  for (const t of tasks) {
    if (!requiredSet.has(t.taskType)) {
      throw new Error(`Task type ${t.taskType} is not required for this contract`);
    }
    if (seenTasks.has(t.taskType)) {
      throw new Error(`Duplicate task type ${t.taskType} in request`);
    }
    seenTasks.add(t.taskType);
  }

  const { serviceName, productLine } = await resolveServiceName(
    pending.contractRegistryId,
    pending.serviceId,
  );

  const tenant = resolveAssignmentTenant(req, pending, contract);
  const bookingId = await assertBookingAllowsAssignment(pending);
  const actor = actorFromReq(req);
  const notes = options?.notes?.trim() || null;

  const results: AssignedServiceView[] = [];
  const performedBy = req.user?.id ?? 0;

  for (const { taskType, staffId } of tasks) {
    const [existing] = await db.select().from(serviceAssignmentsTable)
      .where(and(
        eq(serviceAssignmentsTable.pendingAssignmentId, pendingAssignmentId),
        eq(serviceAssignmentsTable.taskType, taskType),
      ))
      .limit(1);
    if (existing && (existing.status === "assigned" || existing.status === "ready_for_execution")) {
      throw new Error(`${taskTypeLabel(taskType)} is already assigned for this job`);
    }

    const [staff] = await db.select().from(staffTable)
      .where(eq(staffTable.id, staffId))
      .limit(1);
    assertStaffAssignable(staff);
    assertStaffBranchMatch(staff, tenant.branchId ?? pending.branchId);

    const requiredRole = roleSlugForTaskType(taskType);
    const roleErr = await staffOperationalRoleError(staff, requiredRole);
    if (roleErr) throw new Error(roleErr);

    const now = new Date();

    let assignment = existing;
    if (existing && existing.status === "removed") {
      const [updated] = await db.update(serviceAssignmentsTable)
        .set({
          assignedStaffId: staffId,
          assignedAt: now,
          status: "ready_for_execution",
          serviceLabel: serviceName,
          productLine,
          notes,
          bookingId: bookingId ?? existing.bookingId,
          companyId: tenant.companyId,
          franchiseeId: tenant.franchiseeId,
          branchId: tenant.branchId,
          updatedAt: now,
        })
        .where(eq(serviceAssignmentsTable.id, existing.id))
        .returning();
      assignment = updated!;
    } else {
      const [inserted] = await db.insert(serviceAssignmentsTable).values({
        pendingAssignmentId: pending.id,
        customerId: pending.customerId,
        serviceLocationId: pending.serviceLocationId,
        assetId: pending.assetId,
        contractId: pending.contractRegistryId,
        serviceId: pending.serviceId,
        bookingId,
        assignedStaffId: staffId,
        taskType,
        assignedAt: now,
        status: "ready_for_execution",
        serviceLabel: serviceName,
        productLine,
        notes,
        companyId: tenant.companyId,
        franchiseeId: tenant.franchiseeId,
        branchId: tenant.branchId,
      }).returning();
      assignment = inserted!;
    }

    const executionId = await createScheduledExecutionForAssignment({
      serviceAssignmentId: assignment.id,
      contractId: pending.contractRegistryId,
      customerId: pending.customerId,
      serviceLocationId: pending.serviceLocationId,
      assetId: pending.assetId,
      assignedStaffId: staffId,
      taskType,
      scheduledDate: getTodayIST(),
      companyId: tenant.companyId,
      franchiseeId: tenant.franchiseeId,
      branchId: tenant.branchId,
    });

    if (pending.sourceSystem === "dcms" && taskType === "daily_cleaning" && performedBy > 0) {
      try {
        await assignDcmsStaff(pending.sourceId, staffId, performedBy);
      } catch {
        // DCMS bridge is best-effort; unified assignment still succeeds
      }
    }

    await recordAssignmentTimeline({
      assignmentId: assignment.id,
      pendingAssignmentId: pending.id,
      eventType: "ASSIGNMENT_CREATED",
      description: `${taskTypeLabel(taskType)} assigned to ${staff.name}`,
      toStaffId: staffId,
      actorId: actor.actorId,
      actorName: actor.actorName,
      notes,
      metadata: { taskType, bookingId },
    });
    await recordAssignmentTimeline({
      assignmentId: assignment.id,
      pendingAssignmentId: pending.id,
      eventType: "READY_FOR_EXECUTION",
      description: "Assignment complete — ready for execution phase",
      toStaffId: staffId,
      actorId: actor.actorId,
      actorName: actor.actorName,
      metadata: { taskType },
    });

    const eventBase = baseAssignmentEventFields({
      assignmentId: assignment.id,
      pendingAssignmentId: pending.id,
      contractId: pending.contractRegistryId,
      customerId: pending.customerId,
      staffId,
      taskType,
      bookingId,
      actorId: actor.actorId,
    });
    assignmentDomainEventPublisher.publish({ ...eventBase, type: "AssignmentCreated", staffId });
    assignmentDomainEventPublisher.publish({ ...eventBase, type: "AssignmentReadyForExecution", staffId });

    const [location] = pending.serviceLocationId
      ? await db.select({
        label: serviceLocationsTable.label,
        locationType: serviceLocationsTable.locationType,
        city: serviceLocationsTable.city,
      })
        .from(serviceLocationsTable)
        .where(eq(serviceLocationsTable.id, pending.serviceLocationId))
        .limit(1)
      : [undefined];

    const [asset] = pending.assetId
      ? await db.select({ label: assetsTable.label }).from(assetsTable)
        .where(eq(assetsTable.id, pending.assetId)).limit(1)
      : [null];

    const [customer] = await db.select({ name: customersTable.name }).from(customersTable)
      .where(eq(customersTable.id, pending.customerId)).limit(1);

    void notifyStaffJobAssigned({
      staffId,
      customerName: customer?.name,
      serviceName: `${serviceName} — ${taskTypeLabel(taskType)}`,
      scheduledDate: getTodayIST(),
      executionId,
    });

    results.push({
      id: assignment.id,
      pendingAssignmentId: pending.id,
      contractId: pending.contractRegistryId,
      customerId: pending.customerId,
      customerName: customer?.name ?? "Customer",
      serviceLocationId: pending.serviceLocationId,
      serviceLocationLabel: location?.label ?? null,
      serviceLocationType: location?.locationType ?? null,
      serviceLocationCity: location?.city ?? null,
      assetId: pending.assetId,
      assetLabel: asset?.label ?? null,
      assignedStaffId: staffId,
      staffName: staff.name,
      serviceName,
      serviceType: productLine,
      taskType,
      taskTypeLabel: taskTypeLabel(taskType),
      assignedAt: now.toISOString(),
      status: "ready_for_execution",
      bookingId: bookingId ?? assignment.bookingId ?? null,
      notes,
    });
  }

  await markPendingFullyAssigned(pending.id, pending.contractRegistryId);

  if (
    tenant.companyId != null
    && (pending.companyId == null || pending.branchId == null || pending.franchiseeId == null)
  ) {
    await db.update(pendingServiceAssignmentsTable)
      .set({
        companyId: pending.companyId ?? tenant.companyId,
        branchId: pending.branchId ?? tenant.branchId,
        franchiseeId: pending.franchiseeId ?? tenant.franchiseeId,
        updatedAt: new Date(),
      })
      .where(eq(pendingServiceAssignmentsTable.id, pending.id));
  }

  return results;
}

export type SubstituteExecutionInput = {
  contractId: number;
  taskType: ServiceTaskType;
  substituteStaffId: number;
  scheduledDate?: string;
  reason?: string;
};

export async function recordSubstituteExecution(
  req: Request,
  input: SubstituteExecutionInput,
): Promise<{ executionId: number }> {
  const scheduledDate = input.scheduledDate ?? getTodayIST();

  const [contract] = await db.select().from(customerContractsTable)
    .where(eq(customerContractsTable.id, input.contractId))
    .limit(1);
  if (!contract || !rowInScope(req, {
    companyId: contract.companyId,
    branchId: contract.branchId,
    franchiseeId: contract.franchiseeId,
    customerId: contract.customerId,
  })) {
    throw new Error("Contract not found");
  }

  const required = getRequiredTaskTypesForContract(contract);
  if (!required.includes(input.taskType)) {
    throw new Error(`Task type ${input.taskType} is not part of this contract`);
  }

  const [primaryAssignment] = await db.select().from(serviceAssignmentsTable)
    .where(and(
      eq(serviceAssignmentsTable.contractId, input.contractId),
      eq(serviceAssignmentsTable.taskType, input.taskType),
      sql`${serviceAssignmentsTable.status} IN ('assigned', 'ready_for_execution')`,
    ))
    .orderBy(desc(serviceAssignmentsTable.assignedAt))
    .limit(1);

  if (!primaryAssignment) {
    throw new Error(`No primary ${taskTypeLabel(input.taskType)} assignment found for this contract`);
  }

  if (primaryAssignment.assignedStaffId === input.substituteStaffId) {
    throw new Error("Substitute must be a different staff member than the regular assignee");
  }

  const [substitute] = await db.select().from(staffTable)
    .where(and(eq(staffTable.id, input.substituteStaffId), eq(staffTable.isActive, true)))
    .limit(1);
  if (!substitute) throw new Error("Substitute staff not found or inactive");
  if (substitute.verificationStatus === "suspended") {
    throw new Error("Substitute staff is suspended");
  }

  const roleErr = await staffOperationalRoleError(substitute, roleSlugForTaskType(input.taskType));
  if (roleErr) throw new Error(roleErr);

  const [duplicate] = await db.select().from(serviceExecutionsTable)
    .where(and(
      eq(serviceExecutionsTable.contractId, input.contractId),
      eq(serviceExecutionsTable.taskType, input.taskType),
      eq(serviceExecutionsTable.scheduledDate, scheduledDate),
      eq(serviceExecutionsTable.assignedStaffId, input.substituteStaffId),
      sql`${serviceExecutionsTable.status} IN ('scheduled', 'started')`,
    ))
    .limit(1);
  if (duplicate) {
    throw new Error("Substitute already has an active job for this task today");
  }

  const executionId = await createScheduledExecutionForAssignment({
    serviceAssignmentId: primaryAssignment.id,
    contractId: input.contractId,
    customerId: primaryAssignment.customerId,
    serviceLocationId: primaryAssignment.serviceLocationId,
    assetId: primaryAssignment.assetId,
    assignedStaffId: input.substituteStaffId,
    taskType: input.taskType,
    scheduledDate,
    isSubstitute: true,
    substituteForStaffId: primaryAssignment.assignedStaffId,
    companyId: primaryAssignment.companyId,
    franchiseeId: primaryAssignment.franchiseeId,
    branchId: primaryAssignment.branchId,
  });

  if (input.reason?.trim()) {
    await db.insert(serviceExecutionNotesTable).values({
      executionId,
      kind: "internal",
      body: `Substitute assignment: ${input.reason.trim()}`,
    });
  }

  const [customer] = await db.select({ name: customersTable.name }).from(customersTable)
    .where(eq(customersTable.id, primaryAssignment.customerId)).limit(1);

  void notifyStaffJobAssigned({
    staffId: input.substituteStaffId,
    customerName: customer?.name,
    serviceName: `${primaryAssignment.serviceLabel ?? "Service"} — ${taskTypeLabel(input.taskType)} (substitute)`,
    scheduledDate,
    executionId,
  });

  return { executionId };
}

export async function listAssignedServices(
  req: Request,
  filters?: {
    serviceType?: string;
    serviceLocationId?: number;
    staffId?: number;
    dateFrom?: string;
    dateTo?: string;
  },
): Promise<AssignedServiceView[]> {
  const conditions: SQL[] = [
    sql`${serviceAssignmentsTable.status} IN ('assigned', 'ready_for_execution')`,
    ...tenantFilters(req, ASSIGNED_SCOPE),
  ];

  if (filters?.serviceLocationId) {
    conditions.push(eq(serviceAssignmentsTable.serviceLocationId, filters.serviceLocationId));
  }
  if (filters?.staffId) {
    conditions.push(eq(serviceAssignmentsTable.assignedStaffId, filters.staffId));
  }
  if (filters?.dateFrom) {
    conditions.push(sql`${serviceAssignmentsTable.assignedAt} >= ${filters.dateFrom}::date`);
  }
  if (filters?.dateTo) {
    conditions.push(sql`${serviceAssignmentsTable.assignedAt} < (${filters.dateTo}::date + interval '1 day')`);
  }
  if (filters?.serviceType) {
    conditions.push(sql`${serviceAssignmentsTable.productLine} = ${filters.serviceType}`);
  }

  const rows = await db.select({
    assignment: serviceAssignmentsTable,
    customerName: customersTable.name,
    staffName: staffTable.name,
    locationLabel: serviceLocationsTable.label,
    locationType: serviceLocationsTable.locationType,
    locationCity: serviceLocationsTable.city,
    assetLabel: assetsTable.label,
  })
    .from(serviceAssignmentsTable)
    .innerJoin(customersTable, eq(serviceAssignmentsTable.customerId, customersTable.id))
    .innerJoin(staffTable, eq(serviceAssignmentsTable.assignedStaffId, staffTable.id))
    .leftJoin(serviceLocationsTable, eq(serviceAssignmentsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(serviceAssignmentsTable.assetId, assetsTable.id))
    .where(and(...conditions))
    .orderBy(desc(serviceAssignmentsTable.assignedAt));

  return rows.map(r => ({
    id: r.assignment.id,
    pendingAssignmentId: r.assignment.pendingAssignmentId,
    contractId: r.assignment.contractId,
    customerId: r.assignment.customerId,
    customerName: r.customerName,
    serviceLocationId: r.assignment.serviceLocationId,
    serviceLocationLabel: r.locationLabel,
    serviceLocationType: r.locationType ?? null,
    serviceLocationCity: r.locationCity ?? null,
    assetId: r.assignment.assetId,
    assetLabel: r.assetLabel,
    assignedStaffId: r.assignment.assignedStaffId,
    staffName: r.staffName,
    serviceName: r.assignment.serviceLabel ?? serviceTypeLabel(r.assignment.productLine),
    serviceType: r.assignment.productLine ?? "service",
    taskType: (r.assignment.taskType ?? "one_time_service") as ServiceTaskType,
    taskTypeLabel: taskTypeLabel((r.assignment.taskType ?? "one_time_service") as ServiceTaskType),
    assignedAt: r.assignment.assignedAt.toISOString(),
    status: (r.assignment.status === "ready_for_execution" ? "ready_for_execution" : "assigned") as
      "assigned" | "ready_for_execution",
    bookingId: r.assignment.bookingId ?? null,
    notes: r.assignment.notes ?? null,
  }));
}

export async function getAssignmentDetail(req: Request, assignmentId: number) {
  const [row] = await db.select({
    assignment: serviceAssignmentsTable,
    customerName: customersTable.name,
    staffName: staffTable.name,
    locationLabel: serviceLocationsTable.label,
    locationAddress: serviceLocationsTable.address,
    assetLabel: assetsTable.label,
    pendingCreatedAt: pendingServiceAssignmentsTable.createdAt,
  })
    .from(serviceAssignmentsTable)
    .innerJoin(customersTable, eq(serviceAssignmentsTable.customerId, customersTable.id))
    .innerJoin(staffTable, eq(serviceAssignmentsTable.assignedStaffId, staffTable.id))
    .leftJoin(serviceLocationsTable, eq(serviceAssignmentsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(serviceAssignmentsTable.assetId, assetsTable.id))
    .leftJoin(pendingServiceAssignmentsTable, eq(serviceAssignmentsTable.pendingAssignmentId, pendingServiceAssignmentsTable.id))
    .where(eq(serviceAssignmentsTable.id, assignmentId))
    .limit(1);

  if (!row || !rowInScope(req, {
    companyId: row.assignment.companyId,
    branchId: row.assignment.branchId,
    franchiseeId: row.assignment.franchiseeId,
    customerId: row.assignment.customerId,
  })) {
    return null;
  }

  const timeline = await getAssignmentTimeline(assignmentId);

  return {
    id: row.assignment.id,
    pendingAssignmentId: row.assignment.pendingAssignmentId,
    contractId: row.assignment.contractId,
    customerId: row.assignment.customerId,
    customerName: row.customerName,
    serviceLocationId: row.assignment.serviceLocationId,
    serviceLocationLabel: row.locationLabel,
    serviceLocationAddress: row.locationAddress,
    assetId: row.assignment.assetId,
    assetLabel: row.assetLabel,
    assignedStaffId: row.assignment.assignedStaffId,
    staffName: row.staffName,
    serviceName: row.assignment.serviceLabel ?? serviceTypeLabel(row.assignment.productLine),
    serviceType: row.assignment.productLine,
    taskType: (row.assignment.taskType ?? "one_time_service") as ServiceTaskType,
    taskTypeLabel: taskTypeLabel((row.assignment.taskType ?? "one_time_service") as ServiceTaskType),
    assignedAt: row.assignment.assignedAt.toISOString(),
    queuedAt: row.pendingCreatedAt?.toISOString() ?? null,
    status: row.assignment.status,
    bookingId: row.assignment.bookingId ?? null,
    notes: row.assignment.notes ?? null,
    timeline: timeline.map(t => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      fromStaffId: t.fromStaffId,
      toStaffId: t.toStaffId,
      actorId: t.actorId,
      actorName: t.actorName,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

export async function reassignAssignment(
  req: Request,
  assignmentId: number,
  newStaffId: number,
  options?: { notes?: string | null },
): Promise<AssignedServiceView> {
  const [assignment] = await db.select().from(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.id, assignmentId))
    .limit(1);

  if (!assignment || !rowInScope(req, {
    companyId: assignment.companyId,
    branchId: assignment.branchId,
    franchiseeId: assignment.franchiseeId,
    customerId: assignment.customerId,
  })) {
    throw new Error("Assignment not found");
  }
  if (assignment.status === "removed") {
    throw new Error("Cannot reassign a removed assignment — assign from the waiting queue instead");
  }
  if (assignment.assignedStaffId === newStaffId) {
    throw new Error("New staff must be different from the current assignee");
  }

  const [staff] = await db.select().from(staffTable)
    .where(eq(staffTable.id, newStaffId))
    .limit(1);
  assertStaffAssignable(staff);
  assertStaffBranchMatch(staff, assignment.branchId);

  const taskType = (assignment.taskType ?? "one_time_service") as ServiceTaskType;
  const roleErr = await staffOperationalRoleError(staff, roleSlugForTaskType(taskType));
  if (roleErr) throw new Error(roleErr);

  const previousStaffId = assignment.assignedStaffId;
  const actor = actorFromReq(req);
  const notes = options?.notes?.trim() || null;
  const now = new Date();

  const [updated] = await db.update(serviceAssignmentsTable)
    .set({
      assignedStaffId: newStaffId,
      assignedAt: now,
      status: "ready_for_execution",
      notes: notes ?? assignment.notes,
      updatedAt: now,
    })
    .where(eq(serviceAssignmentsTable.id, assignmentId))
    .returning();

  await recordAssignmentTimeline({
    assignmentId,
    pendingAssignmentId: assignment.pendingAssignmentId,
    eventType: "ASSIGNMENT_CHANGED",
    description: `Reassigned ${taskTypeLabel(taskType)} to ${staff.name}`,
    fromStaffId: previousStaffId,
    toStaffId: newStaffId,
    actorId: actor.actorId,
    actorName: actor.actorName,
    notes,
  });

  assignmentDomainEventPublisher.publish({
    ...baseAssignmentEventFields({
      assignmentId,
      pendingAssignmentId: assignment.pendingAssignmentId,
      contractId: assignment.contractId,
      customerId: assignment.customerId,
      staffId: newStaffId,
      previousStaffId,
      taskType,
      bookingId: assignment.bookingId,
      actorId: actor.actorId,
    }),
    type: "AssignmentChanged",
    staffId: newStaffId,
    previousStaffId,
  });

  const [customer] = await db.select({ name: customersTable.name }).from(customersTable)
    .where(eq(customersTable.id, assignment.customerId)).limit(1);
  const [location] = assignment.serviceLocationId
    ? await db.select({
      label: serviceLocationsTable.label,
      locationType: serviceLocationsTable.locationType,
      city: serviceLocationsTable.city,
    }).from(serviceLocationsTable).where(eq(serviceLocationsTable.id, assignment.serviceLocationId)).limit(1)
    : [undefined];
  const [asset] = assignment.assetId
    ? await db.select({ label: assetsTable.label }).from(assetsTable)
      .where(eq(assetsTable.id, assignment.assetId)).limit(1)
    : [null];

  return {
    id: updated!.id,
    pendingAssignmentId: updated!.pendingAssignmentId,
    contractId: updated!.contractId,
    customerId: updated!.customerId,
    customerName: customer?.name ?? "Customer",
    serviceLocationId: updated!.serviceLocationId,
    serviceLocationLabel: location?.label ?? null,
    serviceLocationType: location?.locationType ?? null,
    serviceLocationCity: location?.city ?? null,
    assetId: updated!.assetId,
    assetLabel: asset?.label ?? null,
    assignedStaffId: newStaffId,
    staffName: staff.name,
    serviceName: updated!.serviceLabel ?? serviceTypeLabel(updated!.productLine),
    serviceType: updated!.productLine ?? "service",
    taskType,
    taskTypeLabel: taskTypeLabel(taskType),
    assignedAt: now.toISOString(),
    status: "ready_for_execution",
    bookingId: updated!.bookingId ?? null,
    notes: updated!.notes ?? null,
  };
}

export async function removeAssignment(
  req: Request,
  assignmentId: number,
  options?: { notes?: string | null },
): Promise<{ id: number; status: "removed" }> {
  const [assignment] = await db.select().from(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.id, assignmentId))
    .limit(1);

  if (!assignment || !rowInScope(req, {
    companyId: assignment.companyId,
    branchId: assignment.branchId,
    franchiseeId: assignment.franchiseeId,
    customerId: assignment.customerId,
  })) {
    throw new Error("Assignment not found");
  }
  if (assignment.status === "removed") {
    throw new Error("Assignment is already removed");
  }

  const actor = actorFromReq(req);
  const notes = options?.notes?.trim() || null;
  const previousStaffId = assignment.assignedStaffId;
  const now = new Date();

  await db.update(serviceAssignmentsTable)
    .set({ status: "removed", notes: notes ?? assignment.notes, updatedAt: now })
    .where(eq(serviceAssignmentsTable.id, assignmentId));

  await db.update(pendingServiceAssignmentsTable)
    .set({ status: "pending", updatedAt: now })
    .where(eq(pendingServiceAssignmentsTable.id, assignment.pendingAssignmentId));

  await recordAssignmentTimeline({
    assignmentId,
    pendingAssignmentId: assignment.pendingAssignmentId,
    eventType: "ASSIGNMENT_REMOVED",
    description: "Assignment removed — job returned to waiting queue",
    fromStaffId: previousStaffId,
    actorId: actor.actorId,
    actorName: actor.actorName,
    notes,
  });

  assignmentDomainEventPublisher.publish({
    ...baseAssignmentEventFields({
      assignmentId,
      pendingAssignmentId: assignment.pendingAssignmentId,
      contractId: assignment.contractId,
      customerId: assignment.customerId,
      previousStaffId,
      taskType: assignment.taskType ?? undefined,
      bookingId: assignment.bookingId,
      actorId: actor.actorId,
    }),
    type: "AssignmentRemoved",
    previousStaffId,
  });

  return { id: assignmentId, status: "removed" };
}
