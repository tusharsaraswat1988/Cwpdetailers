/**
 * Supervisor Makeup Approval Service (ADMIN-022 / Phase 18)
 * Manages supervisor approval queue for customer makeup requests exceeding complimentary limits.
 * Enforces atomic state transitions, multi-city scoping, capacity revalidation, and audit logging.
 */

import {
  db,
  makeupApprovalRequestsTable,
  bookingsTable,
  customersTable,
  servicesTable,
  citiesTable,
  branchesTable,
  usersTable,
} from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { Request } from "express";
import { schedulingDomainService } from "../scheduling";
import { BookingValidationError } from "../types";
import { notifyMakeupBookingConfirmed } from "../../notifications/dispatcher";
import { bookingTimelineService } from "../timeline/BookingTimelineService";
import { buildBookingTraceContext } from "../correlation/BookingTraceContext";
import { enqueuePendingServiceAssignment } from "../../assignments/pendingAssignmentEnqueue";

export type ListApprovalsFilters = {
  status?: string;
  cityId?: number;
  branchId?: number;
  limit?: number;
  offset?: number;
};

export async function listMakeupApprovals(req: Request, filters: ListApprovalsFilters = {}) {
  const conditions = [];

  // Scoping: city and branch restrictions
  const effectiveCityId = req.scope?.cityId ?? filters.cityId;
  const effectiveBranchId = req.scope?.branchId ?? filters.branchId;

  if (effectiveCityId) {
    conditions.push(eq(makeupApprovalRequestsTable.cityId, effectiveCityId));
  }
  if (effectiveBranchId) {
    conditions.push(eq(makeupApprovalRequestsTable.branchId, effectiveBranchId));
  }
  if (filters.status && filters.status !== "all") {
    conditions.push(eq(makeupApprovalRequestsTable.status, filters.status as any));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: makeupApprovalRequestsTable.id,
      bookingId: makeupApprovalRequestsTable.bookingId,
      customerId: makeupApprovalRequestsTable.customerId,
      cityId: makeupApprovalRequestsTable.cityId,
      branchId: makeupApprovalRequestsTable.branchId,
      contractRegistryId: makeupApprovalRequestsTable.contractRegistryId,
      requestedDate: makeupApprovalRequestsTable.requestedDate,
      requestedTime: makeupApprovalRequestsTable.requestedTime,
      requestedNotes: makeupApprovalRequestsTable.requestedNotes,
      reason: makeupApprovalRequestsTable.reason,
      status: makeupApprovalRequestsTable.status,
      decidedBy: makeupApprovalRequestsTable.decidedBy,
      decidedAt: makeupApprovalRequestsTable.decidedAt,
      decisionReason: makeupApprovalRequestsTable.decisionReason,
      createdBookingId: makeupApprovalRequestsTable.createdBookingId,
      previousMakeupsCount: makeupApprovalRequestsTable.previousMakeupsCount,
      applicableQuota: makeupApprovalRequestsTable.applicableQuota,
      createdAt: makeupApprovalRequestsTable.createdAt,
      updatedAt: makeupApprovalRequestsTable.updatedAt,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      cityName: citiesTable.name,
      branchName: branchesTable.name,
      originalDate: bookingsTable.scheduledDate,
      originalTime: bookingsTable.scheduledTime,
      originalServiceType: bookingsTable.serviceType,
      originalAddress: bookingsTable.address,
    })
    .from(makeupApprovalRequestsTable)
    .leftJoin(customersTable, eq(makeupApprovalRequestsTable.customerId, customersTable.id))
    .leftJoin(citiesTable, eq(makeupApprovalRequestsTable.cityId, citiesTable.id))
    .leftJoin(branchesTable, eq(makeupApprovalRequestsTable.branchId, branchesTable.id))
    .leftJoin(bookingsTable, eq(makeupApprovalRequestsTable.bookingId, bookingsTable.id))
    .where(whereClause)
    .orderBy(desc(makeupApprovalRequestsTable.createdAt))
    .limit(filters.limit ?? 50)
    .offset(filters.offset ?? 0);

  const [totalRes] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(makeupApprovalRequestsTable)
    .where(whereClause);

  return {
    requests: rows,
    total: Number(totalRes?.count ?? 0),
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

export async function approveMakeupRequest(
  req: Request,
  approvalId: number,
  options?: { notes?: string },
) {
  // First, verify request exists and check scope
  const [request] = await db
    .select()
    .from(makeupApprovalRequestsTable)
    .where(eq(makeupApprovalRequestsTable.id, approvalId))
    .limit(1);

  if (!request) {
    throw new BookingValidationError("Approval request not found", "NOT_FOUND");
  }

  if (request.status !== "pending") {
    throw new BookingValidationError(
      `Request has already been ${request.status}`,
      "ALREADY_DECIDED",
    );
  }

  // Tenant scoping validation
  if (req.scope?.cityId && request.cityId && request.cityId !== req.scope.cityId) {
    throw new BookingValidationError("Access denied: Request belongs to another city", "FORBIDDEN");
  }
  if (req.scope?.branchId && request.branchId && request.branchId !== req.scope.branchId) {
    throw new BookingValidationError("Access denied: Request belongs to another branch", "FORBIDDEN");
  }

  // Fetch original booking
  const [original] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, request.bookingId))
    .limit(1);

  if (!original) {
    throw new BookingValidationError("Original booking not found", "NOT_FOUND");
  }

  // Revalidate schedule capacity and availability
  const scheduleCheck = await schedulingDomainService.validate({
    scheduledDate: request.requestedDate,
    scheduledTime: request.requestedTime,
    durationMinutes: original.durationMinutes ?? 60,
    customerId: original.customerId,
    assetId: original.assetId,
    vehicleId: original.vehicleId,
    serviceLocationId: original.serviceLocationId,
    branchId: original.branchId,
    cityId: original.cityId,
    excludeBookingId: original.id,
  });

  if (!scheduleCheck.valid || !scheduleCheck.window) {
    throw new BookingValidationError(
      scheduleCheck.error ?? "Selected date and time slot is no longer available",
      "SLOT_CONFLICT",
    );
  }

  const window = scheduleCheck.window;
  const scheduledTime = window.scheduledTime ?? request.requestedTime;

  // Atomic state transition: Ensure no other supervisor simultaneously approved or rejected it
  const [updatedRequest] = await db
    .update(makeupApprovalRequestsTable)
    .set({
      status: "approved",
      decidedBy: req.user?.id ?? null,
      decidedAt: new Date(),
      decisionReason: options?.notes ? `Approved: ${options.notes}` : "Approved by supervisor",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(makeupApprovalRequestsTable.id, approvalId),
        eq(makeupApprovalRequestsTable.status, "pending"),
      ),
    )
    .returning();

  if (!updatedRequest) {
    throw new BookingValidationError(
      "Approval conflict: This request was already decided by another supervisor",
      "CONCURRENT_APPROVAL_CONFLICT",
    );
  }

  // Create replacement makeup booking
  const [newBooking] = await db
    .insert(bookingsTable)
    .values({
      customerId: original.customerId,
      contractRegistryId: original.contractRegistryId,
      serviceLocationId: original.serviceLocationId,
      assetId: original.assetId,
      vehicleId: original.vehicleId,
      solarSiteId: original.solarSiteId,
      serviceId: original.serviceId,
      companyId: original.companyId,
      franchiseeId: original.franchiseeId,
      branchId: original.branchId,
      cityId: original.cityId,
      bookingType: original.bookingType,
      scheduledDate: window.scheduledDate,
      scheduledTime,
      scheduledStartAt: window.scheduledStartAt,
      scheduledEndAt: window.scheduledEndAt,
      durationMinutes: window.durationMinutes,
      status: "waiting_assignment",
      serviceType: original.serviceType,
      address: original.address,
      area: original.area,
      locationLat: original.locationLat,
      locationLng: original.locationLng,
      placeId: original.placeId,
      savedLocationId: original.savedLocationId,
      addressSnapshotId: original.addressSnapshotId,
      notes: request.requestedNotes
        ? `[Approved Makeup] ${request.requestedNotes}`
        : `[Approved Makeup] Rescheduled from missed booking #${original.id}`,
      rescheduledFromBookingId: original.id,
      isMakeupBooking: true,
      makeupEligibilityStatus: "rescheduled",
    })
    .returning();

  // Link bookings and update request record
  await db
    .update(bookingsTable)
    .set({
      rescheduledToBookingId: newBooking.id,
      makeupEligibilityStatus: "rescheduled",
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, original.id));

  await db
    .update(makeupApprovalRequestsTable)
    .set({
      createdBookingId: newBooking.id,
      updatedAt: new Date(),
    })
    .where(eq(makeupApprovalRequestsTable.id, approvalId));

  // Record timeline transitions
  const trace = buildBookingTraceContext({
    requestId: req.headers["x-request-id"] as string,
  });

  const supervisorName = req.user?.name ?? req.user?.phone ?? "Supervisor";

  await bookingTimelineService.recordTransition(
    original.id,
    trace,
    "missed",
    "missed",
    {
      actorId: req.user?.id,
      actorName: supervisorName,
      description: `Supervisor approved makeup booking #${newBooking.id} for ${window.scheduledDate} ${scheduledTime}`,
    },
    req.log,
  );

  await bookingTimelineService.recordTransition(
    newBooking.id,
    trace,
    "draft",
    "waiting_assignment",
    {
      actorId: req.user?.id,
      actorName: supervisorName,
      description: `Makeup service created upon supervisor approval (Request #${approvalId})`,
    },
    req.log,
  );

  // Enqueue pending assignment if linked to contract
  if (newBooking.contractRegistryId) {
    await enqueuePendingServiceAssignment({
      contractRegistryId: newBooking.contractRegistryId,
      customerId: newBooking.customerId,
      serviceLocationId: newBooking.serviceLocationId,
      assetId: newBooking.assetId,
      serviceId: newBooking.serviceId,
      sourceSystem: "book_services_contract",
      sourceId: newBooking.id,
      notes: `Approved makeup service #${newBooking.id} awaiting technician assignment`,
      tenant: {
        companyId: newBooking.companyId,
        franchiseeId: newBooking.franchiseeId,
        branchId: newBooking.branchId,
      },
    }).catch((err) => req.log?.error({ err }, "Failed to enqueue pending assignment for approved makeup"));
  }

  // Lookup customer details for notification
  const [cust] = await db
    .select({ name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, newBooking.customerId))
    .limit(1);

  let serviceName = original.serviceType?.replace(/_/g, " ") ?? "Car Care";
  if (original.serviceId) {
    const [svc] = await db
      .select({ name: servicesTable.name })
      .from(servicesTable)
      .where(eq(servicesTable.id, original.serviceId))
      .limit(1);
    if (svc?.name) serviceName = svc.name;
  }

  await notifyMakeupBookingConfirmed({
    bookingId: newBooking.id,
    originalBookingId: original.id,
    customerId: newBooking.customerId,
    customerName: cust?.name,
    serviceName,
    scheduledDate: window.scheduledDate,
    scheduledTime,
    cityId: newBooking.cityId,
    branchId: newBooking.branchId,
  }).catch((err) => req.log?.error({ err }, "Failed to dispatch confirmation notification"));

  return {
    success: true,
    approvalId,
    status: "approved",
    booking: newBooking,
  };
}

export async function rejectMakeupRequest(
  req: Request,
  approvalId: number,
  rejectionReason: string,
) {
  if (!rejectionReason || !rejectionReason.trim()) {
    throw new BookingValidationError("A rejection reason is mandatory", "MISSING_REJECTION_REASON");
  }

  const [request] = await db
    .select()
    .from(makeupApprovalRequestsTable)
    .where(eq(makeupApprovalRequestsTable.id, approvalId))
    .limit(1);

  if (!request) {
    throw new BookingValidationError("Approval request not found", "NOT_FOUND");
  }

  if (request.status !== "pending") {
    throw new BookingValidationError(`Request has already been ${request.status}`, "ALREADY_DECIDED");
  }

  // Scope check
  if (req.scope?.cityId && request.cityId && request.cityId !== req.scope.cityId) {
    throw new BookingValidationError("Access denied: Request belongs to another city", "FORBIDDEN");
  }
  if (req.scope?.branchId && request.branchId && request.branchId !== req.scope.branchId) {
    throw new BookingValidationError("Access denied: Request belongs to another branch", "FORBIDDEN");
  }

  // Atomic transition
  const [updatedRequest] = await db
    .update(makeupApprovalRequestsTable)
    .set({
      status: "rejected",
      decidedBy: req.user?.id ?? null,
      decidedAt: new Date(),
      decisionReason: rejectionReason.trim(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(makeupApprovalRequestsTable.id, approvalId),
        eq(makeupApprovalRequestsTable.status, "pending"),
      ),
    )
    .returning();

  if (!updatedRequest) {
    throw new BookingValidationError(
      "Approval conflict: This request was already decided by another supervisor",
      "CONCURRENT_APPROVAL_CONFLICT",
    );
  }

  // Update original booking eligibility status
  await db
    .update(bookingsTable)
    .set({
      makeupEligibilityStatus: "ineligible",
      updatedAt: new Date(),
    })
    .where(eq(bookingsTable.id, request.bookingId));

  // Record audit timeline event
  const trace = buildBookingTraceContext({
    requestId: req.headers["x-request-id"] as string,
  });

  const supervisorName = req.user?.name ?? req.user?.phone ?? "Supervisor";

  await bookingTimelineService.recordTransition(
    request.bookingId,
    trace,
    "missed",
    "missed",
    {
      actorId: req.user?.id,
      actorName: supervisorName,
      description: `Supervisor rejected makeup request #${approvalId}: ${rejectionReason.trim()}`,
    },
    req.log,
  );

  return {
    success: true,
    approvalId,
    status: "rejected",
    decisionReason: rejectionReason.trim(),
  };
}
