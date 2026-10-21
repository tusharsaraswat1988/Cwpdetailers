import { Router, type Request } from "express";
import { db, usersTable } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, or, desc, isNull } from "drizzle-orm";
import { deliverPushToUser } from "../lib/push/subscriptionService";
import { isWebPushConfigured } from "../lib/push/webPushService";
import { tenantFilters } from "../middlewares/tenantScope";

const router = Router();

/**
 * Notifications are per-user. The current user can only read and mark their
 * own notifications; super-admins can target a specific userId via query
 * param or create on behalf of others.
 *
 * Admin/branch users can also see notifications scoped to their
 * company/branch (without a userId), so missed-service alerts and
 * renewal reminders are visible to them.
 */

/**
 * Builds authorization and filtering conditions for notifications based on the caller's scope and role.
 */
export function buildNotificationQueryConditions(
  req: Pick<Request, "scope" | "user">,
  query: { userId?: string; isRead?: string },
) {
  const conditions = [];

  if (req.scope?.isSuperAdmin) {
    // Super-admins can query any userId, or all notifications if none given
    if (query.userId) {
      conditions.push(eq(notificationsTable.userId, parseInt(query.userId)));
    }
    const tFilters = tenantFilters(req as any, { companyCol: notificationsTable.companyId });
    if (tFilters.length) conditions.push(...tFilters);
  } else if (req.user) {
    const userPred = eq(notificationsTable.userId, req.user.id);
    if (req.user.role === "admin" || req.user.role === "manager") {
      const tFilters = tenantFilters(req as any, {
        companyCol: notificationsTable.companyId,
        branchCol: notificationsTable.branchId,
        franchiseeCol: notificationsTable.franchiseeId,
      });
      const scopedAdminPred = and(isNull(notificationsTable.userId), ...tFilters);
      conditions.push(or(userPred, scopedAdminPred));
    } else {
      // Non-admin (customer or staff): strictly only their own notifications
      conditions.push(userPred);
    }
  } else {
    throw new Error("Authentication required");
  }

  if (query.isRead !== undefined) {
    conditions.push(eq(notificationsTable.isRead, query.isRead === "true"));
  }

  return conditions;
}

router.get("/notifications", async (req, res) => {
  try {
    const { userId, isRead } = req.query as Record<string, string>;
    let conditions;
    try {
      conditions = buildNotificationQueryConditions(req, { userId, isRead });
    } catch (authErr: any) {
      if (authErr?.message === "Authentication required") {
        return res.status(401).json({ error: "Authentication required" });
      }
      throw authErr;
    }

    const where = conditions.length ? and(...conditions) : undefined;
    const data = await db.select().from(notificationsTable).where(where).orderBy(desc(notificationsTable.createdAt)).limit(100);
    return res.json(data);
  } catch (err) {
    req.log.error({ err }, "List notifications error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications", async (req, res) => {
  try {
    const { userId, title, message, type, channel } = req.body;
    if (!title || !message || !type) return res.status(400).json({ error: "title, message, type are required" });

    const targetUserId = req.scope?.isSuperAdmin
      ? (userId ?? req.user?.id)
      : req.user?.id;
    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const [notification] = await db.insert(notificationsTable).values({
      userId: targetUserId, title, message, type, channel: channel || "in_app",
      deliveryStatus: "sent",
    }).returning();

    if (isWebPushConfigured()) {
      const [targetUser] = await db.select({ role: usersTable.role }).from(usersTable)
        .where(eq(usersTable.id, targetUserId)).limit(1);
      const pushUrl = targetUser?.role === "staff"
        ? "/staff/dashboard"
        : targetUser?.role === "customer"
          ? "/customer/account"
          : "/admin/notifications";

      void deliverPushToUser({
        userId: targetUserId,
        message: {
          title,
          body: message,
          url: pushUrl,
          tag: `broadcast-${notification!.id}`,
        },
        eventType: "broadcast",
        reason: `Notification: ${title}`,
      }).catch(err => req.log.error({ err, notificationId: notification!.id }, "Broadcast push failed"));
    }

    return res.status(201).json(notification);
  } catch (err) {
    req.log.error({ err }, "Create notification error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/notifications/test-sms", async (req, res) => {
  try {
    const isAdmin = req.scope?.isSuperAdmin || ["admin", "superadmin", "manager"].includes(req.user?.role ?? "");
    if (!isAdmin) return res.status(403).json({ error: "Admin only" });

    const { phone, message } = req.body as { phone?: string; message?: string };
    if (!phone) return res.status(400).json({ error: "phone is required" });

    const { createDefaultSmsAdapter } = await import("../lib/notifications/channels/sms");
    const { normalizePhone } = await import("../lib/notifications/types");
    const adapter = createDefaultSmsAdapter();
    const normalized = normalizePhone(phone);
    if (!normalized) return res.status(400).json({ error: "Invalid phone number" });

    const { getBrandName } = await import("../lib/brandIdentityService");
    const brandName = await getBrandName();
    const result = await adapter.sendSms(normalized, message ?? `${brandName} test SMS`);
    return res.json({ adapter: adapter.name, phone: normalized, ...result });
  } catch (err) {
    req.log.error({ err }, "Test SMS error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(notificationsTable).where(eq(notificationsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Notification not found" });
    if (!req.scope?.isSuperAdmin && req.user?.id !== existing.userId) {
      return res.status(404).json({ error: "Notification not found" });
    }
    const [notification] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, id)).returning();
    return res.json(notification);
  } catch (err) {
    req.log.error({ err }, "Mark notification read error");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
