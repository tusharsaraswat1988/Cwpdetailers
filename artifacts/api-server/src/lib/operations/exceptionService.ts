import {
  db,
  serviceExceptionsTable,
  bookingsTable,
  serviceExecutionsTable,
  customersTable,
  staffTable,
  paymentAttemptsTable,
  notificationsTable,
  complaintsTable,
  dcmsSubscriptionsTable,
  dcmsVisitsTable,
  adminAuditLogsTable,
  type ServiceException,
  type InsertServiceException,
} from "@workspace/db";
import { eq, and, sql, desc, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import { createSupportTicket } from "../support/supportTicketService";

export type ExceptionCategory =
  | "unassigned_booking"
  | "service_delayed"
  | "customer_cancellation"
  | "staff_reported_issue"
  | "failed_photo_upload"
  | "incomplete_service"
  | "failed_notification"
  | "payment_failure"
  | "customer_complaint"
  | "repeated_issue"
  | "other";

export type ExceptionSeverity = "low" | "medium" | "high" | "critical";

export type ExceptionStatus = "open" | "investigating" | "acknowledged" | "resolved" | "dismissed";

export type ListExceptionsFilters = {
  category?: string;
  severity?: string;
  status?: string;
  cityId?: number;
  branchId?: number;
  customerId?: number;
  bookingId?: number;
  search?: string;
  limit?: number;
  offset?: number;
};

/**
 * Lists service exceptions with filtering, pagination, and enriched relations.
 */
export async function listServiceExceptions(filters: ListExceptionsFilters = {}) {
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = filters.offset ?? 0;

  const conditions: SQL[] = [];

  if (filters.category && filters.category !== "all") {
    conditions.push(eq(serviceExceptionsTable.category, filters.category));
  }
  if (filters.severity && filters.severity !== "all") {
    conditions.push(eq(serviceExceptionsTable.severity, filters.severity));
  }
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(serviceExceptionsTable.status, filters.status));
  }
  if (filters.cityId) {
    conditions.push(eq(serviceExceptionsTable.cityId, filters.cityId));
  }
  if (filters.branchId) {
    conditions.push(eq(serviceExceptionsTable.branchId, filters.branchId));
  }
  if (filters.customerId) {
    conditions.push(eq(serviceExceptionsTable.customerId, filters.customerId));
  }
  if (filters.bookingId) {
    conditions.push(eq(serviceExceptionsTable.bookingId, filters.bookingId));
  }
  if (filters.search && filters.search.trim()) {
    const s = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      or(
        sql`LOWER(${serviceExceptionsTable.title}) LIKE ${s}`,
        sql`LOWER(${serviceExceptionsTable.reason}) LIKE ${s}`,
        sql`LOWER(${serviceExceptionsTable.exceptionCode}) LIKE ${s}`,
      )!,
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, countResult] = await Promise.all([
    db
      .select({
        id: serviceExceptionsTable.id,
        exceptionCode: serviceExceptionsTable.exceptionCode,
        category: serviceExceptionsTable.category,
        severity: serviceExceptionsTable.severity,
        status: serviceExceptionsTable.status,
        title: serviceExceptionsTable.title,
        reason: serviceExceptionsTable.reason,
        details: serviceExceptionsTable.details,
        bookingId: serviceExceptionsTable.bookingId,
        customerId: serviceExceptionsTable.customerId,
        customerName: customersTable.name,
        customerPhone: customersTable.phone,
        staffId: serviceExceptionsTable.staffId,
        staffName: staffTable.name,
        executionId: serviceExceptionsTable.executionId,
        subscriptionId: serviceExceptionsTable.subscriptionId,
        complaintId: serviceExceptionsTable.complaintId,
        cityId: serviceExceptionsTable.cityId,
        branchId: serviceExceptionsTable.branchId,
        evidenceUrl: serviceExceptionsTable.evidenceUrl,
        acknowledgedAt: serviceExceptionsTable.acknowledgedAt,
        acknowledgedBy: serviceExceptionsTable.acknowledgedBy,
        resolvedAt: serviceExceptionsTable.resolvedAt,
        resolvedBy: serviceExceptionsTable.resolvedBy,
        resolutionNotes: serviceExceptionsTable.resolutionNotes,
        resolutionAction: serviceExceptionsTable.resolutionAction,
        createdAt: serviceExceptionsTable.createdAt,
        updatedAt: serviceExceptionsTable.updatedAt,
      })
      .from(serviceExceptionsTable)
      .leftJoin(customersTable, eq(serviceExceptionsTable.customerId, customersTable.id))
      .leftJoin(staffTable, eq(serviceExceptionsTable.staffId, staffTable.id))
      .where(whereClause)
      .orderBy(desc(serviceExceptionsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(serviceExceptionsTable)
      .where(whereClause),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  return {
    data: items,
    total,
    limit,
    offset,
    hasMore: offset + items.length < total,
  };
}

/**
 * Idempotently creates or updates an operational exception using its unique dedupeKey.
 * Prevents generating duplicate exception records for the same unresolved event.
 */
export async function createOrUpdateServiceException(data: {
  category: ExceptionCategory;
  severity?: ExceptionSeverity;
  title: string;
  reason: string;
  dedupeKey: string;
  details?: Record<string, unknown>;
  bookingId?: number | null;
  customerId?: number | null;
  staffId?: number | null;
  executionId?: number | null;
  subscriptionId?: number | null;
  complaintId?: number | null;
  cityId?: number | null;
  branchId?: number | null;
  companyId?: number | null;
  evidenceUrl?: string | null;
}) {
  const severity = data.severity ?? "medium";

  // Check if an exception already exists with this dedupeKey
  const [existing] = await db
    .select()
    .from(serviceExceptionsTable)
    .where(eq(serviceExceptionsTable.dedupeKey, data.dedupeKey))
    .limit(1);

  if (existing) {
    // If existing is still open or investigating, update details without creating a new row
    if (existing.status === "open" || existing.status === "investigating") {
      const [updated] = await db
        .update(serviceExceptionsTable)
        .set({
          title: data.title,
          reason: data.reason,
          details: { ...(existing.details as Record<string, unknown> | null), ...data.details },
          severity,
          updatedAt: new Date(),
        })
        .where(eq(serviceExceptionsTable.id, existing.id))
        .returning();
      return updated;
    }
    // If already resolved, do not reopen silently unless needed
    return existing;
  }

  // Generate unique readable exception code: EXP-<timestamp-suffix>
  const codeSuffix = Math.floor(1000 + Math.random() * 9000);
  const exceptionCode = `EXP-${Date.now().toString().slice(-6)}-${codeSuffix}`;

  const [created] = await db
    .insert(serviceExceptionsTable)
    .values({
      exceptionCode,
      category: data.category,
      severity,
      status: "open",
      title: data.title,
      reason: data.reason,
      details: data.details ?? {},
      dedupeKey: data.dedupeKey,
      bookingId: data.bookingId ?? null,
      customerId: data.customerId ?? null,
      staffId: data.staffId ?? null,
      executionId: data.executionId ?? null,
      subscriptionId: data.subscriptionId ?? null,
      complaintId: data.complaintId ?? null,
      cityId: data.cityId ?? null,
      branchId: data.branchId ?? null,
      companyId: data.companyId ?? null,
      evidenceUrl: data.evidenceUrl ?? null,
    })
    .returning();

  return created;
}

/**
 * Acknowledges an exception by a staff or admin user.
 */
export async function acknowledgeServiceException(params: {
  exceptionId: number;
  userId: number;
  notes?: string;
  ipAddress?: string;
}) {
  const [existing] = await db
    .select()
    .from(serviceExceptionsTable)
    .where(eq(serviceExceptionsTable.id, params.exceptionId))
    .limit(1);

  if (!existing) {
    throw new Error(`Exception #${params.exceptionId} not found`);
  }

  const [updated] = await db
    .update(serviceExceptionsTable)
    .set({
      status: "acknowledged",
      acknowledgedAt: new Date(),
      acknowledgedBy: params.userId,
      details: {
        ...(existing.details as Record<string, unknown> | null),
        ackNotes: params.notes ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(serviceExceptionsTable.id, params.exceptionId))
    .returning();

  // Audit log
  await db.insert(adminAuditLogsTable).values({
    action: "exception_acknowledged",
    entityType: "service_exception",
    entityId: params.exceptionId,
    cityId: existing.cityId,
    branchId: existing.branchId,
    performedBy: params.userId,
    reason: params.notes || "Exception acknowledged for triage",
    ipAddress: params.ipAddress || null,
    details: { exceptionCode: existing.exceptionCode, category: existing.category },
  });

  return updated;
}

/**
 * Resolves an operational exception with an authoritative state change.
 * Preserves an immutable audit trail in admin_audit_logs.
 */
export async function resolveServiceException(params: {
  exceptionId: number;
  userId: number;
  action:
    | "reassigned"
    | "rescheduled"
    | "cancelled_with_refund"
    | "ticket_created"
    | "manual_override"
    | "dismissed_valid"
    | "none";
  resolutionNotes: string;
  assignedStaffId?: number;
  rescheduleDate?: string;
  rescheduleTime?: string;
  ipAddress?: string;
}) {
  const [existing] = await db
    .select()
    .from(serviceExceptionsTable)
    .where(eq(serviceExceptionsTable.id, params.exceptionId))
    .limit(1);

  if (!existing) {
    throw new Error(`Exception #${params.exceptionId} not found`);
  }

  if (!params.resolutionNotes || !params.resolutionNotes.trim()) {
    throw new Error("Resolution explanation is required");
  }

  let createdTicketId: number | null = null;

  // Authoritative state actions
  if (params.action === "reassigned" && existing.bookingId && params.assignedStaffId) {
    await db
      .update(bookingsTable)
      .set({
        assignedStaffId: params.assignedStaffId,
        status: "assigned",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, existing.bookingId));
  } else if (
    params.action === "rescheduled" &&
    existing.bookingId &&
    params.rescheduleDate &&
    params.rescheduleTime
  ) {
    await db
      .update(bookingsTable)
      .set({
        scheduledDate: params.rescheduleDate,
        scheduledTime: params.rescheduleTime,
        status: "rescheduled",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, existing.bookingId));
  } else if (params.action === "ticket_created" && existing.customerId) {
    const ticket = await createSupportTicket(
      {
        customerId: existing.customerId,
        bookingId: existing.bookingId,
        cityId: existing.cityId,
        branchId: existing.branchId,
        type: "other",
        priority: existing.severity === "critical" ? "urgent" : "high",
        title: `Operational Exception: ${existing.title}`,
        description: `Triggered from Exception ${existing.exceptionCode}: ${existing.reason}. Notes: ${params.resolutionNotes}`,
      },
      "Operations Command Center",
    );
    createdTicketId = ticket.id;
  }

  const [updated] = await db
    .update(serviceExceptionsTable)
    .set({
      status: params.action === "dismissed_valid" ? "dismissed" : "resolved",
      resolutionAction: params.action,
      resolutionNotes: params.resolutionNotes.trim(),
      resolvedAt: new Date(),
      resolvedBy: params.userId,
      complaintId: createdTicketId ?? existing.complaintId,
      updatedAt: new Date(),
    })
    .where(eq(serviceExceptionsTable.id, params.exceptionId))
    .returning();

  // Audit log
  await db.insert(adminAuditLogsTable).values({
    action: params.action === "dismissed_valid" ? "exception_dismissed" : "exception_resolved",
    entityType: "service_exception",
    entityId: params.exceptionId,
    cityId: existing.cityId,
    branchId: existing.branchId,
    performedBy: params.userId,
    reason: params.resolutionNotes,
    ipAddress: params.ipAddress || null,
    details: {
      action: params.action,
      exceptionCode: existing.exceptionCode,
      category: existing.category,
      createdTicketId,
    },
  });

  return updated;
}

/**
 * Automated Scanner: scans authoritative records and generates/synchronizes
 * service exceptions without creating duplicates.
 */
export async function scanAndSyncOperationalExceptions(scope?: {
  cityId?: number;
  branchId?: number;
}) {
  const today = getTodayIST();
  let createdCount = 0;

  // 1. Unassigned Bookings for today or upcoming (scheduled/waiting_assignment with null staff)
  const unassignedConditions: SQL[] = [
    sql`${bookingsTable.scheduledDate} <= (${today}::date + INTERVAL '1 day')`,
    inArray(bookingsTable.status, ["scheduled", "confirmed", "waiting_assignment"]),
    isNull(bookingsTable.assignedStaffId),
  ];
  if (scope?.cityId) unassignedConditions.push(eq(bookingsTable.cityId, scope.cityId));
  if (scope?.branchId) unassignedConditions.push(eq(bookingsTable.branchId, scope.branchId));

  const unassignedBookings = await db
    .select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      serviceType: bookingsTable.serviceType,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
      cityId: bookingsTable.cityId,
      branchId: bookingsTable.branchId,
      companyId: bookingsTable.companyId,
    })
    .from(bookingsTable)
    .where(and(...unassignedConditions))
    .limit(50);

  for (const b of unassignedBookings) {
    const dedupeKey = `booking_unassigned_${b.id}`;
    await createOrUpdateServiceException({
      category: "unassigned_booking",
      severity: b.scheduledDate === today ? "high" : "medium",
      title: `Unassigned Booking #${b.id}`,
      reason: `Booking for ${b.serviceType.replace(/_/g, " ")} on ${b.scheduledDate} ${b.scheduledTime || ""} has no technician assigned.`,
      dedupeKey,
      bookingId: b.id,
      customerId: b.customerId,
      cityId: b.cityId,
      branchId: b.branchId,
      companyId: b.companyId,
      details: { scheduledDate: b.scheduledDate, scheduledTime: b.scheduledTime },
    });
    createdCount++;
  }

  // 2. Delayed Services: today's bookings with scheduled time > 2 hours in the past still in scheduled/assigned
  const now = new Date();
  const currentHour = now.getHours();
  const currentMin = now.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;

  const delayedConditions: SQL[] = [
    eq(bookingsTable.scheduledDate, today),
    inArray(bookingsTable.status, ["scheduled", "confirmed", "assigned", "waiting_assignment"]),
    sql`${bookingsTable.scheduledTime} IS NOT NULL AND ${bookingsTable.scheduledTime} < ${currentTimeStr}`,
  ];
  if (scope?.cityId) delayedConditions.push(eq(bookingsTable.cityId, scope.cityId));
  if (scope?.branchId) delayedConditions.push(eq(bookingsTable.branchId, scope.branchId));

  const delayedBookings = await db
    .select({
      id: bookingsTable.id,
      customerId: bookingsTable.customerId,
      staffId: bookingsTable.assignedStaffId,
      serviceType: bookingsTable.serviceType,
      scheduledDate: bookingsTable.scheduledDate,
      scheduledTime: bookingsTable.scheduledTime,
      status: bookingsTable.status,
      cityId: bookingsTable.cityId,
      branchId: bookingsTable.branchId,
      companyId: bookingsTable.companyId,
    })
    .from(bookingsTable)
    .where(and(...delayedConditions))
    .limit(50);

  for (const b of delayedBookings) {
    const dedupeKey = `booking_delayed_${b.id}_${today}`;
    await createOrUpdateServiceException({
      category: "service_delayed",
      severity: "high",
      title: `Service Delayed: Booking #${b.id}`,
      reason: `Scheduled start was ${b.scheduledTime || "earlier today"} but service is still in '${b.status}' state.`,
      dedupeKey,
      bookingId: b.id,
      customerId: b.customerId,
      staffId: b.staffId,
      cityId: b.cityId,
      branchId: b.branchId,
      companyId: b.companyId,
      details: { scheduledTime: b.scheduledTime, currentStatus: b.status },
    });
    createdCount++;
  }

  // 3. Payment failures today
  const failedPaymentConditions: SQL[] = [
    sql`DATE(${paymentAttemptsTable.createdAt}) = ${today}::date`,
    eq(paymentAttemptsTable.status, "failed"),
  ];

  const failedPayments = await db
    .select({
      id: paymentAttemptsTable.id,
      bookingId: paymentAttemptsTable.bookingId,
      amount: paymentAttemptsTable.amount,
      errorMessage: paymentAttemptsTable.errorMessage,
      gatewayProvider: paymentAttemptsTable.gatewayProvider,
      createdAt: paymentAttemptsTable.createdAt,
    })
    .from(paymentAttemptsTable)
    .where(and(...failedPaymentConditions))
    .limit(30);

  for (const p of failedPayments) {
    const dedupeKey = `payment_failed_${p.id}`;
    let bookingCityId: number | null = null;
    let bookingBranchId: number | null = null;
    let customerId: number | null = null;

    if (p.bookingId) {
      const [b] = await db
        .select({ cityId: bookingsTable.cityId, branchId: bookingsTable.branchId, customerId: bookingsTable.customerId })
        .from(bookingsTable)
        .where(eq(bookingsTable.id, p.bookingId))
        .limit(1);
      if (b) {
        bookingCityId = b.cityId;
        bookingBranchId = b.branchId;
        customerId = b.customerId;
      }
    }

    await createOrUpdateServiceException({
      category: "payment_failure",
      severity: "high",
      title: `Payment Failure (₹${p.amount})`,
      reason: `Gateway attempt failed via ${p.gatewayProvider || "gateway"}: ${p.errorMessage || "Transaction declined / failed"}.`,
      dedupeKey,
      bookingId: p.bookingId,
      customerId,
      cityId: bookingCityId,
      branchId: bookingBranchId,
      details: { amount: p.amount, errorMessage: p.errorMessage, gateway: p.gatewayProvider },
    });
    createdCount++;
  }

  // 4. Failed Notifications
  const failedNotifConditions: SQL[] = [
    sql`DATE(${notificationsTable.createdAt}) = ${today}::date`,
    eq(notificationsTable.deliveryStatus, "failed"),
  ];

  const failedNotifs = await db
    .select({
      id: notificationsTable.id,
      title: notificationsTable.title,
      type: notificationsTable.type,
      customerId: notificationsTable.customerId,
      cityId: notificationsTable.cityId,
      createdAt: notificationsTable.createdAt,
    })
    .from(notificationsTable)
    .where(and(...failedNotifConditions))
    .limit(20);

  for (const n of failedNotifs) {
    const dedupeKey = `notification_failed_${n.id}`;
    await createOrUpdateServiceException({
      category: "failed_notification",
      severity: "low",
      title: `Failed Notification: ${n.type.replace(/_/g, " ")}`,
      reason: `Notification '${n.title}' failed delivery to customer #${n.customerId}.`,
      dedupeKey,
      customerId: n.customerId,
      cityId: n.cityId,
      details: { notificationId: n.id, type: n.type },
    });
    createdCount++;
  }

  return { scanned: true, processedCount: createdCount };
}
