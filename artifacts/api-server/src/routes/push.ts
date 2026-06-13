import { Router } from "express";
import { requireAuth, requirePermission } from "../middlewares/auth";
import { getVapidPublicKey, isWebPushConfigured } from "../lib/push/webPushService";
import {
  registerPushSubscription,
  unregisterPushSubscription,
  getPushStatus,
} from "../lib/push/subscriptionService";
import { listPushNotificationLogs, getPushLogStats } from "../lib/push/pushLogService";

const router = Router();

router.get("/push/vapid-public-key", (_req, res) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ error: "Push notifications not configured", configured: false });
  }
  return res.json({ publicKey: key, configured: isWebPushConfigured() });
});

router.get("/push/status", requireAuth, async (req, res) => {
  try {
    const status = await getPushStatus(req.user!.id);
    return res.json({
      ...status,
      pushConfigured: isWebPushConfigured(),
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
  }
});

router.post("/push/register", requireAuth, async (req, res) => {
  try {
    if (!isWebPushConfigured()) {
      return res.status(503).json({ error: "Push notifications not configured on server" });
    }

    const { subscription } = req.body as {
      subscription?: {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };
    };

    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return res.status(400).json({ error: "Valid push subscription required" });
    }

    const row = await registerPushSubscription({
      userId: req.user!.id,
      role: req.user!.role,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: req.headers["user-agent"] ?? null,
    });

    return res.status(201).json({ id: row.id, subscribed: true });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Registration failed" });
  }
});

router.post("/push/unregister", requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });

    await unregisterPushSubscription(req.user!.id, endpoint);
    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unregister failed" });
  }
});

router.get(
  "/push/admin/logs",
  requireAuth,
  requirePermission("notifications", "view"),
  async (req, res) => {
    try {
      const q = req.query;
      const logs = await listPushNotificationLogs({
        status: q.status as string | undefined,
        eventType: q.eventType as string | undefined,
        recipientRole: q.role as string | undefined,
        userId: q.userId ? Number(q.userId) : undefined,
        from: q.from as string | undefined,
        to: q.to as string | undefined,
        limit: q.limit ? Number(q.limit) : 200,
      });
      const stats = await getPushLogStats();
      return res.json({ stats, logs });
    } catch (err) {
      return res.status(500).json({ error: err instanceof Error ? err.message : "Failed" });
    }
  },
);

export default router;
