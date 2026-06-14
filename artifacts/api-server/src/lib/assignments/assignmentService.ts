/**
 * Sprint 6 — unified manual assignment from pending_service_assignments queue.
 *
 * pending_service_assignments is the long-term operational queue (Sprint 6 approved).
 * service_assignments records assignment only — execution is a separate domain (Sprint 7).
 * Does NOT assign staff directly on bookings/subscriptions/entitlements.
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
} from "@workspace/db";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters, rowInScope } from "../../middlewares/tenantScope";
import { listCustomerContracts } from "../contracts/contractRegistry";
import { createScheduledExecutionForAssignment } from "../executions/executionService";
import { getTodayIST } from "../../subscriptions/service";

export type AssignmentPriority = "normal" | "high";

export type PendingAssignmentView = {
  id: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceId: number | null;
  serviceName: string;
  serviceType: string;
  priority: AssignmentPriority;
  createdAt: string;
};

export type AssignedServiceView = {
  id: number;
  pendingAssignmentId: number;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  assetId: number | null;
  assetLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  serviceName: string;
  serviceType: string;
  assignedAt: string;
  status: "assigned";
};

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
    eq(pendingServiceAssignmentsTable.status, "pending"),
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
    assetLabel: assetsTable.label,
    productLine: customerContractsTable.productLine,
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

  let result: PendingAssignmentView[] = rows.map(r => ({
    id: r.pending.id,
    contractId: r.pending.contractRegistryId,
    customerId: r.pending.customerId,
    customerName: r.customerName,
    serviceLocationId: r.pending.serviceLocationId,
    serviceLocationLabel: r.locationLabel,
    assetId: r.pending.assetId,
    assetLabel: r.assetLabel,
    serviceId: r.pending.serviceId,
    serviceName: nameByContract.get(r.pending.contractRegistryId)
      ?? serviceTypeLabel(r.productLine),
    serviceType: r.productLine,
    priority: computePriority(r.pending.createdAt),
    createdAt: r.pending.createdAt.toISOString(),
  }));

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

  if (!pending || !rowInScope(req, {
    companyId: pending.companyId,
    branchId: pending.branchId,
    franchiseeId: pending.franchiseeId,
    customerId: pending.customerId,
  })) {
    throw new Error("Pending assignment not found");
  }
  if (pending.status !== "pending") {
    throw new Error("This work item is no longer pending assignment");
  }
  if (!pending.serviceLocationId) {
    throw new Error("Service location is required before assignment");
  }

  const [staff] = await db.select().from(staffTable)
    .where(and(eq(staffTable.id, staffId), eq(staffTable.isActive, true)))
    .limit(1);
  if (!staff) throw new Error("Staff member not found or inactive");
  if (staff.verificationStatus === "suspended") {
    throw new Error("Staff member is suspended and cannot be assigned");
  }

  const [existing] = await db.select().from(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.pendingAssignmentId, pendingAssignmentId))
    .limit(1);
  if (existing) throw new Error("Assignment already exists for this pending item");

  const { serviceName, productLine } = await resolveServiceName(
    pending.contractRegistryId,
    pending.serviceId,
  );

  const now = new Date();

  const [assignment] = await db.insert(serviceAssignmentsTable).values({
    pendingAssignmentId: pending.id,
    customerId: pending.customerId,
    serviceLocationId: pending.serviceLocationId,
    assetId: pending.assetId,
    contractId: pending.contractRegistryId,
    serviceId: pending.serviceId,
    assignedStaffId: staffId,
    assignedAt: now,
    status: "assigned",
    serviceLabel: serviceName,
    productLine,
    companyId: pending.companyId,
    franchiseeId: pending.franchiseeId,
    branchId: pending.branchId,
  }).returning();

  await db.update(pendingServiceAssignmentsTable)
    .set({ status: "assigned", updatedAt: now })
    .where(eq(pendingServiceAssignmentsTable.id, pending.id));

  await createScheduledExecutionForAssignment({
    serviceAssignmentId: assignment!.id,
    contractId: pending.contractRegistryId,
    customerId: pending.customerId,
    serviceLocationId: pending.serviceLocationId,
    assetId: pending.assetId,
    assignedStaffId: staffId,
    scheduledDate: getTodayIST(),
    companyId: pending.companyId,
    franchiseeId: pending.franchiseeId,
    branchId: pending.branchId,
  });

  const [location] = await db.select({ label: serviceLocationsTable.label })
    .from(serviceLocationsTable)
    .where(eq(serviceLocationsTable.id, pending.serviceLocationId))
    .limit(1);

  const [asset] = pending.assetId
    ? await db.select({ label: assetsTable.label }).from(assetsTable)
      .where(eq(assetsTable.id, pending.assetId)).limit(1)
    : [null];

  const [customer] = await db.select({ name: customersTable.name }).from(customersTable)
    .where(eq(customersTable.id, pending.customerId)).limit(1);

  return {
    id: assignment!.id,
    pendingAssignmentId: pending.id,
    contractId: pending.contractRegistryId,
    customerId: pending.customerId,
    customerName: customer?.name ?? "Customer",
    serviceLocationId: pending.serviceLocationId,
    serviceLocationLabel: location?.label ?? null,
    assetId: pending.assetId,
    assetLabel: asset?.label ?? null,
    assignedStaffId: staffId,
    staffName: staff.name,
    serviceName,
    serviceType: productLine,
    assignedAt: now.toISOString(),
    status: "assigned",
  };
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
    eq(serviceAssignmentsTable.status, "assigned"),
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
    assetId: r.assignment.assetId,
    assetLabel: r.assetLabel,
    assignedStaffId: r.assignment.assignedStaffId,
    staffName: r.staffName,
    serviceName: r.assignment.serviceLabel ?? serviceTypeLabel(r.assignment.productLine),
    serviceType: r.assignment.productLine ?? "service",
    assignedAt: r.assignment.assignedAt.toISOString(),
    status: "assigned" as const,
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
    assignedAt: row.assignment.assignedAt.toISOString(),
    queuedAt: row.pendingCreatedAt?.toISOString() ?? null,
    status: row.assignment.status,
  };
}
