/**
 * Customer Self-Service Makeup Scheduling Service (OPS-005 / Phase 17)
 * Implements linked booking architecture for missed services.
 */

import { db, bookingsTable, customerContractsTable, dcmsSubscriptionsTable, customersTable, servicesTable, makeupApprovalRequestsTable } from "@workspace/db";
import { eq, and, sql, gte } from "drizzle-orm";
import type { Request } from "express";
import { schedulingDomainService } from "../scheduling";
import { BookingValidationError } from "../types";
import { notifyMakeupBookingConfirmed, notifyAdminServiceMissed, notifyAdminRescheduleApprovalRequired } from "../../notifications/dispatcher";
import { bookingTimelineService } from "../timeline/BookingTimelineService";
import { buildBookingTraceContext } from "../correlation/BookingTraceContext";
import { enqueuePendingServiceAssignment } from "../../assignments/pendingAssignmentEnqueue";

export type MakeupEligibilityResult = {
  eligible: boolean;
  requiresApproval?: boolean;
  usedCount?: number;
  quota?: number;
  code?: string;
  reason?: string;
  booking?: typeof bookingsTable.$inferSelect;
  serviceName?: string;
  rescheduledToBookingId?: number | null;
  suggestedDates?: string[];
};

export async function checkCustomerMakeupQuota(
  customerId: number,
  contractRegistryId?: number | null,
): Promise<{ withinQuota: boolean; usedCount: number; quota: number }> {
  const quota = 1; // 1 complimentary makeup visit per 30-day window
  const windowDays = 30;
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const [res] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bookingsTable)
    .where(
      and(
        eq(bookingsTable.customerId, customerId),
        eq(bookingsTable.isMakeupBooking, true),
        gte(bookingsTable.createdAt, cutoff),
        sql`${bookingsTable.status} != 'cancelled'`,
      ),
    )
    .limit(1);

  const usedCount = Number(res?.count ?? 0);
  return {
    withinQuota: usedCount < quota,
    usedCount,
    quota,
  };
}

export async function checkMakeupEligibility(
  bookingId: number,
  customerId?: number,
): Promise<MakeupEligibilityResult> {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);

  if (!booking) {
    return { eligible: false, code: "NOT_FOUND", reason: "Booking not found" };
  }

  if (customerId != null && booking.customerId !== customerId) {
    return { eligible: false, code: "FORBIDDEN", reason: "You are not authorized to reschedule this service" };
  }

  // Completed or cancelled services cannot be rescheduled
  if (booking.status === "completed") {
    return { eligible: false, code: "ALREADY_COMPLETED", reason: "Completed services cannot be rescheduled" };
  }
  if (booking.status === "cancelled") {
    return { eligible: false, code: "CANCELLED", reason: "Cancelled services cannot be rescheduled" };
  }

  // Must be marked missed to qualify for self-service makeup
  if (booking.status !== "missed") {
    return {
      eligible: false,
      code: "NOT_MISSED",
      reason: `Service is currently ${booking.status.replace(/_/g, " ")}. Only missed services qualify for makeup scheduling.`,
    };
  }

  // Check if a makeup booking was already created
  if (booking.rescheduledToBookingId) {
    return {
      eligible: false,
      code: "ALREADY_RESCHEDULED",
      rescheduledToBookingId: booking.rescheduledToBookingId,
      reason: `A makeup service (Request #${booking.rescheduledToBookingId}) has already been scheduled for this missed visit.`,
    };
  }

  // Check if a supervisor approval request is currently pending
  const [pendingApproval] = await db
    .select()
    .from(makeupApprovalRequestsTable)
    .where(
      and(
        eq(makeupApprovalRequestsTable.bookingId, bookingId),
        eq(makeupApprovalRequestsTable.status, "pending"),
      ),
    )
    .limit(1);

  if (pendingApproval) {
    return {
      eligible: false,
      code: "APPROVAL_PENDING",
      reason: `A makeup approval request (#${pendingApproval.id}) is currently pending supervisor review for this missed visit.`,
    };
  }

  // Verify entitlement / subscription validity if linked to contract/subscription
  if (booking.contractRegistryId) {
    const [contract] = await db
      .select()
      .from(customerContractsTable)
      .where(eq(customerContractsTable.id, booking.contractRegistryId))
      .limit(1);

    if (contract && (contract.status === "cancelled" || contract.status === "terminated")) {
      return {
        eligible: false,
        code: "SUBSCRIPTION_INELIGIBLE",
        reason: "The associated subscription contract is cancelled or terminated. Please contact customer support.",
      };
    }
  }

  // Check complimentary monthly quota
  const quotaCheck = await checkCustomerMakeupQuota(booking.customerId, booking.contractRegistryId);
  const requiresApproval = !quotaCheck.withinQuota;

  // Resolve service name
  let serviceName = booking.serviceType?.replace(/_/g, " ");
  if (booking.serviceId) {
    const [svc] = await db
      .select({ name: servicesTable.name })
      .from(servicesTable)
      .where(eq(servicesTable.id, booking.serviceId))
      .limit(1);
    if (svc?.name) serviceName = svc.name;
  }

  return {
    eligible: true,
    requiresApproval,
    usedCount: quotaCheck.usedCount,
    quota: quotaCheck.quota,
    reason: requiresApproval
      ? `Complimentary monthly quota reached (${quotaCheck.usedCount}/${quotaCheck.quota} used). This request will be submitted for supervisor approval.`
      : undefined,
    booking,
    serviceName,
  };
}

export type ScheduleMakeupInput = {
  bookingId: number;
  scheduledDate: string;
  scheduledTime?: string;
  notes?: string;
};

export async function scheduleMakeupBooking(
  req: Request,
  input: ScheduleMakeupInput,
) {
  const customerId = req.user?.role === "customer" ? req.user.id : undefined;
  const eligibility = await checkMakeupEligibility(input.bookingId, customerId);

  if (!eligibility.eligible || !eligibility.booking) {
    throw new BookingValidationError(
      eligibility.reason ?? "This booking is not eligible for a makeup service",
      eligibility.code ?? "INELIGIBLE_FOR_MAKEUP",
    );
  }

  const original = eligibility.booking;

  // Validate scheduled date is future or today
  const today = new Date().toISOString().split("T")[0];
  if (input.scheduledDate < today) {
    throw new BookingValidationError("Replacement date must be today or a future date", "INVALID_DATE");
  }

  // Validate capacity, conflicts, and city/branch availability
  const scheduleCheck = await schedulingDomainService.validate({
    scheduledDate: input.scheduledDate,
    scheduledTime: input.scheduledTime,
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
      scheduleCheck.error ?? "Selected date and time slot is unavailable",
      "SLOT_CONFLICT",
    );
  }

  const window = scheduleCheck.window;
  const scheduledTime = window.scheduledTime ?? input.scheduledTime ?? "09:00 AM";

  const isAdminOrSupervisor = req.user?.role === "admin" || req.user?.role === "manager" || req.user?.role === "super_admin";

  // If customer exceeded monthly complimentary quota, route to Supervisor Approval Queue (ADMIN-022)
  if (eligibility.requiresApproval && !isAdminOrSupervisor) {
    const [approvalReq] = await db
      .insert(makeupApprovalRequestsTable)
      .values({
        bookingId: original.id,
        customerId: original.customerId,
        cityId: original.cityId,
        branchId: original.branchId,
        contractRegistryId: original.contractRegistryId,
        requestedDate: window.scheduledDate,
        requestedTime: scheduledTime,
        requestedNotes: input.notes ?? null,
        reason: input.notes
          ? `Quota exceeded: ${input.notes}`
          : `Customer exceeded complimentary monthly quota (${eligibility.usedCount}/${eligibility.quota})`,
        status: "pending",
        previousMakeupsCount: eligibility.usedCount ?? 0,
        applicableQuota: eligibility.quota ?? 1,
      })
      .returning();

    await db
      .update(bookingsTable)
      .set({
        makeupEligibilityStatus: "pending_approval",
        updatedAt: new Date(),
      })
      .where(eq(bookingsTable.id, original.id));

    // Lookup customer name
    const [custRow] = await db
      .select({ name: customersTable.name })
      .from(customersTable)
      .where(eq(customersTable.id, original.customerId))
      .limit(1);

    await notifyAdminRescheduleApprovalRequired({
      bookingId: original.id,
      customerName: custRow?.name ?? "Customer",
      reason: approvalReq.reason,
      cityId: original.cityId,
      branchId: original.branchId,
    }).catch((err) => req.log?.error({ err }, "Failed to dispatch approval request notification to admin"));

    return {
      success: true,
      pendingApproval: true,
      requiresApproval: true,
      requestId: approvalReq.id,
      originalBookingId: original.id,
      message: "Your makeup request exceeds the monthly complimentary limit and has been submitted to your branch supervisor for approval.",
    };
  }

  // Create new linked makeup booking
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
      notes: input.notes
        ? `[Makeup Service] ${input.notes}`
        : `[Makeup Service] Rescheduled from missed booking #${original.id} (${original.scheduledDate})`,
      rescheduledFromBookingId: original.id,
      isMakeupBooking: true,
      makeupEligibilityStatus: "rescheduled",
    })
    .returning();

  if (!newBooking) {
    throw new BookingValidationError("Failed to create makeup booking", "CREATION_FAILED");
  }

  // Atomic link & concurrency protection: Update original booking ONLY IF not already rescheduled
  const updateResult = await db
    .update(bookingsTable)
    .set({
      rescheduledToBookingId: newBooking.id,
      makeupEligibilityStatus: "rescheduled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bookingsTable.id, original.id),
        sql`${bookingsTable.rescheduledToBookingId} IS NULL`,
      ),
    )
    .returning({ id: bookingsTable.id });

  if (updateResult.length === 0) {
    // Another concurrent transaction rescheduled it first! Roll back by cancelling the orphaned new booking.
    await db.update(bookingsTable).set({ status: "cancelled", cancellationReason: "Concurrent duplicate conflict" }).where(eq(bookingsTable.id, newBooking.id));
    throw new BookingValidationError(
      "A makeup booking was already confirmed by another concurrent request.",
      "CONCURRENT_MAKEUP_CONFLICT",
    );
  }

  // Record timeline entries on both original and new bookings
  const trace = buildBookingTraceContext({
    requestId: req.headers["x-request-id"] as string,
  });

  await bookingTimelineService.recordTransition(
    original.id,
    trace,
    "missed",
    "missed",
    {
      actorId: req.user?.id,
      actorName: req.user?.name ?? req.user?.phone ?? "Customer",
      description: `Replacement makeup service #${newBooking.id} confirmed for ${window.scheduledDate} ${scheduledTime}`,
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
      actorName: req.user?.name ?? req.user?.phone ?? "Customer",
      description: `Free makeup service scheduled from missed booking #${original.id}`,
    },
    req.log,
  );

  // Enqueue pending assignment for operations if linked to a contract
  if (newBooking.contractRegistryId) {
    await enqueuePendingServiceAssignment({
      contractRegistryId: newBooking.contractRegistryId,
      customerId: newBooking.customerId,
      serviceLocationId: newBooking.serviceLocationId,
      assetId: newBooking.assetId,
      serviceId: newBooking.serviceId,
      sourceSystem: "book_services_contract",
      sourceId: newBooking.id,
      notes: `Makeup service #${newBooking.id} awaiting technician assignment`,
      tenant: {
        companyId: newBooking.companyId,
        franchiseeId: newBooking.franchiseeId,
        branchId: newBooking.branchId,
      },
    }).catch((err) => req.log?.error({ err }, "Failed to enqueue pending assignment for makeup booking"));
  }

  // Lookup customer details for notification
  const [cust] = await db
    .select({ name: customersTable.name, phone: customersTable.phone })
    .from(customersTable)
    .where(eq(customersTable.id, newBooking.customerId))
    .limit(1);

  // Dispatch confirmation notification
  await notifyMakeupBookingConfirmed({
    bookingId: newBooking.id,
    originalBookingId: original.id,
    customerId: newBooking.customerId,
    customerName: cust?.name,
    serviceName: eligibility.serviceName ?? "Car Care",
    scheduledDate: window.scheduledDate,
    scheduledTime,
    cityId: newBooking.cityId,
    branchId: newBooking.branchId,
  }).catch((err) => req.log?.error({ err }, "Failed to notify customer of makeup confirmation"));

  return {
    success: true,
    originalBookingId: original.id,
    makeupBooking: newBooking,
  };
}
