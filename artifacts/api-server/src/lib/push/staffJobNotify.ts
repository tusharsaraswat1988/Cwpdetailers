import { db, notificationsTable } from "@workspace/db";
import { deliverPushToUser, resolveUserIdFromStaffId } from "./subscriptionService";
import { isWebPushConfigured } from "./webPushService";
import { logger } from "../logger";

export type StaffJobNotifyInput = {
  staffId: number;
  customerName?: string | null;
  serviceName?: string | null;
  scheduledTime?: string | null;
  scheduledDate?: string | null;
  bookingId?: number;
  executionId?: number;
};

/** Browser push + log when admin assigns work to a staff member. */
export async function notifyStaffJobAssigned(input: StaffJobNotifyInput) {
  try {
    const userId = await resolveUserIdFromStaffId(input.staffId);
    if (!userId) {
      logger.info({ staffId: input.staffId }, "Staff job notify skipped — no linked login");
      return { sent: 0, skipped: true };
    }

    const service = input.serviceName ?? "New service job";
    const customer = input.customerName ?? "Customer";
    const time = input.scheduledTime ? ` · ${input.scheduledTime}` : "";
    const date = input.scheduledDate && input.scheduledDate !== new Date().toISOString().slice(0, 10)
      ? ` on ${input.scheduledDate}`
      : "";

    const body = `${service} for ${customer}${date}${time}. Open Today to start.`;
    const tag = input.bookingId
      ? `staff-job-booking-${input.bookingId}`
      : input.executionId
        ? `staff-job-exec-${input.executionId}`
        : `staff-job-${Date.now()}`;

    return await deliverPushToUser({
      userId,
      message: {
        title: "New job assigned",
        body,
        url: "/staff/dashboard",
        tag,
        data: { jobAlert: true },
      },
      payload: { ...input, vibrate: true },
      eventType: "job_assigned",
      reason: `Job assigned: ${service} → ${customer}`,
      recipientRole: "staff",
    });
  } catch (err) {
    logger.error({ err, staffId: input.staffId }, "Staff job push notify failed");
    return { sent: 0, failed: 1 };
  }
}

export type StaffJobTestAlertResult = {
  ok: boolean;
  sent: number;
  inApp?: boolean;
  pushConfigured?: boolean;
  failed?: number;
  skipped?: boolean;
  message: string;
  hints?: string[];
};

async function createStaffInAppAlert(userId: number, title: string, message: string) {
  await db.insert(notificationsTable).values({
    userId,
    title,
    message,
    type: "broadcast",
    channel: "in_app",
    deliveryStatus: "sent",
    dedupeKey: `staff-test-alert-${userId}-${Date.now()}`,
  });
}

/** Admin-only: send a sample job alert to verify push + vibration on staff device. */
export async function sendStaffJobTestAlert(
  staffId: number,
  staffName?: string | null,
): Promise<StaffJobTestAlertResult> {
  const userId = await resolveUserIdFromStaffId(staffId);
  if (!userId) {
    return {
      ok: false,
      sent: 0,
      skipped: true,
      message: "Staff has no portal login — create credentials first at /admin/credentials.",
      hints: ["Create staff login", "Then ask staff to sign in once at /staff/login"],
    };
  }

  const name = staffName?.trim() || "Staff";
  const title = "Test job alert";
  const body = `[Admin test] Sample job for ${name} — check vibration & notification. No real booking was created.`;
  const pushConfigured = isWebPushConfigured();
  const hints: string[] = [];

  let inApp = false;
  try {
    await createStaffInAppAlert(userId, title, body);
    inApp = true;
  } catch (err) {
    logger.error({ err, staffId, userId }, "Staff test in-app alert failed");
  }

  let pushSent = 0;
  let pushFailed = 0;
  let pushSkipped = false;

  if (!pushConfigured) {
    hints.push("Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT to server .env for phone push.");
  } else {
    const result = await deliverPushToUser({
      userId,
      message: {
        title,
        body,
        url: "/staff/dashboard",
        tag: `staff-job-test-${Date.now()}`,
        data: { jobAlert: true, testAlert: true },
      },
      payload: { staffId, testAlert: true },
      eventType: "job_assigned",
      reason: `Admin test job alert for ${name}`,
      recipientRole: "staff",
      recipientName: name,
    });

    pushSent = result.sent ?? 0;
    pushFailed = result.failed ?? 0;
    pushSkipped = Boolean(result.skipped);

    if (pushSkipped || pushSent === 0) {
      hints.push("Staff must open /staff/login → Profile or Dashboard → turn on push notifications on their phone.");
    }
  }

  if (pushSent > 0) {
    return {
      ok: true,
      sent: pushSent,
      inApp,
      pushConfigured,
      message: `Test alert sent to ${name}'s phone (${pushSent} device${pushSent === 1 ? "" : "s"}). Vibration + notification expected.`,
      hints: hints.length ? hints : undefined,
    };
  }

  if (inApp) {
    return {
      ok: true,
      sent: 0,
      inApp: true,
      pushConfigured,
      skipped: pushSkipped,
      failed: pushFailed || undefined,
      message: pushConfigured
        ? `In-app test alert saved for ${name}. Phone push not delivered yet — ask them to enable notifications in the staff app, then retry.`
        : `In-app test alert saved for ${name}. Configure VAPID keys on the server for phone push + vibration.`,
      hints,
    };
  }

  return {
    ok: false,
    sent: 0,
    pushConfigured,
    message: "Could not deliver test alert — check server logs.",
    hints,
  };
}
