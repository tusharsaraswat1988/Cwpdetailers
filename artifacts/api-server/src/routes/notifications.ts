import { Router } from "express";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { eq, and, or, desc, isNull } from "drizzle-orm";

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

router.get("/notifications", async (req, res) => {
  try {
    const { userId, isRead } = req.query as Record<string, string>;
    const conditions = [];

    if (req.scope?.isSuperAdmin) {
      // Super-admins can query any userId, or all notifications if none given
      if (userId) conditions.push(eq(notificationsTable.userId, parseInt(userId)));
    } else if (req.user) {
      // Regular users: see their own notifications OR company/branch-scoped
      // notifications that are not tied to a specific user
      const userPred = eq(notificationsTable.userId, req.user.id);
      const companyPred = req.user.companyId
        ? eq(notificationsTable.companyId, req.user.companyId)
        : undefined;
      const branchPred = req.user.branchId
        ? eq(notificationsTable.branchId, req.user.branchId)
        : undefined;
      // Admin roles: include user notifications + scoped admin notifications
      if (req.user.role === "admin" || req.user.role === "manager") {
        const adminPreds: Array<ReturnType<typeof eq | typeof and>> = [userPred];
        if (companyPred) {
          adminPreds.push(and(companyPred, isNull(notificationsTable.userId)));
        }
        if (branchPred) {
          adminPreds.push(and(branchPred, isNull(notificationsTable.userId)));
        }
        conditions.push(or(...adminPreds));
      } else {
        // Non-admin: only their own notifications
        conditions.push(userPred);
      }
    } else {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (isRead !== undefined) conditions.push(eq(notificationsTable.isRead, isRead === "true"));
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

    // Only super-admins may broadcast to other users.
    const targetUserId = req.scope?.isSuperAdmin
      ? (userId ?? req.user?.id)
      : req.user?.id;
    if (!targetUserId) return res.status(400).json({ error: "userId is required" });

    const [notification] = await db.insert(notificationsTable).values({
      userId: targetUserId, title, message, type, channel: channel || "in_app",
    }).returning();
    return res.status(201).json(notification);
  } catch (err) {
    req.log.error({ err }, "Create notification error");
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
