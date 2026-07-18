/**
 * Phase 5.4 — Field Execution platform.
 * Business question: "How is an assigned service executed?"
 * Mutates service_executions (+ evidence/timeline) only — never Booking or Assignment.
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
import {
  assertAssignedTechnician,
  assertAssignmentAllowsExecution,
  assertNotCompleted,
  actorFromReq,
  isReady,
  isInProgress,
  isTerminal,
  WORKABLE_STATUSES,
} from "./executionValidation";
import { recordExecutionTimeline, getExecutionTimeline } from "./executionTimeline";
import {
  executionDomainEventPublisher,
  baseExecutionEventFields,
} from "./domainEvents";

const TASK_TYPE_LABELS: Record<string, string> = {
  daily_cleaning: "Daily Clean",
  car_wash: "Full Wash",
  solar_cleaning: "Solar Cleaning",
  interior_detailing: "Interior Detailing",
  one_time_service: "One-Time Service",
};

const DEFAULT_CHECKLIST = [
  "Arrive at service location",
  "Inspect vehicle / asset condition",
  "Complete service as specified",
  "Clean up work area",
  "Confirm with customer (if present)",
];

function taskTypeLabelFor(value: string | null | undefined): string {
  if (!value) return "Service";
  return TASK_TYPE_LABELS[value] ?? value.replace(/_/g, " ");
}

export type ExecutionStatus = FieldExecutionStatus;

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
  pausedAt: string | null;
  resumedAt: string | null;
  completedAt: string | null;
  customerSignatureUrl: string | null;
  customerSignedAt: string | null;
  cancellationReason: string | null;
  rescheduledFromId: number | null;
  taskType: string;
  taskTypeLabel: string;
  isSubstitute: boolean;
};

export type ExecutionDetail = ExecutionView & {
  photos: { id: number; kind: string; url: string; caption: string | null; latitude: number | null; longitude: number | null; accuracy: number | null }[];
  notes: { id: number; kind: string; body: string; createdAt: string }[];
  checklist: { id: number; label: string; isCompleted: boolean; completedAt: string | null }[];
  locationLogs: { id: number; eventType: string; latitude: number | null; longitude: number | null; recordedAt: string }[];
  timeline: {
    id: number;
    eventType: string;
    title: string;
    description: string | null;
    actorId: number | null;
    actorName: string | null;
    createdAt: string;
  }[];
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
    pausedAt: row.execution.pausedAt?.toISOString() ?? null,
    resumedAt: row.execution.resumedAt?.toISOString() ?? null,
    completedAt: row.execution.completedAt?.toISOString() ?? null,
    customerSignatureUrl: row.execution.customerSignatureUrl ?? null,
    customerSignedAt: row.execution.customerSignedAt?.toISOString() ?? null,
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

async function loadLinkedAssignment(serviceAssignmentId: number | null) {
  if (serviceAssignmentId == null) return null;
  const [row] = await db.select().from(serviceAssignmentsTable)
    .where(eq(serviceAssignmentsTable.id, serviceAssignmentId))
    .limit(1);
  return row ?? null;
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

/**
 * Handoff from Assignment: creates execution at ready_for_execution.
 * Rejects duplicate active execution for same assignment + task type.
 */
export async function createScheduledExecutionForAssignment(
  input: CreateScheduledExecutionInput,
): Promise<number> {
  const taskType = (input.taskType ?? "one_time_service") as typeof serviceExecutionsTable.$inferInsert.taskType;

  const [duplicate] = await db.select({ id: serviceExecutionsTable.id })
    .from(serviceExecutionsTable)
    .where(and(
      eq(serviceExecutionsTable.serviceAssignmentId, input.serviceAssignmentId),
      eq(serviceExecutionsTable.taskType, taskType),
      sql`${serviceExecutionsTable.status} NOT IN ('completed', 'cancelled', 'missed', 'rescheduled')`,
    ))
    .limit(1);
  if (duplicate && !input.isSubstitute) {
    throw new Error("Duplicate execution — an active execution already exists for this assignment");
  }

  const [row] = await db.insert(serviceExecutionsTable).values({
    serviceAssignmentId: input.serviceAssignmentId,
    contractId: input.contractId,
    customerId: input.customerId,
    serviceLocationId: input.serviceLocationId ?? null,
    assetId: input.assetId ?? null,
    assignedStaffId: input.assignedStaffId,
    taskType,
    isSubstitute: input.isSubstitute ?? false,
    substituteForStaffId: input.substituteForStaffId ?? null,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime ?? null,
    status: "ready_for_execution",
    companyId: input.companyId ?? null,
    franchiseeId: input.franchiseeId ?? null,
    branchId: input.branchId ?? null,
  }).returning();

  await recordExecutionTimeline({
    executionId: row!.id,
    eventType: "EXECUTION_READY",
    description: "Execution ready for field work",
    metadata: { serviceAssignmentId: input.serviceAssignmentId, taskType },
  });

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

  const [photos, notes, checklist, locationLogs, timeline] = await Promise.all([
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
    getExecutionTimeline(executionId),
  ]);

  return {
    ...mapExecutionRow(row),
    photos: photos.map(p => ({
      id: p.id,
      kind: p.kind,
      url: p.url,
      caption: p.caption,
      latitude: p.latitude,
      longitude: p.longitude,
      accuracy: p.accuracy,
    })),
    notes: notes.map(n => ({ id: n.id, kind: n.kind, body: n.body, createdAt: n.createdAt.toISOString() })),
    checklist: checklist.map(c => ({
      id: c.id,
      label: c.label,
      isCompleted: c.isCompleted,
      completedAt: c.completedAt?.toISOString() ?? null,
    })),
    locationLogs: locationLogs.map(l => ({
      id: l.id,
      eventType: l.eventType,
      latitude: l.latitude,
      longitude: l.longitude,
      recordedAt: l.recordedAt.toISOString(),
    })),
    timeline: timeline.map(t => ({
      id: t.id,
      eventType: t.eventType,
      title: t.title,
      description: t.description,
      actorId: t.actorId,
      actorName: t.actorName,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

async function getMutableExecution(req: Request, executionId: number) {
  const row = await loadExecutionRow(executionId);
  if (!row || !assertInScope(req, row.execution)) {
    throw new Error("Execution not found");
  }
  assertNotCompleted(row.execution);
  assertAssignedTechnician(req, row.execution);
  return row.execution;
}

function eventBase(execution: typeof serviceExecutionsTable.$inferSelect, actorId: number | null) {
  return baseExecutionEventFields({
    executionId: execution.id,
    serviceAssignmentId: execution.serviceAssignmentId,
    contractId: execution.contractId,
    customerId: execution.customerId,
    staffId: execution.assignedStaffId,
    actorId,
  });
}

async function ensureDefaultChecklist(executionId: number): Promise<void> {
  const existing = await db.select({ id: serviceExecutionChecklistItemsTable.id })
    .from(serviceExecutionChecklistItemsTable)
    .where(eq(serviceExecutionChecklistItemsTable.executionId, executionId))
    .limit(1);
  if (existing.length) return;
  await db.insert(serviceExecutionChecklistItemsTable).values(
    DEFAULT_CHECKLIST.map((label, i) => ({
      executionId,
      label,
      isCompleted: false,
      sortOrder: i,
    })),
  );
}

export async function startExecution(req: Request, executionId: number, gps?: {
  latitude?: number; longitude?: number; accuracy?: number;
}): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!isReady(execution.status)) {
    throw new Error("Only ready executions can be started");
  }

  const assignment = await loadLinkedAssignment(execution.serviceAssignmentId);
  assertAssignmentAllowsExecution(assignment);

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ status: "started", startedAt: now, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, executionId));

  await ensureDefaultChecklist(executionId);

  if (gps?.latitude != null && gps?.longitude != null) {
    await db.insert(serviceExecutionLocationLogsTable).values({
      executionId,
      eventType: "check_in",
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: gps.accuracy ?? null,
    });
  }

  await recordExecutionTimeline({
    executionId,
    eventType: "EXECUTION_STARTED",
    description: "Technician started work",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  executionDomainEventPublisher.publish({
    ...eventBase(execution, actor.actorId),
    type: "ExecutionStarted",
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function pauseExecution(req: Request, executionId: number, reason?: string): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!isInProgress(execution.status)) {
    throw new Error("Only in-progress executions can be paused");
  }
  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ status: "paused", pausedAt: now, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordExecutionTimeline({
    executionId,
    eventType: "EXECUTION_PAUSED",
    description: reason?.trim() || "Work paused",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  executionDomainEventPublisher.publish({
    ...eventBase(execution, actor.actorId),
    type: "ExecutionPaused",
    metadata: { reason },
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function resumeExecution(req: Request, executionId: number): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (execution.status !== "paused") {
    throw new Error("Only paused executions can be resumed");
  }
  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({ status: "resumed", resumedAt: now, updatedAt: now })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordExecutionTimeline({
    executionId,
    eventType: "EXECUTION_RESUMED",
    description: "Work resumed",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  executionDomainEventPublisher.publish({
    ...eventBase(execution, actor.actorId),
    type: "ExecutionResumed",
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export type CompleteExecutionInput = {
  photos?: { kind?: "before" | "after" | "proof" | "other"; url: string; caption?: string; latitude?: number; longitude?: number; accuracy?: number }[];
  notes?: { kind?: "technician" | "customer" | "internal"; body: string }[];
  checklist?: { label: string; isCompleted: boolean }[];
  customerSignatureUrl?: string;
  gps?: { latitude?: number; longitude?: number; accuracy?: number };
};

const REQUIRED_JOB_PHOTOS = 3;

function isDailyCleanTask(taskType: string | null | undefined) {
  return taskType === "daily_cleaning";
}

async function countExecutionPhotos(executionId: number) {
  const rows = await db.select().from(serviceExecutionPhotosTable)
    .where(eq(serviceExecutionPhotosTable.executionId, executionId));
  return {
    before: rows.filter(r => r.kind === "before").length,
    after: rows.filter(r => r.kind === "after").length,
  };
}

export type AddExecutionPhotoInput = {
  kind: "before" | "after" | "proof" | "other";
  url: string;
  caption?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
};

export async function addExecutionPhotos(
  req: Request,
  executionId: number,
  photos: AddExecutionPhotoInput[],
): Promise<ExecutionDetail> {
  const execution = await getMutableExecution(req, executionId);
  if (!isInProgress(execution.status)) {
    throw new Error(
      execution.status === "paused"
        ? "Resume work before uploading photos"
        : "Photos can only be added while work is in progress",
    );
  }
  if (!photos.length) throw new Error("At least one photo is required");

  for (const p of photos) {
    if (p.latitude == null || p.longitude == null) {
      throw new Error("Geo-tagged location is required for every photo");
    }
  }

  await db.insert(serviceExecutionPhotosTable).values(
    photos.map(p => ({
      executionId,
      kind: p.kind,
      url: p.url,
      caption: p.caption ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      accuracy: p.accuracy ?? null,
    })),
  );

  const actor = actorFromReq(req);
  const beforeCount = photos.filter(p => p.kind === "before").length;
  const afterCount = photos.filter(p => p.kind === "after").length;
  if (beforeCount > 0) {
    await recordExecutionTimeline({
      executionId,
      eventType: "BEFORE_PHOTOS_UPLOADED",
      description: `${beforeCount} before photo(s) uploaded`,
      actorId: actor.actorId,
      actorName: actor.actorName,
    });
    executionDomainEventPublisher.publish({
      ...eventBase(execution, actor.actorId),
      type: "BeforePhotosUploaded",
      metadata: { count: beforeCount },
    });
  }
  if (afterCount > 0) {
    await recordExecutionTimeline({
      executionId,
      eventType: "AFTER_PHOTOS_UPLOADED",
      description: `${afterCount} after photo(s) uploaded`,
      actorId: actor.actorId,
      actorName: actor.actorName,
    });
    executionDomainEventPublisher.publish({
      ...eventBase(execution, actor.actorId),
      type: "AfterPhotosUploaded",
      metadata: { count: afterCount },
    });
  }

  const detail = await getExecutionDetail(req, executionId);
  if (!detail) throw new Error("Execution not found");
  return detail;
}

export async function saveExecutionNotes(
  req: Request,
  executionId: number,
  notes: { kind?: "technician" | "customer" | "internal"; body: string }[],
): Promise<ExecutionDetail> {
  const execution = await getMutableExecution(req, executionId);
  if (!WORKABLE_STATUSES.includes(execution.status as FieldExecutionStatus) && !isReady(execution.status)) {
    throw new Error("Notes cannot be saved for this execution status");
  }
  if (!notes.length) throw new Error("At least one note is required");

  const actor = actorFromReq(req);
  const staffId = req.scope?.staffId ?? null;
  await db.insert(serviceExecutionNotesTable).values(
    notes.map(n => ({
      executionId,
      kind: n.kind ?? "technician",
      body: n.body,
      authorStaffId: staffId,
    })),
  );

  for (const n of notes) {
    await recordExecutionTimeline({
      executionId,
      eventType: "NOTE_ADDED",
      description: n.body.slice(0, 200),
      actorId: actor.actorId,
      actorName: actor.actorName,
    });
  }

  const detail = await getExecutionDetail(req, executionId);
  if (!detail) throw new Error("Execution not found");
  return detail;
}

export async function saveExecutionChecklist(
  req: Request,
  executionId: number,
  items: { id?: number; label: string; isCompleted: boolean }[],
): Promise<ExecutionDetail> {
  const execution = await getMutableExecution(req, executionId);
  if (!isInProgress(execution.status) && execution.status !== "paused") {
    throw new Error("Checklist can only be updated while work is in progress or paused");
  }
  if (!items.length) throw new Error("Checklist items required");

  const actor = actorFromReq(req);
  const now = new Date();

  for (const item of items) {
    if (item.id) {
      await db.update(serviceExecutionChecklistItemsTable)
        .set({
          label: item.label,
          isCompleted: item.isCompleted,
          completedAt: item.isCompleted ? now : null,
        })
        .where(and(
          eq(serviceExecutionChecklistItemsTable.id, item.id),
          eq(serviceExecutionChecklistItemsTable.executionId, executionId),
        ));
    } else {
      await db.insert(serviceExecutionChecklistItemsTable).values({
        executionId,
        label: item.label,
        isCompleted: item.isCompleted,
        completedAt: item.isCompleted ? now : null,
        sortOrder: 0,
      });
    }
  }

  const all = await db.select().from(serviceExecutionChecklistItemsTable)
    .where(eq(serviceExecutionChecklistItemsTable.executionId, executionId));
  const allDone = all.length > 0 && all.every(c => c.isCompleted);

  await recordExecutionTimeline({
    executionId,
    eventType: allDone ? "CHECKLIST_COMPLETED" : "CHECKLIST_UPDATED",
    description: allDone ? "All checklist items completed" : "Checklist updated",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  if (allDone) {
    executionDomainEventPublisher.publish({
      ...eventBase(execution, actor.actorId),
      type: "ChecklistCompleted",
    });
  }

  const detail = await getExecutionDetail(req, executionId);
  if (!detail) throw new Error("Execution not found");
  return detail;
}

export async function saveCustomerSignature(
  req: Request,
  executionId: number,
  signatureUrl: string,
): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!isInProgress(execution.status) && execution.status !== "paused") {
    throw new Error("Signature can only be captured while work is in progress");
  }
  if (!signatureUrl?.trim()) throw new Error("signatureUrl is required");

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      customerSignatureUrl: signatureUrl.trim(),
      customerSignedAt: now,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordExecutionTimeline({
    executionId,
    eventType: "SIGNATURE_CAPTURED",
    description: "Customer signature captured",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function completeExecution(
  req: Request,
  executionId: number,
  input: CompleteExecutionInput = {},
): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (!isInProgress(execution.status)) {
    throw new Error("Start work before completing — cannot complete from current status");
  }

  if (!isDailyCleanTask(execution.taskType)) {
    const counts = await countExecutionPhotos(executionId);
    const incomingBefore = input.photos?.filter(p => p.kind === "before").length ?? 0;
    const incomingAfter = input.photos?.filter(p => p.kind === "after").length ?? 0;
    const totalBefore = counts.before + incomingBefore;
    const totalAfter = counts.after + incomingAfter;
    if (totalBefore < REQUIRED_JOB_PHOTOS || totalAfter < REQUIRED_JOB_PHOTOS) {
      throw new Error(`Upload ${REQUIRED_JOB_PHOTOS} before and ${REQUIRED_JOB_PHOTOS} after geo-tagged photos before closing the job`);
    }
  }

  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "completed",
      startedAt: execution.startedAt ?? now,
      completedAt: now,
      customerSignatureUrl: input.customerSignatureUrl?.trim() || execution.customerSignatureUrl,
      customerSignedAt: input.customerSignatureUrl?.trim()
        ? now
        : execution.customerSignedAt,
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  const staffId = req.scope?.staffId ?? null;
  if (input.photos?.length) {
    for (const p of input.photos) {
      if (p.latitude == null || p.longitude == null) {
        throw new Error("Geo-tagged location is required for every photo");
      }
    }
    await db.insert(serviceExecutionPhotosTable).values(
      input.photos.map(p => ({
        executionId,
        kind: p.kind ?? "proof",
        url: p.url,
        caption: p.caption ?? null,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        accuracy: p.accuracy ?? null,
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

  await recordExecutionTimeline({
    executionId,
    eventType: "EXECUTION_COMPLETED",
    description: "Field execution completed",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  executionDomainEventPublisher.publish({
    ...eventBase(execution, actor.actorId),
    type: "ExecutionCompleted",
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function missExecution(req: Request, executionId: number, reason?: string): Promise<ExecutionView> {
  const execution = await getMutableExecution(req, executionId);
  if (isTerminal(execution.status)) {
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
  if (isTerminal(execution.status)) {
    throw new Error("Execution cannot be cancelled from current status");
  }
  const actor = actorFromReq(req);
  const now = new Date();
  await db.update(serviceExecutionsTable)
    .set({
      status: "cancelled",
      cancellationReason: reason ?? "Cancelled",
      updatedAt: now,
    })
    .where(eq(serviceExecutionsTable.id, executionId));

  await recordExecutionTimeline({
    executionId,
    eventType: "EXECUTION_CANCELLED",
    description: reason ?? "Cancelled",
    actorId: actor.actorId,
    actorName: actor.actorName,
  });
  executionDomainEventPublisher.publish({
    ...eventBase(execution, actor.actorId),
    type: "ExecutionCancelled",
    metadata: { reason },
  });

  const row = await loadExecutionRow(executionId);
  return mapExecutionRow(row!);
}

export async function rescheduleExecution(
  req: Request,
  executionId: number,
  input: { scheduledDate: string; scheduledTime?: string | null; reason?: string },
): Promise<{ previous: ExecutionView; next: ExecutionView }> {
  const execution = await getMutableExecution(req, executionId);
  if (isTerminal(execution.status) || isInProgress(execution.status) || execution.status === "paused") {
    if (isTerminal(execution.status)) {
      throw new Error("Execution cannot be rescheduled from current status");
    }
  }
  if (!isReady(execution.status)) {
    throw new Error("Only ready executions can be rescheduled — pause/cancel in-progress work first");
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
    taskType: execution.taskType,
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime ?? null,
    status: "ready_for_execution",
    rescheduledFromId: executionId,
    companyId: execution.companyId,
    franchiseeId: execution.franchiseeId,
    branchId: execution.branchId,
  }).returning();

  await recordExecutionTimeline({
    executionId: nextRow!.id,
    eventType: "EXECUTION_READY",
    description: `Rescheduled from execution #${executionId}`,
    metadata: { rescheduledFromId: executionId },
  });

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
  readyForExecution: number;
  started: number;
  paused: number;
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
      .where(and(
        sql`${serviceAssignmentsTable.status} IN ('assigned', 'ready_for_execution')`,
        ...assignedScope,
      )),
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
    readyForExecution: (byStatus.ready_for_execution ?? 0) + (byStatus.scheduled ?? 0),
    started: (byStatus.started ?? 0) + (byStatus.resumed ?? 0),
    paused: byStatus.paused ?? 0,
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
