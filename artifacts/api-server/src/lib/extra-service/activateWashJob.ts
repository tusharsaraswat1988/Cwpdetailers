import {
  db,
  bookingsTable,
  extraServiceRequestsTable,
  pendingServiceAssignmentsTable,
  serviceAssignmentsTable,
  servicesTable,
  vehiclesTable,
  assetsTable,
  type ExtraServiceRequest,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { getTodayIST } from "../../subscriptions/service";
import { tenantStamp } from "../../middlewares/tenantScope";
import { syncContractFromBooking } from "../contracts/contractRegistry";
import { enqueuePendingServiceAssignment } from "../assignments/pendingAssignmentEnqueue";
import { createScheduledExecutionForAssignment } from "../executions/executionService";
import { recordAssignmentTimeline } from "../assignments/assignmentTimeline";

function istTimeHm(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = parts.find(p => p.type === "hour")?.value ?? "09";
  const minute = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

async function resolveAssetId(vehicleId: number): Promise<number | null> {
  const [asset] = await db.select({ id: assetsTable.id })
    .from(assetsTable)
    .where(eq(assetsTable.vehicleId, vehicleId))
    .limit(1);
  return asset?.id ?? null;
}

/**
 * After OTP verification: one Car Wash booking + assignment + execution for the proposing staff.
 * Does not consume entitlement and does not mark the wash complete.
 */
export async function activateExtraCarWashJob(
  req: Request,
  request: ExtraServiceRequest,
): Promise<{ bookingId: number; executionId: number }> {
  if (request.bookingId && request.executionId) {
    return { bookingId: request.bookingId, executionId: request.executionId };
  }

  const [vehicle] = await db.select().from(vehiclesTable)
    .where(eq(vehiclesTable.id, request.vehicleId)).limit(1);
  if (!vehicle) throw new Error("Vehicle not found");

  const [service] = await db.select({ id: servicesTable.id, name: servicesTable.name })
    .from(servicesTable).where(eq(servicesTable.id, request.serviceId)).limit(1);

  const today = getTodayIST();
  const assetId = await resolveAssetId(request.vehicleId);
  const snapshot = request.consentSnapshot;
  const sourceNote = request.commercialSource === "DCC_INCLUDED" && request.dcmsSubscriptionId
    ? `Staff extra service — DCMS wash (subscription ${request.dcmsSubscriptionId})`
    : `Staff extra service — paid extra wash`;

  const values = tenantStamp(req, {
    customerId: request.customerId,
    vehicleId: request.vehicleId,
    assetId,
    serviceId: request.serviceId,
    scheduledDate: today,
    scheduledTime: istTimeHm(),
    bookingType: "one_time" as const,
    serviceType: "car_wash" as const,
    address: vehicle.serviceAddress ?? vehicle.locationLabel ?? "On-site extra wash",
    area: vehicle.locationLabel,
    locationLat: vehicle.serviceLat,
    locationLng: vehicle.serviceLng,
    notes: [
      sourceNote,
      `extraServiceRequestId=${request.id}`,
      `staffId=${request.staffId}`,
      request.commercialSource === "PAID_EXTRA" ? `amount=${request.amount}` : null,
    ].filter(Boolean).join(" | "),
    status: "scheduled" as const,
    companyId: request.companyId,
    franchiseeId: request.franchiseeId,
    branchId: request.branchId,
  });

  const [booking] = await db.insert(bookingsTable).values(values as never).returning();
  if (!booking) throw new Error("Failed to create wash booking");

  const registryAssetId = assetId ?? request.vehicleId;
  const contractId = await syncContractFromBooking(booking, {
    serviceName: service?.name ?? snapshot.serviceName,
    catalogRefKind: "service",
    catalogRefId: request.serviceId,
    registryAssetId,
    amount: request.amount,
  });

  const pendingId = await enqueuePendingServiceAssignment({
    contractRegistryId: contractId,
    customerId: request.customerId,
    assetId: assetId ?? request.vehicleId,
    serviceId: request.serviceId,
    sourceSystem: "booking",
    sourceId: booking.id,
    notes: `Extra car wash — customer consent verified (request ${request.id})`,
    tenant: {
      companyId: request.companyId,
      franchiseeId: request.franchiseeId,
      branchId: request.branchId,
    },
  });

  const now = new Date();
  const [assignment] = await db.insert(serviceAssignmentsTable).values({
    pendingAssignmentId: pendingId,
    customerId: request.customerId,
    assetId: assetId ?? request.vehicleId,
    contractId,
    serviceId: request.serviceId,
    bookingId: booking.id,
    assignedStaffId: request.staffId,
    taskType: "car_wash",
    assignedAt: now,
    status: "ready_for_execution",
    serviceLabel: service?.name ?? snapshot.serviceName,
    productLine: "one_time_service",
    notes: `Customer-approved extra wash (request ${request.id})`,
    companyId: request.companyId,
    franchiseeId: request.franchiseeId,
    branchId: request.branchId,
  }).returning();

  await db.update(pendingServiceAssignmentsTable)
    .set({ status: "assigned", updatedAt: now })
    .where(eq(pendingServiceAssignmentsTable.id, pendingId));

  const executionId = await createScheduledExecutionForAssignment({
    serviceAssignmentId: assignment!.id,
    contractId,
    customerId: request.customerId,
    assetId: assetId ?? request.vehicleId,
    assignedStaffId: request.staffId,
    taskType: "car_wash",
    scheduledDate: today,
    companyId: request.companyId,
    franchiseeId: request.franchiseeId,
    branchId: request.branchId,
  });

  await recordAssignmentTimeline({
    assignmentId: assignment!.id,
    pendingAssignmentId: pendingId,
    eventType: "ASSIGNMENT_CREATED",
    description: "On-site extra car wash assigned after customer OTP verification",
    toStaffId: request.staffId,
    metadata: {
      extraServiceRequestId: request.id,
      bookingId: booking.id,
      executionId,
      customerConsent: true,
    },
  });

  await db.update(extraServiceRequestsTable)
    .set({
      bookingId: booking.id,
      executionId,
      updatedAt: now,
    })
    .where(eq(extraServiceRequestsTable.id, request.id));

  return { bookingId: booking.id, executionId };
}
