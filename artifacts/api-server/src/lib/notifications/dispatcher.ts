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
  | "low_balance";

function buildTemplates(brandName: string): Record<NotificationTemplate, (vars: Record<string, string>) => { title: string; message: string; sms: string }> {
  return {
    booking_confirmed: (v) => ({
      title: "Booking Confirmed",
      message: `Hi ${v.customerName}, your ${v.serviceName} booking on ${v.scheduledDate} is confirmed. — ${brandName}`,
      sms: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is confirmed. — ${brandName}`,
    }),
    booking_completed: (v) => ({
      title: "Service Completed",
      message: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is complete. Thank you! — ${brandName}`,
      sms: `Hi ${v.customerName}, your ${v.serviceName} on ${v.scheduledDate} is complete. Thank you! — ${brandName}`,
    }),
    low_balance: (v) => ({
      title: "Low Wallet Balance",
      message: `Hi ${v.customerName}, your wallet balance (₹${v.balance}) is low. Please recharge to continue daily cleaning. — ${brandName}`,
      sms: `Hi ${v.customerName}, wallet balance ₹${v.balance} is low. Recharge to continue daily cleaning. — ${brandName}`,
    }),
  };
}

const TYPE_MAP = {
  booking_confirmed: "booking_confirmation",
  booking_completed: "service_complete",
  low_balance: "payment_reminder",
} as const;

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
