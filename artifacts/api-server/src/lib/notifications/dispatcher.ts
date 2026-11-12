import { db } from "@workspace/db";
import { notificationsTable, usersTable, customersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { createDefaultSmsAdapter } from "./channels/sms";
import { getConfiguredSmsAdapter, normalizePhone, type ChannelAdapters, type DispatchChannel } from "./types";

import { getBrandName } from "../brandIdentityService";

export type NotificationTemplate =
  | "booking_confirmed"
  | "booking_completed"
  | "staff_assigned_customer"
  | "staff_assigned_staff"
  | "visit_completed"
  | "car_not_available_customer"
  | "car_not_available_admin"
  | "complaint_update"
  | "low_balance";

function buildTemplates(brandName: string): Record<NotificationTemplate, (vars: Record<string, string>) => { title: string; message: string; sms: string }> {
  return {
    booking_confirmed: (v) => ({
      title: "Booking Confirmed",
      message: `Hi ${v.customerName}, your ${v.serviceName} booking on ${v.scheduledDate}${v.societyName ? ` at ${v.societyName}` : ""} is confirmed. — ${brandName}`,
      sms: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is confirmed. — ${brandName}`,
    }),
    booking_completed: (v) => ({
      title: "Service Completed",
      message: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is complete. Thank you! — ${brandName}`,
      sms: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is complete. Thank you! — ${brandName}`,
    }),
    staff_assigned_customer: (v) => ({
      title: "Staff Assigned to Your Service",
      message: `Hi ${v.customerName}, our technician ${v.staffName} has been assigned to your ${v.serviceName} on ${v.scheduledDate}. — ${brandName}`,
      sms: `Hi ${v.customerName}, ${v.staffName} is assigned to your ${v.serviceName} on ${v.scheduledDate}. — ${brandName}`,
    }),
    staff_assigned_staff: (v) => ({
      title: "New Service Assignment",
      message: `Hi ${v.staffName}, you have been assigned to ${v.serviceName} for ${v.customerName} on ${v.scheduledDate}${v.societyName ? ` at ${v.societyName}` : ""}${v.parkingBay ? ` (Bay: ${v.parkingBay})` : ""}.`,
      sms: `Hi ${v.staffName}, new assignment: ${v.serviceName} on ${v.scheduledDate}${v.societyName ? ` at ${v.societyName}` : ""}.`,
    }),
    visit_completed: (v) => ({
      title: "Daily Car Cleaning Completed",
      message: `Hi ${v.customerName}, morning ${v.visitType || "cleaning"} for vehicle ${v.vehicleNumber}${v.societyName ? ` at ${v.societyName}` : ""} is complete! Photos are uploaded in the app. — ${brandName}`,
      sms: `Hi ${v.customerName}, cleaning for ${v.vehicleNumber} is complete! Photos in app. — ${brandName}`,
    }),
    car_not_available_customer: (v) => ({
      title: "Vehicle Not Found for Cleaning",
      message: `Hi ${v.customerName}, our cleaner reached your parking location${v.societyName ? ` at ${v.societyName}` : ""}, but vehicle ${v.vehicleNumber} was not found. Please verify parking bay in app. — ${brandName}`,
      sms: `Hi ${v.customerName}, vehicle ${v.vehicleNumber} was not found for morning cleaning. Please check app. — ${brandName}`,
    }),
    car_not_available_admin: (v) => ({
      title: "Exception: Car Not Available",
      message: `Staff ${v.staffName} reported vehicle ${v.vehicleNumber} (${v.customerName}) not available${v.societyName ? ` at ${v.societyName}` : ""}.`,
      sms: `Exception: ${v.vehicleNumber} not found by ${v.staffName}${v.societyName ? ` at ${v.societyName}` : ""}.`,
    }),
    complaint_update: (v) => ({
      title: "Complaint Status Update",
      message: `Hi ${v.customerName}, your complaint #${v.complaintId} has been updated: ${v.statusText}. — ${brandName}`,
      sms: `Hi ${v.customerName}, complaint #${v.complaintId} status updated: ${v.statusText}. — ${brandName}`,
    }),
    low_balance: (v) => ({
      title: "Low Wallet Balance",
      message: `Hi ${v.customerName}, your wallet balance (₹${v.balance}) is low. Please recharge to continue daily cleaning. — ${brandName}`,
      sms: `Hi ${v.customerName}, wallet balance ₹${v.balance} is low. Recharge to continue daily cleaning. — ${brandName}`,
    }),
  };
}

const TYPE_MAP: Record<NotificationTemplate, (typeof notificationsTable.type.enumValues)[number]> = {
  booking_confirmed: "booking_confirmation",
  booking_completed: "service_complete",
  staff_assigned_customer: "booking_confirmation",
  staff_assigned_staff: "broadcast",
  visit_completed: "service_complete",
  car_not_available_customer: "complaint_update",
  car_not_available_admin: "complaint_update",
  complaint_update: "complaint_update",
  low_balance: "payment_reminder",
};

export type DispatchNotificationInput = {
  template: NotificationTemplate;
  vars: Record<string, string>;
  userId?: number | null;
  customerId?: number | null;
  phone?: string | null;
  channels?: DispatchChannel[];
  dedupeKey?: string;
  companyId?: number | null;
  branchId?: number | null;
  adapters?: ChannelAdapters;
};

async function resolvePhone(input: DispatchNotificationInput): Promise<string | null> {
  if (input.phone) return normalizePhone(input.phone);
  if (input.customerId) {
    const [c] = await db.select({ phone: customersTable.phone }).from(customersTable)
      .where(eq(customersTable.id, input.customerId)).limit(1);
    if (c?.phone) return normalizePhone(c.phone);
  }
  if (input.userId) {
    const [u] = await db.select({ phone: usersTable.phone }).from(usersTable)
      .where(eq(usersTable.id, input.userId)).limit(1);
    if (u?.phone) return normalizePhone(u.phone);
  }
  return null;
}

async function resolveUserId(input: DispatchNotificationInput): Promise<number | null> {
  if (input.userId) return input.userId;
  if (input.customerId) {
    const [c] = await db.select({ userId: customersTable.userId }).from(customersTable)
      .where(eq(customersTable.id, input.customerId)).limit(1);
    return c?.userId ?? null;
  }
  return null;
}

/**
 * Notification dispatcher — all outbound alerts go through here.
 * Creates in_app record always; optionally sends via channel adapters.
 */
export async function dispatchNotification(input: DispatchNotificationInput) {
  const channels = input.channels ?? ["in_app", "sms"];
  const brandName = await getBrandName();
  const tpl = buildTemplates(brandName)[input.template](input.vars);
  const userId = await resolveUserId(input);
  const phone = await resolvePhone(input);

  if (input.dedupeKey) {
    const [existing] = await db.select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(eq(notificationsTable.dedupeKey, input.dedupeKey))
      .limit(1);
    if (existing) {
      logger.info({ dedupeKey: input.dedupeKey }, "Notification skipped (duplicate)");
      return { skipped: true, reason: "duplicate" };
    }
  }

  const results: Array<{ channel: string; status: string; externalId?: string; error?: string }> = [];

  if (channels.includes("in_app") && userId) {
    await db.insert(notificationsTable).values({
      userId,
      title: tpl.title,
      message: tpl.message,
      type: TYPE_MAP[input.template],
      channel: "in_app",
      deliveryStatus: "sent",
      dedupeKey: input.dedupeKey ?? null,
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
    });
    results.push({ channel: "in_app", status: "sent" });
  }

  if (channels.includes("sms")) {
    const adapters = input.adapters ?? { sms: createDefaultSmsAdapter() };
    const smsAdapter = getConfiguredSmsAdapter(adapters);

    if (!phone) {
      logger.warn({ template: input.template, customerId: input.customerId }, "SMS skipped — no phone");
      await db.insert(notificationsTable).values({
        userId,
        title: tpl.title,
        message: tpl.message,
        type: TYPE_MAP[input.template],
        channel: "sms",
        deliveryStatus: "skipped",
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:sms` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({ channel: "sms", status: "skipped", error: "no phone" });
    } else if (!smsAdapter?.isConfigured()) {
      logger.warn({ template: input.template }, "SMS skipped — provider not configured");
      await db.insert(notificationsTable).values({
        userId,
        title: tpl.title,
        message: tpl.message,
        type: TYPE_MAP[input.template],
        channel: "sms",
        deliveryStatus: "skipped",
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:sms` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({ channel: "sms", status: "skipped", error: "provider not configured" });
    } else {
      const smsResult = await smsAdapter.sendSms(phone, tpl.sms);
      await db.insert(notificationsTable).values({
        userId,
        title: tpl.title,
        message: tpl.message,
        type: TYPE_MAP[input.template],
        channel: "sms",
        deliveryStatus: smsResult.success ? "sent" : "failed",
        externalId: smsResult.externalId ?? null,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:sms` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({
        channel: "sms",
        status: smsResult.success ? "sent" : "failed",
        externalId: smsResult.externalId,
        error: smsResult.error,
      });
      if (!smsResult.success) {
        logger.error({ template: input.template, phone, error: smsResult.error }, "SMS delivery failed");
      }
    }
  }

  return { skipped: false, results };
}

export async function notifyBookingConfirmed(booking: {
  id: number;
  customerId: number;
  customerName?: string | null;
  serviceName?: string | null;
  serviceType?: string | null;
  scheduledDate: string;
  companyId?: number | null;
  branchId?: number | null;
}) {
  const serviceLabel = booking.serviceName ?? booking.serviceType?.replace(/_/g, " ") ?? "service";
  return dispatchNotification({
    template: "booking_confirmed",
    customerId: booking.customerId,
    vars: {
      customerName: booking.customerName ?? "Customer",
      serviceName: serviceLabel,
      scheduledDate: booking.scheduledDate,
    },
    dedupeKey: `booking:${booking.id}:confirmed`,
    companyId: booking.companyId,
    branchId: booking.branchId,
  });
}

export async function notifyBookingCompleted(booking: {
  id: number;
  customerId: number;
  customerName?: string | null;
  serviceName?: string | null;
  serviceType?: string | null;
  scheduledDate: string;
  companyId?: number | null;
  branchId?: number | null;
}) {
  const serviceLabel = booking.serviceName ?? booking.serviceType?.replace(/_/g, " ") ?? "service";
  return dispatchNotification({
    template: "booking_completed",
    customerId: booking.customerId,
    vars: {
      customerName: booking.customerName ?? "Customer",
      serviceName: serviceLabel,
      scheduledDate: booking.scheduledDate,
    },
    dedupeKey: `booking:${booking.id}:completed`,
    companyId: booking.companyId,
    branchId: booking.branchId,
  });
}

export async function notifyStaffAssigned(input: {
  staffId: number;
  staffName?: string | null;
  customerId: number;
  customerName?: string | null;
  serviceName: string;
  scheduledDate: string;
  societyName?: string | null;
  parkingBay?: string | null;
  bookingId?: number | null;
  subscriptionId?: number | null;
  companyId?: number | null;
  branchId?: number | null;
}) {
  const staffName = input.staffName || "Technician";
  const customerName = input.customerName || "Customer";
  const refId = input.bookingId ? `booking:${input.bookingId}` : `sub:${input.subscriptionId}`;

  // 1. Notify Customer about staff assignment
  await dispatchNotification({
    template: "staff_assigned_customer",
    customerId: input.customerId,
    vars: {
      customerName,
      staffName,
      serviceName: input.serviceName,
      scheduledDate: input.scheduledDate,
      societyName: input.societyName || "",
    },
    dedupeKey: `${refId}:staff_assigned:customer`,
    companyId: input.companyId,
    branchId: input.branchId,
  }).catch(err => logger.error({ err }, "Failed to notify customer of staff assignment"));

  // 2. Notify Staff member about new assignment
  // Look up staff user record to deliver in-app notification
  const [staffRow] = await db.select({
    userId: usersTable.id,
    phone: usersTable.phone,
  })
    .from(usersTable)
    .where(eq(usersTable.staffId, input.staffId))
    .limit(1);

  if (staffRow?.userId) {
    await dispatchNotification({
      template: "staff_assigned_staff",
      userId: staffRow.userId,
      phone: staffRow.phone,
      vars: {
        staffName,
        customerName,
        serviceName: input.serviceName,
        scheduledDate: input.scheduledDate,
        societyName: input.societyName || "",
        parkingBay: input.parkingBay || "",
      },
      dedupeKey: `${refId}:staff_assigned:staff:${input.staffId}`,
      companyId: input.companyId,
      branchId: input.branchId,
    }).catch(err => logger.error({ err }, "Failed to notify staff of assignment"));
  }
}

export async function notifyVisitCompleted(input: {
  customerId: number;
  customerName?: string | null;
  vehicleNumber: string;
  societyName?: string | null;
  visitType: string;
  visitId: number;
  companyId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "visit_completed",
    customerId: input.customerId,
    vars: {
      customerName: input.customerName || "Customer",
      vehicleNumber: input.vehicleNumber,
      societyName: input.societyName || "",
      visitType: input.visitType === "wash" ? "Full Wash" : "Morning Cleaning",
    },
    dedupeKey: `visit:${input.visitId}:completed`,
    companyId: input.companyId,
    branchId: input.branchId,
  }).catch(err => logger.error({ err }, "Failed to notify customer of visit completion"));
}

export async function notifyCarNotAvailable(input: {
  customerId: number;
  customerName?: string | null;
  staffName: string;
  vehicleNumber: string;
  societyName?: string | null;
  subscriptionId: number;
  visitId: number;
  companyId?: number | null;
  branchId?: number | null;
}) {
  // Notify customer
  await dispatchNotification({
    template: "car_not_available_customer",
    customerId: input.customerId,
    vars: {
      customerName: input.customerName || "Customer",
      vehicleNumber: input.vehicleNumber,
      societyName: input.societyName || "",
    },
    dedupeKey: `visit:${input.visitId}:car_not_available:customer`,
    companyId: input.companyId,
    branchId: input.branchId,
  }).catch(err => logger.error({ err }, "Failed to notify customer of car not available"));

  // Notify admin
  await dispatchNotification({
    template: "car_not_available_admin",
    vars: {
      customerName: input.customerName || "Customer",
      staffName: input.staffName,
      vehicleNumber: input.vehicleNumber,
      societyName: input.societyName || "",
    },
    dedupeKey: `visit:${input.visitId}:car_not_available:admin`,
    companyId: input.companyId,
    branchId: input.branchId,
  }).catch(err => logger.error({ err }, "Failed to notify admin of car not available"));
}

