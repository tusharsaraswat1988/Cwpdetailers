import { db } from "@workspace/db";
import { notificationsTable, usersTable, customersTable, commCustomerConsentsTable } from "@workspace/db";
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
  | "cleaning_missed"
  | "complaint_update"
  | "low_balance"
  | "payment_initiated"
  | "payment_success"
  | "payment_failed"
  | "subscription_activated"
  | "subscription_paused"
  | "subscription_resumed"
  | "subscription_cancelled"
  | "subscription_renewal_due"
  | "exception_resolved"
  | "ticket_created"
  | "ticket_updated"
  | "ticket_resolved"
  | "technician_en_route"
  | "service_started"
  | "staff_reassigned_customer"
  | "staff_reassigned_staff"
  | "schedule_changed_staff"
  | "assignment_cancelled_staff"
  | "dispatch_update_staff"
  | "makeup_booking_confirmed"
  | "admin_assignment_failure"
  | "admin_service_missed"
  | "admin_repeated_failure"
  | "admin_reschedule_approval_required";

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
    cleaning_missed: (v) => ({
      title: "Cleaning Visit Missed",
      message: `Hi ${v.customerName}, morning cleaning for vehicle ${v.vehicleNumber} was missed today. Our supervisor has logged an exception and will arrange a makeup cleaning. — ${brandName}`,
      sms: `Hi ${v.customerName}, cleaning for ${v.vehicleNumber} was missed today. Makeup credit/visit being scheduled. — ${brandName}`,
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
    payment_initiated: (v) => ({
      title: "Payment Checkout Initiated",
      message: `Hi ${v.customerName}, payment checkout of ₹${v.amount} for ${v.planName} has been created. Complete payment to activate service.`,
      sms: `Hi ${v.customerName}, payment of ₹${v.amount} initiated for ${v.planName}. Complete in app to activate. — ${brandName}`,
    }),
    payment_success: (v) => ({
      title: "Payment Received Successfully",
      message: `Hi ${v.customerName}, we received your payment of ₹${v.amount} for ${v.planName}. Your subscription is now active! — ${brandName}`,
      sms: `Hi ${v.customerName}, payment of ₹${v.amount} received. Service active! — ${brandName}`,
    }),
    payment_failed: (v) => ({
      title: "Payment Unsuccessful",
      message: `Hi ${v.customerName}, payment for ${v.planName} could not be completed. No funds were debited. You may retry anytime.`,
      sms: `Hi ${v.customerName}, payment was unsuccessful. You can safely retry from your portal. — ${brandName}`,
    }),
    subscription_activated: (v) => ({
      title: "Subscription Activated",
      message: `Hi ${v.customerName}, daily cleaning for ${v.vehicleNumber}${v.societyName ? ` at ${v.societyName}` : ""} is now ACTIVE! Cleaner will visit your bay ${v.parkingBay || ""} daily.`,
      sms: `Hi ${v.customerName}, daily cleaning for ${v.vehicleNumber} is now active! — ${brandName}`,
    }),
    subscription_paused: (v) => ({
      title: "Subscription Paused",
      message: `Hi ${v.customerName}, your daily cleaning service has been paused from ${v.startDate} to ${v.endDate}. No cleaning credits will be deducted.`,
      sms: `Hi ${v.customerName}, daily cleaning paused ${v.startDate} to ${v.endDate}. Credits preserved. — ${brandName}`,
    }),
    subscription_resumed: (v) => ({
      title: "Subscription Resumed",
      message: `Hi ${v.customerName}, your daily cleaning service has resumed for vehicle ${v.vehicleNumber}! Morning visits will restart as scheduled.`,
      sms: `Hi ${v.customerName}, daily cleaning resumed for ${v.vehicleNumber}. — ${brandName}`,
    }),
    subscription_cancelled: (v) => ({
      title: "Subscription Cancelled",
      message: `Hi ${v.customerName}, your daily cleaning subscription #${v.subscriptionId} has been cancelled upon request.`,
      sms: `Hi ${v.customerName}, subscription #${v.subscriptionId} cancelled. Thank you for choosing ${brandName}.`,
    }),
    subscription_renewal_due: (v) => ({
      title: "Upcoming Plan Renewal",
      message: `Hi ${v.customerName}, you have only ${v.remainingCleanings} daily cleanings remaining for vehicle ${v.vehicleNumber}. Renew now to keep doorstep service active!`,
      sms: `Hi ${v.customerName}, ${v.remainingCleanings} cleanings left for ${v.vehicleNumber}. Renew in app to prevent stoppage. — ${brandName}`,
    }),
    exception_resolved: (v) => ({
      title: "Service Issue Resolved",
      message: `Hi ${v.customerName}, your service exception for ${v.vehicleNumber} has been resolved: ${v.resolutionAction}. ${v.notes || ""}`,
      sms: `Hi ${v.customerName}, issue for ${v.vehicleNumber} resolved: ${v.resolutionAction}. — ${brandName}`,
    }),
    ticket_created: (v) => ({
      title: `Support Ticket #${v.ticketNumber} Created`,
      message: `Hi ${v.customerName}, your support request #${v.ticketNumber} (${v.title}) has been logged. Our supervisor is on it.`,
      sms: `Hi ${v.customerName}, support ticket #${v.ticketNumber} logged. We're on it! — ${brandName}`,
    }),
    ticket_updated: (v) => ({
      title: `Update on Ticket #${v.ticketNumber}`,
      message: `Hi ${v.customerName}, update on ticket #${v.ticketNumber}: ${v.messageSummary}`,
      sms: `Hi ${v.customerName}, update on ticket #${v.ticketNumber}: ${v.messageSummary}. — ${brandName}`,
    }),
    ticket_resolved: (v) => ({
      title: `Ticket #${v.ticketNumber} Resolved`,
      message: `Hi ${v.customerName}, ticket #${v.ticketNumber} has been resolved: ${v.resolution}. Thank you for your feedback!`,
      sms: `Hi ${v.customerName}, ticket #${v.ticketNumber} resolved: ${v.resolution}. — ${brandName}`,
    }),
    technician_en_route: (v) => ({
      title: "Technician En Route",
      message: `Hi ${v.customerName}, your technician ${v.staffName} is en route to your location${v.etaText ? ` (${v.etaText})` : ""}. — ${brandName}`,
      sms: `Hi ${v.customerName}, technician ${v.staffName} is on the way${v.etaText ? ` (${v.etaText})` : ""}. — ${brandName}`,
    }),
    service_started: (v) => ({
      title: "Service Started",
      message: `Hi ${v.customerName}, technician ${v.staffName} has arrived and started your ${v.serviceName}. — ${brandName}`,
      sms: `Hi ${v.customerName}, ${v.staffName} has started your ${v.serviceName}. — ${brandName}`,
    }),
    staff_reassigned_customer: (v) => ({
      title: "Technician Updated",
      message: `Hi ${v.customerName}, your technician for ${v.serviceName} on ${v.scheduledDate} has been updated to ${v.staffName}. — ${brandName}`,
      sms: `Hi ${v.customerName}, your technician for ${v.serviceName} on ${v.scheduledDate} is now ${v.staffName}. — ${brandName}`,
    }),
    staff_reassigned_staff: (v) => ({
      title: "Assignment Reassigned",
      message: `Hi ${v.staffName}, your assignment for ${v.customerName} on ${v.scheduledDate} has been reassigned to ${v.newStaffName ?? "another technician"}.`,
      sms: `Hi ${v.staffName}, assignment for ${v.customerName} on ${v.scheduledDate} has been reassigned.`,
    }),
    schedule_changed_staff: (v) => ({
      title: "Schedule Updated",
      message: `Hi ${v.staffName}, your schedule for ${v.scheduledDate} has changed: ${v.changeDetails ?? "Please check your route in the app."}`,
      sms: `Hi ${v.staffName}, schedule for ${v.scheduledDate} updated. Check app for details.`,
    }),
    assignment_cancelled_staff: (v) => ({
      title: "Assignment Cancelled",
      message: `Hi ${v.staffName}, scheduled service for ${v.customerName} on ${v.scheduledDate} was cancelled (${v.reason ?? "customer request"}).`,
      sms: `Hi ${v.staffName}, service for ${v.customerName} on ${v.scheduledDate} was cancelled.`,
    }),
    dispatch_update_staff: (v) => ({
      title: "Dispatch Update",
      message: `Hi ${v.staffName}, dispatch notification: ${v.messageText}`,
      sms: `Hi ${v.staffName}, dispatch update: ${v.messageText}`,
    }),
    makeup_booking_confirmed: (v) => ({
      title: "Makeup Service Confirmed",
      message: `Hi ${v.customerName}, your replacement makeup visit for ${v.serviceName} is confirmed for ${v.scheduledDate}${v.scheduledTime ? ` at ${v.scheduledTime}` : ""}. — ${brandName}`,
      sms: `Hi ${v.customerName}, your makeup ${v.serviceName} is confirmed for ${v.scheduledDate} ${v.scheduledTime ?? ""}. — ${brandName}`,
    }),
    admin_assignment_failure: (v) => ({
      title: "Alert: Assignment Failure",
      message: `Assignment failed for booking #${v.bookingId} (${v.serviceName}) in ${v.cityName ?? "City"}. Manual dispatch required.`,
      sms: `Alert: Assignment failed for booking #${v.bookingId}. Action required.`,
    }),
    admin_service_missed: (v) => ({
      title: "Alert: Service Missed",
      message: `Service #${v.bookingId} (${v.customerName}) was marked missed by ${v.staffName}. Reason: ${v.reason}.`,
      sms: `Alert: Service #${v.bookingId} missed. Reason: ${v.reason}.`,
    }),
    admin_repeated_failure: (v) => ({
      title: "Urgent Alert: Repeated Service Failure",
      message: `Customer ${v.customerName} (${v.customerPhone ?? ""}) has experienced ${v.failureCount} missed or uncompleted services in the last ${v.periodDays ?? "7"} days.`,
      sms: `Urgent: Customer ${v.customerName} has ${v.failureCount} missed services. Supervisor inspection required.`,
    }),
    admin_reschedule_approval_required: (v) => ({
      title: "Reschedule Approval Required",
      message: `Customer ${v.customerName} requested reschedule for booking #${v.bookingId} requiring approval: ${v.reason ?? "Capacity limit exceeded"}.`,
      sms: `Reschedule review required for booking #${v.bookingId} (${v.customerName}).`,
    }),
  };
}

const TYPE_MAP: Record<NotificationTemplate, (typeof notificationsTable.type.enumValues)[number]> = {
  booking_confirmed: "booking_confirmation",
  booking_completed: "service_complete",
  staff_assigned_customer: "booking_confirmation",
  staff_assigned_staff: "staff_assigned",
  visit_completed: "service_complete",
  car_not_available_customer: "cleaning_cna",
  car_not_available_admin: "cleaning_cna",
  cleaning_missed: "cleaning_missed",
  complaint_update: "complaint_update",
  low_balance: "payment_reminder",
  payment_initiated: "payment_initiated",
  payment_success: "payment_success",
  payment_failed: "payment_failed",
  subscription_activated: "subscription_activated",
  subscription_paused: "subscription_paused",
  subscription_resumed: "subscription_resumed",
  subscription_cancelled: "subscription_cancelled",
  subscription_renewal_due: "subscription_renewal_due",
  exception_resolved: "exception_resolved",
  ticket_created: "ticket_created",
  ticket_updated: "ticket_updated",
  ticket_resolved: "ticket_resolved",
  technician_en_route: "technician_en_route",
  service_started: "service_started",
  staff_reassigned_customer: "staff_reassigned",
  staff_reassigned_staff: "staff_reassigned",
  schedule_changed_staff: "schedule_changed",
  assignment_cancelled_staff: "assignment_cancelled",
  dispatch_update_staff: "general",
  makeup_booking_confirmed: "makeup_booking_confirmed",
  admin_assignment_failure: "assignment_failure",
  admin_service_missed: "cleaning_missed",
  admin_repeated_failure: "repeated_execution_failure",
  admin_reschedule_approval_required: "reschedule_approval_required",
};

export type DispatchNotificationInput = {
  template?: NotificationTemplate;
  title?: string;
  message?: string;
  type?: (typeof notificationsTable.type.enumValues)[number];
  vars?: Record<string, string>;
  userId?: number | null;
  customerId?: number | null;
  cityId?: number | null;
  phone?: string | null;
  channels?: DispatchChannel[];
  dedupeKey?: string;
  companyId?: number | null;
  branchId?: number | null;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  adapters?: ChannelAdapters;
  isMarketing?: boolean;
  sensitiveMasked?: boolean;
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
  const templates = buildTemplates(brandName);
  const templateFn = input.template ? templates[input.template] : undefined;
  const tpl = templateFn
    ? templateFn(input.vars ?? {})
    : {
        title: input.title ?? "Notification",
        message: input.message ?? "",
        sms: input.message ?? "",
      };
  let messageText = tpl.message;
  let smsText = tpl.sms;
  if (input.sensitiveMasked) {
    messageText = messageText.replace(/Flat\s+[A-Za-z0-9-]+/gi, "Flat ***");
    smsText = smsText.replace(/Flat\s+[A-Za-z0-9-]+/gi, "Flat ***");
  }

  const resolvedType =
    input.type ?? (input.template ? TYPE_MAP[input.template] : undefined) ?? "general";
  const userId = await resolveUserId(input);
  const phone = await resolvePhone(input);

  if (input.isMarketing && input.customerId) {
    const [consent] = await db
      .select()
      .from(commCustomerConsentsTable)
      .where(eq(commCustomerConsentsTable.customerId, input.customerId))
      .limit(1);

    if (consent && !consent.smsConsent && channels.includes("sms")) {
      logger.info({ customerId: input.customerId }, "Marketing notification skipped: opt-out/no consent");
      return { success: true, skipped: true, inAppDelivered: false, reason: "marketing_opt_out" };
    }
  }

  if (input.dedupeKey) {
    const [existing] = await db.select({ id: notificationsTable.id })
      .from(notificationsTable)
      .where(eq(notificationsTable.dedupeKey, input.dedupeKey))
      .limit(1);
    if (existing) {
      logger.info({ dedupeKey: input.dedupeKey }, "Notification skipped (duplicate)");
      return { success: true, skipped: true, inAppDelivered: false, reason: "duplicate" };
    }
  }

  const results: Array<{ channel: string; status: string; externalId?: string; error?: string }> = [];
  let inAppDelivered = false;

  if (channels.includes("in_app") && (userId || input.customerId)) {
    await db.insert(notificationsTable).values({
      userId: userId ?? null,
      customerId: input.customerId ?? null,
      cityId: input.cityId ?? null,
      title: tpl.title,
      message: messageText,
      type: resolvedType as any,
      channel: "in_app",
      deliveryStatus: "sent",
      actionUrl: input.actionUrl ?? null,
      metadata: input.metadata ?? {},
      dedupeKey: input.dedupeKey ?? null,
      isMarketing: Boolean(input.isMarketing),
      sensitiveMasked: Boolean(input.sensitiveMasked),
      companyId: input.companyId ?? null,
      branchId: input.branchId ?? null,
    });
    results.push({ channel: "in_app", status: "sent" });
    inAppDelivered = true;
  }

  if (channels.includes("sms")) {
    const adapters = input.adapters ?? { sms: createDefaultSmsAdapter() };
    const smsAdapter = getConfiguredSmsAdapter(adapters);

    if (!phone) {
      logger.warn({ template: input.template, customerId: input.customerId }, "SMS skipped — no phone");
      await db.insert(notificationsTable).values({
        userId: userId ?? null,
        customerId: input.customerId ?? null,
        cityId: input.cityId ?? null,
        title: tpl.title,
        message: smsText,
        type: resolvedType as any,
        channel: "sms",
        deliveryStatus: "skipped",
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        errorMessage: "no phone",
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:sms` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({ channel: "sms", status: "skipped", error: "no phone" });
    } else if (!smsAdapter?.isConfigured()) {
      logger.warn({ template: input.template }, "SMS skipped — provider not configured");
      await db.insert(notificationsTable).values({
        userId: userId ?? null,
        customerId: input.customerId ?? null,
        cityId: input.cityId ?? null,
        title: tpl.title,
        message: smsText,
        type: resolvedType as any,
        channel: "sms",
        deliveryStatus: "skipped",
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        errorMessage: "provider not configured",
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:sms` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({ channel: "sms", status: "skipped", error: "provider not configured" });
    } else {
      const smsResult = await smsAdapter.sendSms(phone, smsText);
      await db.insert(notificationsTable).values({
        userId: userId ?? null,
        customerId: input.customerId ?? null,
        cityId: input.cityId ?? null,
        title: tpl.title,
        message: smsText,
        type: resolvedType as any,
        channel: "sms",
        deliveryStatus: smsResult.success ? "sent" : "failed",
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        errorMessage: smsResult.error ?? null,
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

  if (channels.includes("whatsapp")) {
    const waAdapter = input.adapters?.whatsapp;
    if (!phone) {
      results.push({ channel: "whatsapp", status: "skipped", error: "no phone" });
    } else if (!waAdapter?.isConfigured()) {
      logger.info({ template: input.template }, "WhatsApp skipped — provider not configured");
      await db.insert(notificationsTable).values({
        userId: userId ?? null,
        customerId: input.customerId ?? null,
        cityId: input.cityId ?? null,
        title: tpl.title,
        message: messageText,
        type: resolvedType as any,
        channel: "whatsapp",
        deliveryStatus: "skipped",
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        errorMessage: "whatsapp provider not configured",
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:whatsapp` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({ channel: "whatsapp", status: "skipped", error: "whatsapp provider not configured" });
    } else {
      const waResult = await waAdapter.sendSms(phone, messageText);
      await db.insert(notificationsTable).values({
        userId: userId ?? null,
        customerId: input.customerId ?? null,
        cityId: input.cityId ?? null,
        title: tpl.title,
        message: messageText,
        type: resolvedType as any,
        channel: "whatsapp",
        deliveryStatus: waResult.success ? "sent" : "failed",
        actionUrl: input.actionUrl ?? null,
        metadata: input.metadata ?? {},
        errorMessage: waResult.error ?? null,
        externalId: waResult.externalId ?? null,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:whatsapp` : null,
        companyId: input.companyId ?? null,
        branchId: input.branchId ?? null,
      });
      results.push({
        channel: "whatsapp",
        status: waResult.success ? "sent" : "failed",
        externalId: waResult.externalId,
        error: waResult.error,
      });
    }
  }

  return { success: true, skipped: false, inAppDelivered, results };
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

export async function notifyPaymentSuccess(input: {
  customerId: number;
  customerName?: string | null;
  amount: number | string;
  planName: string;
  orderId: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "payment_success",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      amount: String(input.amount),
      planName: input.planName,
    },
    dedupeKey: `payment:${input.orderId}:success`,
    actionUrl: "/customer/invoices",
  }).catch(err => logger.error({ err }, "Failed to notify customer of payment success"));
}

export async function notifySubscriptionActivated(input: {
  subscriptionId: number;
  customerId: number;
  customerName?: string | null;
  vehicleNumber: string;
  societyName?: string | null;
  parkingBay?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "subscription_activated",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      vehicleNumber: input.vehicleNumber,
      societyName: input.societyName || "",
      parkingBay: input.parkingBay || "",
    },
    dedupeKey: `sub:${input.subscriptionId}:activated`,
    actionUrl: "/customer/daily-cleaning",
  }).catch(err => logger.error({ err }, "Failed to notify customer of subscription activation"));
}

export async function notifySubscriptionRenewalDue(input: {
  subscriptionId: number;
  customerId: number;
  customerName?: string | null;
  vehicleNumber: string;
  remainingCleanings: number;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "subscription_renewal_due",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      vehicleNumber: input.vehicleNumber,
      remainingCleanings: String(input.remainingCleanings),
    },
    dedupeKey: `sub:${input.subscriptionId}:renewal_due:${input.remainingCleanings}`,
    actionUrl: "/customer/daily-cleaning",
  }).catch(err => logger.error({ err }, "Failed to notify customer of renewal due"));
}

export async function notifyTicketCreated(input: {
  ticketNumber: string;
  customerId: number;
  customerName?: string | null;
  title: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "ticket_created",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      ticketNumber: input.ticketNumber,
      title: input.title,
    },
    dedupeKey: `ticket:${input.ticketNumber}:created`,
    actionUrl: "/customer/support",
  }).catch(err => logger.error({ err }, "Failed to notify customer of ticket creation"));
}

export async function notifyTicketUpdated(input: {
  ticketNumber: string;
  customerId: number;
  customerName?: string | null;
  messageSummary: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "ticket_updated",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      ticketNumber: input.ticketNumber,
      messageSummary: input.messageSummary,
    },
    dedupeKey: `ticket:${input.ticketNumber}:updated:${Date.now()}`,
    actionUrl: "/customer/support",
  }).catch(err => logger.error({ err }, "Failed to notify customer of ticket update"));
}

export async function notifyTicketResolved(input: {
  ticketNumber: string;
  customerId: number;
  customerName?: string | null;
  resolution: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "ticket_resolved",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      ticketNumber: input.ticketNumber,
      resolution: input.resolution,
    },
    dedupeKey: `ticket:${input.ticketNumber}:resolved`,
    actionUrl: "/customer/support",
  }).catch(err => logger.error({ err }, "Failed to notify customer of ticket resolution"));
}

export async function notifyOperationalExceptionResolved(input: {
  exceptionId: number;
  customerId: number;
  customerName?: string | null;
  vehicleNumber: string;
  resolutionAction: string;
  notes?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "exception_resolved",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      vehicleNumber: input.vehicleNumber,
      resolutionAction: input.resolutionAction,
      notes: input.notes || "",
    },
    dedupeKey: `exception:${input.exceptionId}:resolved`,
    actionUrl: "/customer/daily-cleaning",
  }).catch(err => logger.error({ err }, "Failed to notify customer of exception resolution"));
}

export async function notifyTechnicianEnRoute(input: {
  bookingId: number;
  customerId: number;
  customerName?: string | null;
  staffName: string;
  serviceName: string;
  etaMinutes?: number | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  const etaText = input.etaMinutes ? `estimated arrival in ~${input.etaMinutes} mins` : "arriving shortly";
  return dispatchNotification({
    template: "technician_en_route",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      staffName: input.staffName,
      serviceName: input.serviceName,
      etaText,
    },
    dedupeKey: `booking:${input.bookingId}:en_route`,
    actionUrl: `/customer/bookings/${input.bookingId}`,
  }).catch(err => logger.error({ err }, "Failed to notify customer of technician en route"));
}

export async function notifyServiceStarted(input: {
  bookingId: number;
  customerId: number;
  customerName?: string | null;
  staffName: string;
  serviceName: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "service_started",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      staffName: input.staffName,
      serviceName: input.serviceName,
    },
    dedupeKey: `booking:${input.bookingId}:started`,
    actionUrl: `/customer/bookings/${input.bookingId}`,
  }).catch(err => logger.error({ err }, "Failed to notify customer of service start"));
}

export async function notifyServiceMissed(input: {
  bookingId: number;
  customerId: number;
  customerName?: string | null;
  serviceName: string;
  scheduledDate: string;
  reason?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "cleaning_missed",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      serviceName: input.serviceName,
      scheduledDate: input.scheduledDate,
      reason: input.reason || "Technician unable to complete service",
    },
    dedupeKey: `booking:${input.bookingId}:missed`,
    actionUrl: `/customer/bookings/${input.bookingId}`,
  }).catch(err => logger.error({ err }, "Failed to notify customer of missed service"));
}

export async function notifyMakeupBookingConfirmed(input: {
  bookingId: number;
  originalBookingId: number;
  customerId: number;
  customerName?: string | null;
  serviceName: string;
  scheduledDate: string;
  scheduledTime?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "makeup_booking_confirmed",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      serviceName: input.serviceName,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime || "",
    },
    dedupeKey: `booking:${input.bookingId}:makeup_confirmed`,
    actionUrl: `/customer/bookings/${input.bookingId}`,
  }).catch(err => logger.error({ err }, "Failed to notify customer of makeup confirmation"));
}

export async function notifyStaffReassigned(input: {
  bookingId: number;
  customerId: number;
  customerName?: string | null;
  serviceName: string;
  scheduledDate: string;
  newStaffId: number;
  newStaffName: string;
  previousStaffId?: number | null;
  previousStaffName?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  // 1. Notify Customer
  await dispatchNotification({
    template: "staff_reassigned_customer",
    customerId: input.customerId,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName || "Customer",
      staffName: input.newStaffName,
      serviceName: input.serviceName,
      scheduledDate: input.scheduledDate,
    },
    dedupeKey: `booking:${input.bookingId}:reassigned:${input.newStaffId}:customer`,
    actionUrl: `/customer/bookings/${input.bookingId}`,
  }).catch(err => logger.error({ err }, "Failed to notify customer of staff reassignment"));

  // 2. Notify New Staff
  const [newStaffRow] = await db
    .select({ userId: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.staffId, input.newStaffId))
    .limit(1);

  if (newStaffRow?.userId) {
    await dispatchNotification({
      template: "staff_assigned_staff",
      userId: newStaffRow.userId,
      phone: newStaffRow.phone,
      cityId: input.cityId,
      branchId: input.branchId,
      vars: {
        staffName: input.newStaffName,
        customerName: input.customerName || "Customer",
        serviceName: input.serviceName,
        scheduledDate: input.scheduledDate,
      },
      dedupeKey: `booking:${input.bookingId}:assigned:staff:${input.newStaffId}`,
      actionUrl: "/staff/bookings",
    }).catch(err => logger.error({ err }, "Failed to notify new staff of reassignment"));
  }

  // 3. Notify Previous Staff (if present)
  if (input.previousStaffId) {
    const [prevStaffRow] = await db
      .select({ userId: usersTable.id, phone: usersTable.phone })
      .from(usersTable)
      .where(eq(usersTable.staffId, input.previousStaffId))
      .limit(1);

    if (prevStaffRow?.userId) {
      await dispatchNotification({
        template: "staff_reassigned_staff",
        userId: prevStaffRow.userId,
        phone: prevStaffRow.phone,
        cityId: input.cityId,
        branchId: input.branchId,
        vars: {
          staffName: input.previousStaffName || "Technician",
          customerName: input.customerName || "Customer",
          scheduledDate: input.scheduledDate,
          newStaffName: input.newStaffName,
        },
        dedupeKey: `booking:${input.bookingId}:reassigned:prev:${input.previousStaffId}`,
        actionUrl: "/staff/bookings",
      }).catch(err => logger.error({ err }, "Failed to notify previous staff of reassignment"));
    }
  }
}

export async function notifyStaffScheduleChanged(input: {
  staffId: number;
  staffName?: string | null;
  scheduledDate: string;
  changeDetails: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  const [staffRow] = await db
    .select({ userId: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.staffId, input.staffId))
    .limit(1);

  if (!staffRow?.userId) return;

  return dispatchNotification({
    template: "schedule_changed_staff",
    userId: staffRow.userId,
    phone: staffRow.phone,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      staffName: input.staffName || "Technician",
      scheduledDate: input.scheduledDate,
      changeDetails: input.changeDetails,
    },
    dedupeKey: `staff:${input.staffId}:schedule_change:${input.scheduledDate}:${Date.now()}`,
    actionUrl: "/staff/bookings",
  }).catch(err => logger.error({ err }, "Failed to notify staff of schedule change"));
}

export async function notifyStaffAssignmentCancelled(input: {
  staffId: number;
  bookingId: number;
  customerName?: string | null;
  scheduledDate: string;
  reason?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  const [staffRow] = await db
    .select({ userId: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.staffId, input.staffId))
    .limit(1);

  if (!staffRow?.userId) return;

  return dispatchNotification({
    template: "assignment_cancelled_staff",
    userId: staffRow.userId,
    phone: staffRow.phone,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      staffName: "Technician",
      customerName: input.customerName || "Customer",
      scheduledDate: input.scheduledDate,
      reason: input.reason || "Cancelled",
    },
    dedupeKey: `booking:${input.bookingId}:staff_cancelled:${input.staffId}`,
    actionUrl: "/staff/bookings",
  }).catch(err => logger.error({ err }, "Failed to notify staff of assignment cancellation"));
}

export async function notifyStaffDispatchUpdate(input: {
  staffId: number;
  messageText: string;
  cityId?: number | null;
  branchId?: number | null;
}) {
  const [staffRow] = await db
    .select({ userId: usersTable.id, phone: usersTable.phone })
    .from(usersTable)
    .where(eq(usersTable.staffId, input.staffId))
    .limit(1);

  if (!staffRow?.userId) return;

  return dispatchNotification({
    template: "dispatch_update_staff",
    userId: staffRow.userId,
    phone: staffRow.phone,
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      staffName: "Technician",
      messageText: input.messageText,
    },
    dedupeKey: `staff:${input.staffId}:dispatch:${Date.now()}`,
    actionUrl: "/staff/bookings",
  }).catch(err => logger.error({ err }, "Failed to deliver staff dispatch update"));
}

export async function notifyAdminAssignmentFailure(input: {
  bookingId: number;
  serviceName: string;
  cityName?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "admin_assignment_failure",
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      bookingId: String(input.bookingId),
      serviceName: input.serviceName,
      cityName: input.cityName || "City",
    },
    dedupeKey: `admin:assignment_failed:${input.bookingId}`,
    actionUrl: "/admin/assign-services",
  }).catch(err => logger.error({ err }, "Failed to notify admin of assignment failure"));
}

export async function notifyAdminServiceMissed(input: {
  bookingId: number;
  customerName?: string | null;
  staffName?: string | null;
  reason?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "admin_service_missed",
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      bookingId: String(input.bookingId),
      customerName: input.customerName || "Customer",
      staffName: input.staffName || "Technician",
      reason: input.reason || "Not specified",
    },
    dedupeKey: `admin:missed:${input.bookingId}`,
    actionUrl: "/admin/bookings",
  }).catch(err => logger.error({ err }, "Failed to notify admin of missed service"));
}

export async function notifyAdminRepeatedFailure(input: {
  customerId: number;
  customerName: string;
  customerPhone?: string | null;
  failureCount: number;
  periodDays?: number;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "admin_repeated_failure",
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      customerName: input.customerName,
      customerPhone: input.customerPhone || "",
      failureCount: String(input.failureCount),
      periodDays: String(input.periodDays || 7),
    },
    dedupeKey: `admin:repeated_failure:${input.customerId}:${Date.now()}`,
    actionUrl: "/admin/complaints",
  }).catch(err => logger.error({ err }, "Failed to notify admin of repeated failure"));
}

export async function notifyAdminRescheduleApprovalRequired(input: {
  bookingId: number;
  customerName: string;
  reason?: string | null;
  cityId?: number | null;
  branchId?: number | null;
}) {
  return dispatchNotification({
    template: "admin_reschedule_approval_required",
    cityId: input.cityId,
    branchId: input.branchId,
    vars: {
      bookingId: String(input.bookingId),
      customerName: input.customerName,
      reason: input.reason || "Approval required",
    },
    dedupeKey: `admin:reschedule_approval:${input.bookingId}`,
    actionUrl: "/admin/approvals",
  }).catch(err => logger.error({ err }, "Failed to notify admin of reschedule approval"));
}

