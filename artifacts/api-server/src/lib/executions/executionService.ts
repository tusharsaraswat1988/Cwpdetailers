/**
 * Sprint 7 — execution domain service.
 * Mutates service_executions only — never service_assignments.
 */

import {
  db,
  serviceExecutionsTable,
  serviceExecutionPhotosTable,
  serviceExecutionNotesTable,
  serviceExecutionChecklistItemsTable,
  serviceExecutionLocationLogsTable,
  serviceAssignmentsTable,
  pendingServiceAssignmentsTable,
  customersTable,
  serviceLocationsTable,
  assetsTable,
  staffTable,
  customerContractsTable,
} from "@workspace/db";
import { eq, and, desc, sql, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { tenantFilters, rowInScope } from "../../middlewares/tenantScope";
import { getTodayIST } from "../../subscriptions/service";

const TASK_TYPE_LABELS: Record<string, string> = {
  daily_cleaning: "Daily Clean",
  car_wash: "Full Wash",
  solar_cleaning: "Solar Cleaning",
  interior_detailing: "Interior Detailing",
  one_time_service: "One-Time Service",
};

function taskTypeLabelFor(value: string | null | undefined): string {
  if (!value) return "Service";
  return TASK_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

export type ExecutionStatus =
  | "scheduled"
  | "started"
  | "completed"
  | "missed"
  | "cancelled"
  | "rescheduled";

const TERMINAL: ExecutionStatus[] = ["completed", "missed", "cancelled", "rescheduled"];
const ACTIVE: ExecutionStatus[] = ["scheduled", "started"];

const EXEC_SCOPE = {
  companyCol: serviceExecutionsTable.companyId,
  branchCol: serviceExecutionsTable.branchId,
  franchiseeCol: serviceExecutionsTable.franchiseeId,
  customerCol: serviceExecutionsTable.customerId,
  staffCol: serviceExecutionsTable.assignedStaffId,
};

export type ExecutionView = {
  id: number;
  serviceAssignmentId: number | null;
  contractId: number;
  customerId: number;
  customerName: string;
  serviceLocationId: number | null;
  serviceLocationLabel: string | null;
  serviceLocationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  assetId: number | null;
  assetLabel: string | null;
  serviceLabel: string | null;
  assignedStaffId: number;
  staffName: string;
  scheduledDate: string;
  scheduledTime: string | null;
  status: ExecutionStatus;
  startedAt: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  rescheduledFromId: number | null;
  taskType: string;
  taskTypeLabel: string;
  isSubstitute: boolean;
};

export type ExecutionDetail = ExecutionView & {
  photos: { id: number; kind: string; url: string; caption: string | null }[];
  notes: { id: number; kind: string; body: string; createdAt: string }[];
  checklist: { id: number; label: string; isCompleted: boolean }[];
  locationLogs: { id: number; eventType: string; latitude: number | null; longitude: number | null; recordedAt: string }[];
};

function mapExecutionRow(row: {
  execution: typeof serviceExecutionsTable.$inferSelect;
  customerName: string;
  staffName: string;
  locationLabel: string | null;
  locationAddress: string | null;
  locationLatitude: number | null;
  locationLongitude: number | null;
  assetLabel: string | null;
  serviceLabel: string | null;
}): ExecutionView {
  return {
    id: row.execution.id,
    serviceAssignmentId: row.execution.serviceAssignmentId,
    contractId: row.execution.contractId,
    customerId: row.execution.customerId,
    customerName: row.customerName,
    serviceLocationId: row.execution.serviceLocationId,
    serviceLocationLabel: row.locationLabel,
    serviceLocationAddress: row.locationAddress,
    locationLatitude: row.locationLatitude,
    locationLongitude: row.locationLongitude,
    assetId: row.execution.assetId,
    assetLabel: row.assetLabel,
    serviceLabel: row.serviceLabel,
    assignedStaffId: row.execution.assignedStaffId,
    staffName: row.staffName,
    scheduledDate: String(row.execution.scheduledDate).slice(0, 10),
    scheduledTime: row.execution.scheduledTime,
    status: row.execution.status as ExecutionStatus,
    startedAt: row.execution.startedAt?.toISOString() ?? null,
    completedAt: row.execution.completedAt?.toISOString() ?? null,
    cancellationReason: row.execution.cancellationReason,
    rescheduledFromId: row.execution.rescheduledFromId,
    taskType: row.execution.taskType ?? "one_time_service",
    taskTypeLabel: taskTypeLabelFor(row.execution.taskType),
    isSubstitute: row.execution.isSubstitute ?? false,
  };
}

const executionJoinSelect = {
  execution: serviceExecutionsTable,
  customerName: customersTable.name,
  staffName: staffTable.name,
  locationLabel: serviceLocationsTable.label,
  locationAddress: serviceLocationsTable.address,
  locationLatitude: serviceLocationsTable.latitude,
  locationLongitude: serviceLocationsTable.longitude,
  assetLabel: assetsTable.label,
  serviceLabel: serviceAssignmentsTable.serviceLabel,
};

function executionJoinQuery() {
  return db.select(executionJoinSelect)
    .from(serviceExecutionsTable)
    .innerJoin(customersTable, eq(serviceExecutionsTable.customerId, customersTable.id))
    .innerJoin(staffTable, eq(serviceExecutionsTable.assignedStaffId, staffTable.id))
    .leftJoin(serviceLocationsTable, eq(serviceExecutionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(serviceExecutionsTable.assetId, assetsTable.id))
    .leftJoin(serviceAssignmentsTable, eq(serviceExecutionsTable.serviceAssignmentId, serviceAssignmentsTable.id));
}

async function loadExecutionRow(executionId: number) {
  const [row] = await executionJoinQuery()
    .where(eq(serviceExecutionsTable.id, executionId))
    .limit(1);
  return row ?? null;
}

function assertInScope(req: Request, execution: typeof serviceExecutionsTable.$inferSelect) {
  return rowInScope(req, {
    companyId: execution.companyId,
    branchId: execution.branchId,
    franchiseeId: execution.franchiseeId,
    customerId: execution.customerId,
    staffId: execution.assignedStaffId,
  });
}

export type CreateScheduledExecutionInput = {
  serviceAssignmentId: number;
  contractId: number;
  customerId: number;
  serviceLocationId?: number | null;
  assetId?: number | null;
  assignedStaffId: number;
  taskType?: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  isSubstitute?: boolean;
  substituteForStaffId?: number | null;
  companyId?: number | null;
  franchiseeId?: number | null;
  branchId?: number | null;
};

export async function createScheduledExecutionForAssignment(
  input: CreateScheduledExecutionInput,
): Promise<number> {
  const [row] = await db.insert(serviceExecutionsTable).values({
    serviceAssignmentId: input.serviceAssignmentId,
    contractId: input.contractId,
    customerId: input.customerId,
    serviceLocationId: input.serviceLocationId ?? null,
    assetId: input.assetId ?? null,
    assignedStaffId: input.assignedStaffId,
    taskType: (input.taskType ?? "one_time_service") as typeof serviceExecutionsTable.$inferInsert.taskType,
    isSubstitute: input.isSubstitute ?? false,
    substituteForStaffId: input.substituteForStaffId ?? null,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime ?? null,
    status: "scheduled",
    companyId: input.companyId ?? null,
    franchiseeId: input.franchiseeId ?? null,
    branchId: input.branchId ?? null,
  }).returning();
  return row!.id;
}

export async function listTodayWork(req: Request, date?: string): Promise<ExecutionView[]> {
  const targetDate = date ?? getTodayIST();
  const conditions: SQL[] = [
    eq(serviceExecutionsTable.scheduledDate, targetDate),
    ...tenantFilters(req, EXEC_SCOPE),
  ];

  if (req.scope?.staffId && req.user?.role === "staff") {
    conditions.push(eq(serviceExecutionsTable.assignedStaffId, req.scope.staffId));
  }

  const rows = await executionJoinQuery()
    .where(and(...conditions))
    .orderBy(serviceExecutionsTable.scheduledTime, desc(serviceExecutionsTable.createdAt));

  return rows.map(mapExecutionRow);
}

export async function listStaffExecutions(
  req: Request,
  opts?: { limit?: number; staffId?: number },
): Promise<ExecutionView[]> {
  const limit = Math.min(opts?.limit ?? 100, 100);
  const conditions: SQL[] = [...tenantFilters(req, EXEC_SCOPE)];

  const staffId = opts?.staffId ?? (req.user?.role === "staff" ? req.scope?.staffId : undefined);
  if (staffId) {
    conditions.push(eq(serviceExecutionsTable.assignedStaffId, staffId));
  }

  const rows = await executionJoinQuery()
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(serviceExecutionsTable.scheduledDate), desc(serviceExecutionsTable.createdAt))
    .limit(limit);

  return rows.map(mapExecutionRow);
}

export async function getExecutionDetail(req: Request, executionId: number): Promise<ExecutionDetail | null> {
  const row = await loadExecutionRow(executionId);
  if (!row || !assertInScope(req, row.execution)) return null;

  const [photos, notes, checklist, locationLogs] = await Promise.all([
    db.select().from(serviceExecutionPhotosTable)
      .where(eq(serviceExecutionPhotosTable.executionId, executionId))
      .orderBy(serviceExecutionPhotosTable.createdAt),
    db.select().from(serviceExecutionNotesTable)
      .where(eq(serviceExecutionNotesTable.executionId, executionId))
      .orderBy(serviceExecutionNotesTable.createdAt),
    db.select().from(serviceExecutionChecklistItemsTable)
      .where(eq(serviceExecutionChecklistItemsTable.executionId, executionId))
      .orderBy(serviceExecutionChecklistItemsTable.sortOrder),
    db.select().from(serviceExecutionLocationLogsTable)
      .where(eq(serviceExecutionLocationLogsTable.executionId, executionId))
      .orderBy(desc(serviceExecutionLocationLogsTable.recordedAt)),
  ]);

  return {
    ...mapExecutionRow(row),
    photos: photos.map(p => ({ id: p.id, kind: p.kind, url: p.url, caption: p.caption })),
    notes: notes.map(n => ({ id: n.id, kind: n.kind, body: n.body, createdAt: n.createdAt.toISOString() })),
    checklist: checklist.map(c => ({ id: c.id, label: c.label, isCompleted: c.isCompleted })),
    locationLogs: locationLogs.map(l => ({
      id: l.id,
      eventType: l.eventType,
      latitude: l.latitude,
      longitude: l.longitude,
      recordedAt: l.recordedAt.toISOString(),
    })),
  };
}

async function getMutableExecution(req: Request, executionId: number) {
  const row = await loadExecutionRow(executionId);
  if (!row || !assertInScope(req, row.execution)) {
    throw new Error("Execution not found");
  }
  if (TERMINAL.includes(row.execution.status as ExecutionStatus)) {
    throw new Error(`Execution is already ${row.execution.status}`);
  }
  return row.execution;
}

export async function startExecution(req: Request, executionId: number, gps?: {
  latitude?: number; longitude?: number; accuracy?: number;
}): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (execution.status !== "scheduled") {
    throw new Error("Only scheduled executions can be started");
  }
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ status: "started", startedAt: now, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, executionId));

  if (gps?.latitude != null && gps?.longitude != null) {
    await db.insert(serviceExecutionLocationLogsTable).values({
      executionId,
      eventType: "check_in",
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy ?? null,
    });
  }

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export type CompleteExecutionInput = {
  photos?: { kind?: "before" | "after" | "proof" | "other"; url: string; caption?: string }[];
  notes?: { kind?: "technician" | "customer" | "internal"; body: string }[];
  checklist?: { label: string; isCompleted: boolean }[];
  gps?: { latitude?: number; longitude?: number; accuracy?: number };
};

export async function completeExecution(
  req: Request,
  executionId: number,
  input: CompleteExecutionInput = {},
): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!ACTIVE.includes(execution.status as ExecutionStatus)) {
    throw new Error("Execution cannot be completed from current status");
  }
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "completed",
      startedAt: execution.startedAt ?? now,
      completedAt: now,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  const staffId = req.scope?.staffId ?? null;
  if (input.photos?.length) {
    await db.insert(serviceExecutionPhotosTable).values(
      input.photos.map(p => ({
        executionId,
        kind: p.kind ?? "proof",
        url: p.url,
        caption: p.caption ?? null,
      })),
    );
  }
  if (input.notes?.length) {
    await db.insert(serviceExecutionNotesTable).values(
      input.notes.map(n => ({
        executionId,
        kind: n.kind ?? "technician",
        body: n.body,
        authorStaffId: staffId,
      })),
    );
  }
  if (input.checklist?.length) {
    await db.insert(serviceExecutionChecklistItemsTable).values(
      input.checklist.map((c, i) => ({
        executionId,
        label: c.label,
        isCompleted: c.isCompleted,
        completedAt: c.isCompleted ? now : null,
        sortOrder: i,
      })),
    );
  }
  if (input.gps?.latitude != null && input.gps?.longitude != null) {
    await db.insert(serviceExecutionLocationLogsTable).values({
      executionId,
      eventType: "check_out",
      latitude: input.gps.latitude,
      longitude: input.gps.longitude,
      accuracy: input.gps.accuracy ?? null,
    });
  }

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function missExecution(req: Request, executionId: number, reason?: string): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!ACTIVE.includes(execution.status as ExecutionStatus)) {
    throw new Error("Execution cannot be marked missed from current status");
  }
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "missed",
      cancellationReason: reason ?? "Marked missed",
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));
  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function cancelExecution(req: Request, executionId: number, reason?: string): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!ACTIVE.includes(execution.status as ExecutionStatus)) {
    throw new Error("Execution cannot be cancelled from current status");
  }
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "cancelled",
      cancellationReason: reason ?? "Cancelled",
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));
  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function rescheduleExecution(
  req: Request,
  executionId: number,
  input: { scheduledDate: string; scheduledTime?: string | null; reason?: string },
): Promise<{ previous: ExecutionView; next: ExecutionView }> {
  const execution = await getMutableExecution(req, executionId);
  if (!ACTIVE.includes(execution.status as ExecutionStatus)) {
    throw new Error("Execution cannot be rescheduled from current status");
  }
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "rescheduled",
      cancellationReason: input.reason ?? "Rescheduled",
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  const [nextRow] = await db.insert(serviceExecutionsTable).values({
    serviceAssignmentId: execution.serviceAssignmentId,
    contractId: execution.contractId,
    customerId: execution.customerId,
    serviceLocationId: execution.serviceLocationId,
    assetId: execution.assetId,
    assignedStaffId: execution.assignedStaffId,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime ?? null,
    status: "scheduled",
    rescheduledFromId: executionId,
    companyId: execution.companyId,
    franchiseeId: execution.franchiseeId,
    branchId: execution.branchId,
  }).returning();

  const [prevLoaded, nextLoaded] = await Promise.all([
    loadExecutionRow(executionId),
    loadExecutionRow(nextRow!.id),
  ]);
  return {
    previous: mapExecutionRow(prevLoaded!),
    next: mapExecutionRow(nextLoaded!),
  };
}

export type ServiceUpdatesSummary = {
  date: string;
  pending: number;
  assigned: number;
  scheduled: number;
  started: number;
  completed: number;
  missed: number;
  cancelled: number;
};

export async function getServiceUpdatesSummary(req: Request, date: string): Promise<ServiceUpdatesSummary> {
  const pendingScope = tenantFilters(req, {
    companyCol: pendingServiceAssignmentsTable.companyId,
    branchCol: pendingServiceAssignmentsTable.branchId,
    franchiseeCol: pendingServiceAssignmentsTable.franchiseeId,
    customerCol: pendingServiceAssignmentsTable.customerId,
  });

  const assignedScope = tenantFilters(req, {
    companyCol: serviceAssignmentsTable.companyId,
    branchCol: serviceAssignmentsTable.branchId,
    franchiseeCol: serviceAssignmentsTable.franchiseeId,
    customerCol: serviceAssignmentsTable.customerId,
  });

  const execScope = tenantFilters(req, EXEC_SCOPE);
  const execDateFilter = and(eq(serviceExecutionsTable.scheduledDate, date), ...execScope);

  const [pendingRow, assignedRow, execRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(pendingServiceAssignmentsTable)
      .where(and(eq(pendingServiceAssignmentsTable.status, "pending"), ...pendingScope)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(serviceAssignmentsTable)
      .where(and(eq(serviceAssignmentsTable.status, "assigned"), ...assignedScope)),
    db.select({
      status: serviceExecutionsTable.status,
      count: sql<number>`count(*)::int`,
    })
      .from(serviceExecutionsTable)
      .where(execDateFilter)
      .groupBy(serviceExecutionsTable.status),
  ]);

  const byStatus = Object.fromEntries(execRows.map(r => [r.status, Number(r.count)]));

  return {
    date,
    pending: Number(pendingRow[0]?.count ?? 0),
    assigned: Number(assignedRow[0]?.count ?? 0),
    scheduled: byStatus.scheduled ?? 0,
    started: byStatus.started ?? 0,
    completed: byStatus.completed ?? 0,
    missed: byStatus.missed ?? 0,
    cancelled: byStatus.cancelled ?? 0,
  };
}

export async function listExecutionsForTimeline(req: Request, date: string) {
  const rows = await db.select({
    execution: serviceExecutionsTable,
    customerName: customersTable.name,
    staffName: staffTable.name,
    locationLabel: serviceLocationsTable.label,
    assetLabel: assetsTable.label,
    productLine: customerContractsTable.productLine,
  })
    .from(serviceExecutionsTable)
    .innerJoin(customersTable, eq(serviceExecutionsTable.customerId, customersTable.id))
    .innerJoin(staffTable, eq(serviceExecutionsTable.assignedStaffId, staffTable.id))
    .innerJoin(customerContractsTable, eq(serviceExecutionsTable.contractId, customerContractsTable.id))
    .leftJoin(serviceLocationsTable, eq(serviceExecutionsTable.serviceLocationId, serviceLocationsTable.id))
    .leftJoin(assetsTable, eq(serviceExecutionsTable.assetId, assetsTable.id))
    .where(and(eq(serviceExecutionsTable.scheduledDate, date), ...tenantFilters(req, EXEC_SCOPE)))
    .orderBy(serviceExecutionsTable.scheduledTime);

  return rows.map(r => ({
    id: `execution-${r.execution.id}`,
    channel: "execution" as const,
    executionId: r.execution.id,
    customerId: r.execution.customerId,
    customerName: r.customerName,
    assetLabel: r.assetLabel ?? r.locationLabel,
    workType: r.productLine.replace(/_/g, " "),
    status: r.execution.status,
    scheduledAt: `${r.execution.scheduledDate}T${r.execution.scheduledTime ?? "00:00"}:00`,
    staffName: r.staffName,
    staffId: r.execution.assignedStaffId,
  }));
}
